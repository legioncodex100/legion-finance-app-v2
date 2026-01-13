/**
 * Starling Bank API Client
 * Uses Personal Access Token for authentication
 */

// Use sandbox URL if STARLING_SANDBOX env var is set
const STARLING_BASE_URL = process.env.STARLING_SANDBOX === 'true'
    ? 'https://api-sandbox.starlingbank.com'
    : 'https://api.starlingbank.com'

// Types based on Starling API responses
export interface StarlingAccount {
    accountUid: string
    accountType: string
    defaultCategory: string
    currency: string
    createdAt: string
    name: string
}

export interface StarlingBalance {
    clearedBalance: { currency: string; minorUnits: number }
    effectiveBalance: { currency: string; minorUnits: number }
    pendingTransactions: { currency: string; minorUnits: number }
    availableToSpend: { currency: string; minorUnits: number }
}

export interface StarlingTransaction {
    feedItemUid: string
    categoryUid: string
    amount: { currency: string; minorUnits: number }
    sourceAmount: { currency: string; minorUnits: number }
    direction: 'IN' | 'OUT'
    updatedAt: string
    transactionTime: string
    settlementTime: string
    source: string
    status: string
    transactingApplicationUserUid?: string
    counterPartyType: string
    counterPartyUid?: string
    counterPartyName: string
    counterPartySubEntityUid?: string
    counterPartySubEntityName?: string
    counterPartySubEntityIdentifier?: string
    counterPartySubEntitySubIdentifier?: string
    reference?: string
    country: string
    spendingCategory: string
    userNote?: string
}

interface StarlingApiError {
    error: string
    error_description: string
}

class StarlingClient {
    private accessToken: string

    constructor(accessToken: string) {
        if (!accessToken) {
            throw new Error('Starling access token is required')
        }
        this.accessToken = accessToken
    }

    private async request<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${STARLING_BASE_URL}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Accept': 'application/json',
            },
        })

        if (!response.ok) {
            const error: StarlingApiError = await response.json().catch(() => ({
                error: 'unknown_error',
                error_description: `HTTP ${response.status}: ${response.statusText}`
            }))
            throw new Error(`Starling API Error: ${error.error_description || error.error}`)
        }

        return response.json()
    }

    /**
     * Get all accounts for the authenticated user
     */
    async getAccounts(): Promise<StarlingAccount[]> {
        const response = await this.request<{ accounts: StarlingAccount[] }>('/api/v2/accounts')
        return response.accounts
    }

    /**
     * Get the primary account (first account)
     */
    async getPrimaryAccount(): Promise<StarlingAccount | null> {
        const accounts = await this.getAccounts()
        return accounts[0] || null
    }

    /**
     * Get account balance
     */
    async getBalance(accountUid: string): Promise<StarlingBalance> {
        return this.request<StarlingBalance>(`/api/v2/accounts/${accountUid}/balance`)
    }

    /**
     * Get transactions between two dates
     * @param accountUid - Account UID
     * @param categoryUid - Category UID (usually defaultCategory from account)
     * @param from - Start date (ISO string)
     * @param to - End date (ISO string)
     */
    async getTransactions(
        accountUid: string,
        categoryUid: string,
        from: string,
        to: string
    ): Promise<StarlingTransaction[]> {
        const params = new URLSearchParams({
            minTransactionTimestamp: from,
            maxTransactionTimestamp: to,
        })

        const response = await this.request<{ feedItems: StarlingTransaction[] }>(
            `/api/v2/feed/account/${accountUid}/category/${categoryUid}/transactions-between?${params}`
        )

        return response.feedItems
    }

    /**
     * Get all savings goals (pots) for an account
     */
    async getSavingsGoals(accountUid: string): Promise<{ savingsGoals: Array<{ savingsGoalUid: string; name: string; totalSaved: { currency: string; minorUnits: number } }> }> {
        return this.request<{ savingsGoals: Array<{ savingsGoalUid: string; name: string; totalSaved: { currency: string; minorUnits: number } }> }>(
            `/api/v2/account/${accountUid}/savings-goals`
        )
    }

    /**
     * Get transactions for a specific savings goal (pot)
     * Uses the savings goal's category UID to fetch transactions
     */
    async getPotTransactions(
        accountUid: string,
        savingsGoalUid: string,
        from: string,
        to: string
    ): Promise<StarlingTransaction[]> {
        const params = new URLSearchParams({
            minTransactionTimestamp: from,
            maxTransactionTimestamp: to,
        })

        const response = await this.request<{ feedItems: StarlingTransaction[] }>(
            `/api/v2/feed/account/${accountUid}/category/${savingsGoalUid}/transactions-between?${params}`
        )

        return response.feedItems
    }

    /**
     * Get total balance including all savings goals
     */
    async getTotalBalance(accountUid: string): Promise<number> {
        try {
            // Get main balance
            const balance = await this.getBalance(accountUid)
            let total = balance.effectiveBalance?.minorUnits || 0
            console.log(`[STARLING BALANCE] Main account: £${StarlingClient.toMajorUnits(total).toFixed(2)}`)

            // Get savings goals and add their balances (if scope enabled)
            try {
                const response = await this.getSavingsGoals(accountUid) as any
                console.log(`[STARLING BALANCE] Savings goals response:`, JSON.stringify(response).substring(0, 500))
                // API returns savingsGoalList, not savingsGoals
                const savingsGoals = response?.savingsGoalList || response?.savingsGoals || []
                for (const goal of savingsGoals) {
                    const goalBalance = goal.totalSaved?.minorUnits || 0
                    console.log(`[STARLING BALANCE] Pot "${goal.name}": £${StarlingClient.toMajorUnits(goalBalance).toFixed(2)}`)
                    total += goalBalance
                }
            } catch (e) {
                console.log('[STARLING] Could not fetch savings goals (scope may not be enabled):', e)
            }

            console.log(`[STARLING BALANCE] Total: £${StarlingClient.toMajorUnits(total).toFixed(2)}`)
            return StarlingClient.toMajorUnits(total)
        } catch (e) {
            console.error('[STARLING] Error fetching total balance:', e)
            return 0
        }
    }

    /**
     * Convert Starling minor units to major units (pence to pounds)
     */
    static toMajorUnits(minorUnits: number): number {
        return minorUnits / 100
    }
}

/**
 * Create a Starling client using the environment variable
 */
export function createStarlingClient(): StarlingClient {
    const token = process.env.STARLING_ACCESS_TOKEN

    if (!token) {
        throw new Error('STARLING_ACCESS_TOKEN environment variable is not set')
    }

    return new StarlingClient(token)
}

export { StarlingClient }
