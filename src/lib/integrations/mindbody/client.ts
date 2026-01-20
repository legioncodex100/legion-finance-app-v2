import { MINDBODY_CONFIG, getMindbodyEnv, hasMindbodyStaffCredentials } from './config'
import type {
    MindbodyApiResponse,
    MindbodySale,
    MindbodyClient as MindbodyClientType,
    MindbodyContract,
    MindbodyTransaction,
    MindbodyClass,
    MindbodyService,
    MindbodyActiveMembership,
    MindbodyApiStats
} from './types'
import {
    MindbodyCache,
    getCachedToken,
    setCachedToken,
    clearTokenCache
} from './cache'

// ============================================
// API STATISTICS TRACKING
// ============================================

let apiStats: MindbodyApiStats = {
    apiCalls: 0,
    cacheHits: 0,
    rateLimitRetries: 0,
    startTime: Date.now(),
}

export function getApiStats(): MindbodyApiStats {
    return { ...apiStats, endTime: Date.now() }
}

export function resetApiStats(): void {
    apiStats = {
        apiCalls: 0,
        cacheHits: 0,
        rateLimitRetries: 0,
        startTime: Date.now(),
    }
}

// ============================================
// TOKEN MANAGEMENT WITH CACHING
// ============================================

/**
 * Get staff user token for API access
 * Uses global cache to avoid redundant token requests
 */
