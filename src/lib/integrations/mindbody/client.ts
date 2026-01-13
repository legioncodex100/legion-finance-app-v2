import { MINDBODY_CONFIG, getMindbodyEnv, hasMindbodyStaffCredentials } from './config'
import type { MindbodyApiResponse, MindbodySale } from './types'

/**
 * Get staff user token for API access
 */
async function getStaffUserToken(): Promise<string> {
    const env = getMindbodyEnv()

    if (!hasMindbodyStaffCredentials()) {
        throw new Error('Staff credentials not configured')
    }

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
    return data.AccessToken
}

/**
 * Mindbody API Client
 * Uses API Key + Staff Token authentication
 */
export class MindbodyClient {
    private apiKey: string
    private siteId: string
    private staffToken: string | null = null

    constructor(apiKey?: string, siteId?: string) {
        const env = getMindbodyEnv()
        this.apiKey = apiKey || env.apiKey
        this.siteId = siteId || env.siteId
    }

    /**
     * Ensure we have a valid staff token
     */
    private async ensureToken(): Promise<string> {
        if (!this.staffToken) {
            this.staffToken = await getStaffUserToken()
        }
        return this.staffToken
    }

    /**
     * Make authenticated request to Mindbody API
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = await this.ensureToken()
        const url = `${MINDBODY_CONFIG.apiBaseUrl}${endpoint}`

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

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Mindbody API error (${response.status}): ${errorText}`)
        }

        return response.json()
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
    async getContracts(locationId?: number, limit: number = 200, offset: number = 0): Promise<any> {
        const params = new URLSearchParams({
            Limit: limit.toString(),
            Offset: offset.toString(),
        })

        if (locationId) {
            params.set('LocationId', locationId.toString())
        }

        return this.request<any>(`/sale/contracts?${params.toString()}`)
    }

    /**
     * Get all contracts/memberships with pagination
     */
    async getAllContracts(locationId?: number): Promise<any[]> {
        const allContracts: any[] = []
        let offset = 0
        const limit = 200

        while (true) {
            const response = await this.getContracts(locationId, limit, offset)
            const contracts = response.Contracts || []
            allContracts.push(...contracts)

            if (contracts.length < limit) break
            offset += limit
        }

        return allContracts
    }

    /**
     * Get clients with optional search
     * Use empty SearchText to get all clients
     * includeInactive: true to include cancelled/inactive members
     */
    async searchClients(searchText: string = '', limit: number = 200, offset: number = 0, includeInactive: boolean = true): Promise<any> {
        const params = new URLSearchParams()
        params.set('request.limit', limit.toString())
        params.set('request.offset', offset.toString())
        params.set('request.includeInactive', includeInactive.toString())

        if (searchText) {
            params.set('request.searchText', searchText)
        }

        return this.request<any>(`/client/clients?${params.toString()}`)
    }

    /**
     * Get all clients with pagination
     */
    async getAllClients(): Promise<any[]> {
        const allClients: any[] = []
        let offset = 0
        const limit = 200

        while (true) {
            const response = await this.searchClients('', limit, offset)
            const clients = response.Clients || []
            allClients.push(...clients)

            if (clients.length < limit) break
            offset += limit
        }

        return allClients
    }


    /**
     * Get client details (batched, max 20 per request)
     */
    async getClients(clientIds: string[]): Promise<any> {
        const params = new URLSearchParams()
        params.set('request.clientIds', clientIds.slice(0, 20).join(','))

        return this.request<any>(`/client/clients?${params.toString()}`)
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
    async getClasses(startDate: Date, endDate: Date, limit: number = 200): Promise<any> {
        const params = new URLSearchParams({
            StartDateTime: startDate.toISOString(),
            EndDateTime: endDate.toISOString(),
            Limit: limit.toString(),
        })

        return this.request<any>(`/class/classes?${params.toString()}`)
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
    async getServices(locationId?: number): Promise<any> {
        const params = new URLSearchParams()

        if (locationId) {
            params.set('LocationId', locationId.toString())
        }

        const queryString = params.toString()
        return this.request<any>(`/sale/services${queryString ? '?' + queryString : ''}`)
    }

    /**
     * Get all services with pricing
     */
    async getAllServices(locationId?: number): Promise<any[]> {
        const response = await this.getServices(locationId)
        return response.Services || []
    }

    // ============================================
    // ENRICHMENT LAYER ENDPOINTS
    // ============================================

    /**
     * Get sale transactions - includes SettlementId, EntryMethod, PaymentType
     * Critical for fee calculation and bank reconciliation
     */
    async getTransactions(startDate: Date, endDate: Date, limit: number = 200, offset: number = 0): Promise<any> {
        const params = new URLSearchParams()
        params.set('request.transactionStartDateTime', startDate.toISOString())
        params.set('request.transactionEndDateTime', endDate.toISOString())
        params.set('request.limit', limit.toString())
        params.set('request.offset', offset.toString())

        return this.request<any>(`/sale/transactions?${params.toString()}`)
    }

    /**
     * Get all transactions with pagination
     */
    async getAllTransactions(startDate: Date, endDate: Date): Promise<any[]> {
        const allTransactions: any[] = []
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
    async getActiveClientMemberships(clientId?: string, limit: number = 200, offset: number = 0): Promise<any> {
        const params = new URLSearchParams({
            Limit: limit.toString(),
            Offset: offset.toString(),
        })

        if (clientId) {
            params.set('ClientId', clientId)
        }

        return this.request<any>(`/client/activeclientmemberships?${params.toString()}`)
    }

    /**
     * Get all active memberships with pagination
     */
    async getAllActiveClientMemberships(): Promise<any[]> {
        const allMemberships: any[] = []
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