async function getStaffUserToken(): Promise<string> {
    // Check cache first
    const cachedToken = getCachedToken()
    if (cachedToken) {
        apiStats.cacheHits++
        return cachedToken
    }

    const env = getMindbodyEnv()

    if (!hasMindbodyStaffCredentials()) {
        throw new Error('Staff credentials not configured')
    }

    console.log('[MINDBODY] Fetching new staff token...')
    apiStats.apiCalls++

    const response = await fetch(MINDBODY_CONFIG.userTokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Api-Key': env.apiKey,
            'SiteId': env.siteId,
        },
        body: JSON.stringify({
            Username: env.staffUsername,
            Password: env.staffPassword,
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to get staff token: ${error}`)
    }

    const data = await response.json()
    const token = data.AccessToken

    // Cache the token (7 days default TTL)
    setCachedToken(token)
    console.log('[MINDBODY] Token cached successfully')

    return token
}

/**
 * Clear the cached token (useful for testing or forced refresh)
 */
export function invalidateToken(): void {
    clearTokenCache()
}

// ============================================
// RATE LIMIT CONFIGURATION
// ============================================

const RATE_LIMIT_CONFIG = {
    maxRetries: 3,
    initialDelayMs: 1000,  // 1 second
    maxDelayMs: 60000,     // 60 seconds
    backoffMultiplier: 2,
}

/**
 * Calculate delay with exponential backoff
 */
function calculateBackoffDelay(attempt: number): number {
    const delay = RATE_LIMIT_CONFIG.initialDelayMs * Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, attempt)
    return Math.min(delay, RATE_LIMIT_CONFIG.maxDelayMs)
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================
// MINDBODY API CLIENT
// ============================================

/**
 * Mindbody API Client
 * Features:
 * - Global token caching (7-day TTL)
 * - Rate limit handling with exponential backoff
 * - Response caching for frequently accessed data
 * - API statistics tracking
 */
export class MindbodyClient {
    private apiKey: string
    private siteId: string
    private cache: MindbodyCache

    constructor(apiKey?: string, siteId?: string) {
        const env = getMindbodyEnv()
        this.apiKey = apiKey || env.apiKey
        this.siteId = siteId || env.siteId
        this.cache = new MindbodyCache()
    }

    /**
     * Ensure we have a valid staff token (uses global cache)
     */
    private async ensureToken(): Promise<string> {
        return getStaffUserToken()
    }

    /**
     * Make authenticated request to Mindbody API
     * Includes rate limit handling with exponential backoff
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = await this.ensureToken()
        const url = `${MINDBODY_CONFIG.apiBaseUrl}${endpoint}`

        let lastError: Error | null = null

        for (let attempt = 0; attempt < RATE_LIMIT_CONFIG.maxRetries; attempt++) {
            apiStats.apiCalls++

            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Api-Key': this.apiKey,
                    'SiteId': this.siteId,
                    'Authorization': token,
                    ...options.headers,
                },
            })

            // Handle rate limiting (429)
            if (response.status === 429) {
                apiStats.rateLimitRetries++
                const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
                const delay = calculateBackoffDelay(attempt)
                const waitTime = Math.max(retryAfter * 1000, delay)

                console.warn(`[MINDBODY] Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${RATE_LIMIT_CONFIG.maxRetries}`)
                await sleep(waitTime)
                continue
            }

            // Handle token expiration (401) - refresh token and retry once
            if (response.status === 401 && attempt === 0) {
                console.warn('[MINDBODY] Token expired, refreshing...')
                clearTokenCache()
                const newToken = await this.ensureToken()
                // Retry with new token
                const retryResponse = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        'Api-Key': this.apiKey,
                        'SiteId': this.siteId,
                        'Authorization': newToken,
                        ...options.headers,
                    },
                })

                if (retryResponse.ok) {
                    return retryResponse.json()
                }
            }

            // Handle other errors
            if (!response.ok) {
                const errorText = await response.text()
                lastError = new Error(`Mindbody API error (${response.status}): ${errorText}`)

                // Don't retry on client errors (4xx except 429)
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    throw lastError
                }

                // Retry on server errors (5xx)
                if (response.status >= 500) {
                    const delay = calculateBackoffDelay(attempt)
                    console.warn(`[MINDBODY] Server error (${response.status}). Waiting ${delay}ms before retry`)
                    await sleep(delay)
                    continue
                }

                throw lastError
            }

            return response.json()
        }

        throw lastError || new Error('Max retries exceeded')
    }

    /**
     * Get sales within a date range
     */
    async getSales(
        startDate: Date,
        endDate: Date,
        limit: number = MINDBODY_CONFIG.sync.maxRecordsPerRequest,
        offset: number = 0
    ): Promise<MindbodyApiResponse<MindbodySale>> {
        const params = new URLSearchParams()
        params.set('request.startSaleDateTime', startDate.toISOString())
        params.set('request.endSaleDateTime', endDate.toISOString())
        params.set('request.limit', limit.toString())
        params.set('request.offset', offset.toString())

        return this.request<MindbodyApiResponse<MindbodySale>>(
            `/sale/sales?${params.toString()}`
        )
    }

    /**
     * Get all sales with pagination
     */
    async getAllSales(startDate: Date, endDate: Date): Promise<MindbodySale[]> {
        const allSales: MindbodySale[] = []
        let offset = 0
        const limit = MINDBODY_CONFIG.sync.maxRecordsPerRequest

        while (true) {
            const response = await this.getSales(startDate, endDate, limit, offset)
            const sales = response.Sales || []
            allSales.push(...sales)

            // Check if we've fetched all records
            const pagination = response.PaginationResponse
            if (!pagination || sales.length < limit || allSales.length >= pagination.TotalResults) {
                break
            }

            offset += limit
        }

        return allSales
    }

    /**
     * Test connection to Mindbody API
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            // Try to get a minimal sales response
            const endDate = new Date()
            const startDate = new Date()
            startDate.setDate(startDate.getDate() - 1)

            await this.getSales(startDate, endDate, 1)
            return { success: true, message: 'Connected successfully' }
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Connection failed'
            }
        }
    }

    /**
     * Get contracts/memberships (allows filtering by LocationId)
     * This is the preferred method for getting all memberships
     */
    async getContracts(locationId?: number, limit: number = 200, offset: number = 0): Promise<MindbodyApiResponse<MindbodyContract>> {
        const params = new URLSearchParams({
            Limit: limit.toString(),
            Offset: offset.toString(),
        })

        if (locationId) {
            params.set('LocationId', locationId.toString())
        }

        return this.request<MindbodyApiResponse<MindbodyContract>>(`/sale/contracts?${params.toString()}`)
    }

    /**
     * Get all contracts/memberships with pagination
     */
    async getAllContracts(locationId?: number): Promise<MindbodyContract[]> {
        // Check cache first (only for non-filtered requests)
        if (!locationId) {
            const cached = this.cache.getContracts<MindbodyContract[]>()
            if (cached) {
                apiStats.cacheHits++
                return cached
            }
        }

        const allContracts: MindbodyContract[] = []
        let offset = 0
        const limit = 200

        while (true) {
            const response = await this.getContracts(locationId, limit, offset)
            const contracts = response.Contracts || []
            allContracts.push(...contracts)

            if (contracts.length < limit) break
            offset += limit
        }

        // Cache if not filtered
        if (!locationId) {
            this.cache.setContracts(allContracts)
        }

        return allContracts
    }

    /**
     * Get clients with optional search
     * Use empty SearchText to get all clients
     * includeInactive: true to include cancelled/inactive members
     */
    async searchClients(searchText: string = '', limit: number = 200, offset: number = 0, includeInactive: boolean = true): Promise<MindbodyApiResponse<MindbodyClientType>> {
        const params = new URLSearchParams()
        params.set('request.limit', limit.toString())
        params.set('request.offset', offset.toString())
        params.set('request.includeInactive', includeInactive.toString())

        if (searchText) {
            params.set('request.searchText', searchText)
        }

        return this.request<MindbodyApiResponse<MindbodyClientType>>(`/client/clients?${params.toString()}`)
    }

    /**
     * Get all clients with pagination
     */
    async getAllClients(): Promise<MindbodyClientType[]> {
        // Check cache first
        const cached = this.cache.getClients<MindbodyClientType[]>()
        if (cached) {
            apiStats.cacheHits++
            return cached
        }

        const allClients: MindbodyClientType[] = []
        let offset = 0
        const limit = 200

        while (true) {
            const response = await this.searchClients('', limit, offset)
            const clients = response.Clients || []
            allClients.push(...clients)

            if (clients.length < limit) break
            offset += limit
        }

        // Cache the results
        this.cache.setClients(allClients)

        return allClients
    }


    /**
     * Get client details (batched, max 20 per request)
     */
    async getClients(clientIds: string[]): Promise<MindbodyApiResponse<MindbodyClientType>> {
        const params = new URLSearchParams()
        params.set('request.clientIds', clientIds.slice(0, 20).join(','))

        return this.request<MindbodyApiResponse<MindbodyClientType>>(`/client/clients?${params.toString()}`)
    }

    /**
     * Get client services (credit packs, passes)
     */
    async getClientServices(clientId: string): Promise<any> {
        const params = new URLSearchParams({
            ClientId: clientId,
        })

        return this.request<any>(`/client/clientservices?${params.toString()}`)
    }

    /**
     * Get client visits for engagement tracking
     */
    async getClientVisits(
        clientId: string,
        startDate: Date,
        endDate: Date
    ): Promise<any> {
        const params = new URLSearchParams({
            ClientId: clientId,
            StartDate: startDate.toISOString().split('T')[0],
            EndDate: endDate.toISOString().split('T')[0],
        })

        return this.request<any>(`/client/clientvisits?${params.toString()}`)
    }

    /**
     * Get classes for a date range
     */
    async getClasses(startDate: Date, endDate: Date, limit: number = 200): Promise<MindbodyApiResponse<MindbodyClass>> {
        const params = new URLSearchParams({
            StartDateTime: startDate.toISOString(),
            EndDateTime: endDate.toISOString(),
            Limit: limit.toString(),
        })

        return this.request<MindbodyApiResponse<MindbodyClass>>(`/class/classes?${params.toString()}`)
    }

    /**
     * Get class visits/attendance
     */
    async getClassVisits(classId: number): Promise<any> {
        const params = new URLSearchParams({
            ClassId: classId.toString(),
        })

        return this.request<any>(`/class/classvisits?${params.toString()}`)
    }

    // ============================================
    // NEW ENDPOINTS FOR FINANCIAL DASHBOARD
    // ============================================

    /**
     * Get client purchases - shows exactly what each client bought
     * Note: Uses /client/clientpurchases or falls back to /sale/purchases
     */
    async getClientPurchases(clientId: string, startDate?: Date, endDate?: Date): Promise<any> {
        const params = new URLSearchParams({
            ClientId: clientId,
        })

        if (startDate) {
            params.set('StartDate', startDate.toISOString().split('T')[0])
        }
        if (endDate) {
            params.set('EndDate', endDate.toISOString().split('T')[0])
        }

        // Try the v6 purchases endpoint
        return this.request<any>(`/sale/purchases?${params.toString()}`)
    }

    /**
     * Get ALL client contracts with pagination (bulk fetch)
     * Does NOT require ClientId - fetches all contracts
     */
    async getAllClientContractsBulk(): Promise<any[]> {
        const allContracts: any[] = []
        let offset = 0
        const limit = 200

        while (true) {
            const params = new URLSearchParams({
                'request.limit': limit.toString(),
                'request.offset': offset.toString(),
            })

            try {
                const response = await this.request<any>(`/client/clientcontracts?${params.toString()}`)
                const contracts = response.Contracts || response.ClientContracts || []
                allContracts.push(...contracts)

                console.log(`Fetched ${contracts.length} contracts (offset: ${offset})`)

                if (contracts.length < limit) break
                offset += limit
            } catch (error) {
                console.error('Error fetching contracts batch:', error)
                break
            }
        }

        return allContracts
    }

    /**
     * Get client contracts - active contracts with autopay info
     * Uses /client/clientcontracts endpoint (per-client)
     */
    async getClientContracts(clientId: string): Promise<any> {
        const params = new URLSearchParams({
            'request.clientId': clientId,
        })

        return this.request<any>(`/client/clientcontracts?${params.toString()}`)
    }

    /**
     * Get all client contracts in batch (for multiple clients)
     */
    async getAllClientContracts(clientIds: string[]): Promise<any[]> {
        const allContracts: any[] = []

        // Process in batches of 10 to avoid rate limits
        for (let i = 0; i < clientIds.length; i += 10) {
            const batch = clientIds.slice(i, i + 10)
            const promises = batch.map(id => this.getClientContracts(id).catch(() => ({ Contracts: [] })))
            const results = await Promise.all(promises)

            for (const result of results) {
                // API returns "Contracts" array, not "ClientContracts"
                const contracts = result.Contracts || result.ClientContracts || []
                allContracts.push(...contracts)
            }

            // Add delay between batches to avoid rate limits
            if (i + 10 < clientIds.length) {
                await new Promise(resolve => setTimeout(resolve, 200))
            }
        }

        return allContracts
    }

    /**
     * Get payment receipts - includes failed payments and refunds
     */
    async getPaymentReceipts(startDate: Date, endDate: Date, limit: number = 200, offset: number = 0): Promise<any> {
        const params = new URLSearchParams({
            StartDate: startDate.toISOString().split('T')[0],
            EndDate: endDate.toISOString().split('T')[0],
            Limit: limit.toString(),
            Offset: offset.toString(),
        })

        return this.request<any>(`/sale/paymentreceipts?${params.toString()}`)
    }

    /**
     * Get all payment receipts with pagination
     */
    async getAllPaymentReceipts(startDate: Date, endDate: Date): Promise<any[]> {
        const allReceipts: any[] = []
        let offset = 0
        const limit = 200

        while (true) {
            const response = await this.getPaymentReceipts(startDate, endDate, limit, offset)
            const receipts = response.PaymentReceipts || []
            allReceipts.push(...receipts)

            if (receipts.length < limit) break
            offset += limit
        }

        return allReceipts
    }

    /**
     * Get services/pricing catalog
     */
    async getServices(locationId?: number): Promise<MindbodyApiResponse<MindbodyService>> {
        const params = new URLSearchParams()

        if (locationId) {
            params.set('LocationId', locationId.toString())
        }

        const queryString = params.toString()
        return this.request<MindbodyApiResponse<MindbodyService>>(`/sale/services${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Get all services with pricing (cached for 1 hour)
     */
    async getAllServices(locationId?: number): Promise<MindbodyService[]> {
        // Check cache first (only for non-filtered requests)
        if (!locationId) {
            const cached = this.cache.getServices<MindbodyService[]>()
            if (cached) {
                apiStats.cacheHits++
                return cached
            }
        }

        const response = await this.getServices(locationId)
        const services = response.Services || []

        // Cache if not filtered
        if (!locationId) {
            this.cache.setServices(services)
        }

        return services
    }

    // ============================================
    // ENRICHMENT LAYER ENDPOINTS
    // ============================================

    /**
     * Get sale transactions - includes SettlementId, EntryMethod, PaymentType
     * Critical for fee calculation and bank reconciliation
     */
    async getTransactions(startDate: Date, endDate: Date, limit: number = 200, offset: number = 0): Promise<MindbodyApiResponse<MindbodyTransaction>> {
        const params = new URLSearchParams()
        params.set('request.transactionStartDateTime', startDate.toISOString())
        params.set('request.transactionEndDateTime', endDate.toISOString())
        params.set('request.limit', limit.toString())
        params.set('request.offset', offset.toString())

        return this.request<MindbodyApiResponse<MindbodyTransaction>>(`/sale/transactions?${params.toString()}`)
    }

    /**
     * Get all transactions with pagination
     */
    async getAllTransactions(startDate: Date, endDate: Date): Promise<MindbodyTransaction[]> {
        const allTransactions: MindbodyTransaction[] = []
        let offset = 0
        const limit = 200

        while (true) {
            const response = await this.getTransactions(startDate, endDate, limit, offset)
            const transactions = response.Transactions || []
            allTransactions.push(...transactions)

            if (transactions.length < limit) break
            offset += limit
        }

        return allTransactions
    }

    /**
     * Get active client memberships - Active/Suspended/Terminated status
     * Better than using Status field from clients
     */
    async getActiveClientMemberships(clientId?: string, limit: number = 200, offset: number = 0): Promise<MindbodyApiResponse<MindbodyActiveMembership>> {
        const params = new URLSearchParams({
            Limit: limit.toString(),
            Offset: offset.toString(),
        })

        if (clientId) {
            params.set('ClientId', clientId)
        }

        return this.request<MindbodyApiResponse<MindbodyActiveMembership>>(`/client/activeclientmemberships?${params.toString()}`)
    }

    /**
     * Get all active memberships with pagination
     */
    async getAllActiveClientMemberships(): Promise<MindbodyActiveMembership[]> {
        const allMemberships: MindbodyActiveMembership[] = []
        let offset = 0
        const limit = 200

        while (true) {
            const response = await this.getActiveClientMemberships(undefined, limit, offset)
            const memberships = response.ClientMemberships || []
            allMemberships.push(...memberships)

            if (memberships.length < limit) break
            offset += limit
        }

        return allMemberships
    }
}
