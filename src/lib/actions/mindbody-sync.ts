"use server"

import { createClient } from "@/lib/supabase/server"
import { MindbodyClient } from "@/lib/integrations/mindbody/client"
import { getMindbodyEnv } from "@/lib/integrations/mindbody/config"
import { calculateChurnRisk } from "@/lib/integrations/mindbody/bi-types"
import { logSync } from "./mindbody-bi"

/**
 * Sync members from Mindbody
 * - Fetches active memberships
 * - Updates mb_members table
 * - Calculates churn risk scores
 * - Detects declined memberships
 */
export async function syncMindbodyMembers(): Promise<{
    success: boolean
    synced: number
    declines: number
    apiCalls: number
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    let apiCalls = 0
    let synced = 0
    let newDeclines = 0

    try {
        const client = new MindbodyClient()

        // Fetch all clients (members)
        const clients = await client.getAllClients()
        apiCalls += Math.ceil(clients.length / 200) || 1

        // Map clients to members
        const memberMap = new Map<string, any>()

        for (const c of clients) {
            const clientId = c.Id?.toString()
            if (!clientId) continue

            // Parse Status field to determine membership status
            // Status field shows membership name/tier for members, or "Non-Member" if not
            const status = c.Status || ''
            const statusLower = status.toLowerCase()
            const isNonMember = statusLower === 'non-member'
            const isExpired = statusLower.includes('expired')
            const isSuspended = statusLower.includes('suspended')
            const isDeclined = statusLower.includes('declined')
            const isTerminated = statusLower.includes('terminated')

            let membershipStatus = 'Active'  // Default for active membership tiers
            if (isNonMember) membershipStatus = 'Non-Member'
            else if (isDeclined) membershipStatus = 'Declined'
            else if (isSuspended) membershipStatus = 'Suspended'
            else if (isTerminated) membershipStatus = 'Terminated'
            else if (isExpired) membershipStatus = 'Expired'

            memberMap.set(clientId, {
                mb_client_id: clientId,
                first_name: c.FirstName || null,
                last_name: c.LastName || null,
                email: c.Email || null,
                phone: c.MobilePhone || c.HomePhone || null,
                date_of_birth: c.BirthDate?.split('T')[0] || null,
                gender: c.Gender || null,
                address_line1: c.AddressLine1 || c.Address || null,
                address_city: c.City || null,
                address_state: c.State || null,
                address_postal_code: c.PostalCode || null,
                creation_date: c.CreationDate?.split('T')[0] || null,
                member_type: isNonMember ? 'non_member' : 'monthly',
                membership_name: status || null,
                membership_status: membershipStatus,
                monthly_rate: 0,
                next_payment_date: null,
                contract_end_date: null,
            })
        }

        // Use TRANSACTIONS to determine truly active members
        // A member is Active if they have a successful transaction in the last 45 days
        const { data: recentTransactions } = await supabase
            .from('mb_transactions')
            .select('mb_client_id, status')
            .eq('user_id', user.id)
            .in('status', ['Approved', 'Scheduled'])  // Successful or scheduled payments
            .gte('transaction_date', new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

        // Create set of client IDs with recent payments
        const activeClientIds = new Set<string>()
        for (const tx of recentTransactions || []) {
            if (tx.mb_client_id) activeClientIds.add(tx.mb_client_id)
        }

        console.log(`Members with recent transactions (45 days): ${activeClientIds.size}`)

        // Update membership_status based on transactions
        for (const [clientId, member] of memberMap) {
            if (activeClientIds.has(clientId)) {
                // This client has paid recently
                member.membership_status = 'Active'
            } else if (member.membership_status === 'Active') {
                // Client was marked Active but no recent payment - they're Expired
                member.membership_status = 'Expired'
            }
            // Keep other statuses (Declined, Suspended, Non-Member) as-is
        }

        // Fetch existing members for comparison
        const { data: existingMembers } = await supabase
            .from('mb_members')
            .select('mb_client_id, membership_status, visits_30d, visits_prev_30d, last_visit_date')
            .eq('user_id', user.id)

        const existingMap = new Map(
            (existingMembers || []).map(m => [m.mb_client_id, m])
        )

        // Upsert members
        for (const [clientId, member] of memberMap) {
            const existing = existingMap.get(clientId)

            // Calculate churn risk
            const churnRisk = calculateChurnRisk({
                ...member,
                last_visit_date: existing?.last_visit_date,
                visits_30d: existing?.visits_30d || 0,
                visits_prev_30d: existing?.visits_prev_30d || 0,
            })

            // Check for new declines
            if (
                member.membership_status === 'Declined' &&
                existing?.membership_status !== 'Declined'
            ) {
                // New decline detected - create decline record
                await supabase.from('mb_declines').insert({
                    user_id: user.id,
                    mb_client_id: clientId,
                    member_name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
                    email: member.email,
                    phone: member.phone,
                    amount: member.monthly_rate,
                    decline_date: new Date().toISOString().split('T')[0],
                    status: 'new',
                })
                newDeclines++
            }

            // Upsert member
            await supabase.from('mb_members').upsert({
                user_id: user.id,
                mb_client_id: clientId,
                ...member,
                churn_risk: churnRisk,
                synced_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,mb_client_id'
            })

            synced++
        }

        // Log the sync
        await logSync('members', synced, apiCalls, true)

        return { success: true, synced, declines: newDeclines, apiCalls }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Sync failed'
        await logSync('members', synced, apiCalls, false, errorMessage)
        return { success: false, synced, declines: newDeclines, apiCalls, error: errorMessage }
    }
}

/**
 * Sync class metrics for a date range
 */
export async function syncClassMetrics(
    startDate: Date = new Date(),
    endDate: Date = new Date()
): Promise<{
    success: boolean
    synced: number
    apiCalls: number
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    let apiCalls = 0
    let synced = 0

    try {
        const client = new MindbodyClient()

        // Fetch classes
        const response = await client.getClasses(startDate, endDate)
        apiCalls++

        const classes = response.Classes || []

        for (const cls of classes) {
            const fillRate = cls.MaxCapacity > 0
                ? Math.round((cls.TotalBooked / cls.MaxCapacity) * 100) / 100
                : 0

            await supabase.from('mb_class_metrics').upsert({
                user_id: user.id,
                class_date: cls.StartDateTime?.split('T')[0],
                class_name: cls.ClassDescription?.Name || cls.Name || 'Unknown',
                class_time: cls.StartDateTime?.split('T')[1]?.substring(0, 5) || null,
                instructor: cls.Staff?.Name || null,
                capacity: cls.MaxCapacity || 0,
                booked: cls.TotalBooked || 0,
                attended: cls.TotalBooked || 0, // Will be updated after class
                no_shows: 0,
                fill_rate: fillRate,
            }, {
                onConflict: 'user_id,class_date,class_name,class_time'
            })

            synced++
        }

        await logSync('classes', synced, apiCalls, true)
        return { success: true, synced, apiCalls }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Sync failed'
        await logSync('classes', synced, apiCalls, false, errorMessage)
        return { success: false, synced, apiCalls, error: errorMessage }
    }
}

/**
 * Sync membership pricing from sales data
 * Looks at recent sales to determine member monthly rates
 */
export async function syncMembershipPricing(
    daysBack: number = 90
): Promise<{
    success: boolean
    membersUpdated: number
    apiCalls: number
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    let apiCalls = 0
    let membersUpdated = 0

    try {
        const client = new MindbodyClient()

        // Fetch sales from the last N days
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - daysBack)

        const sales = await client.getAllSales(startDate, endDate)
        apiCalls += Math.ceil(sales.length / 200) || 1

        // Map to track best pricing per client
        // Looks for recurring membership purchases
        const memberPricing = new Map<string, {
            monthly_rate: number
            membership_name: string
            member_type: string
        }>()

        for (const sale of sales) {
            const clientId = sale.ClientId?.toString()
            if (!clientId) continue

            for (const item of sale.Items || []) {
                // Look for memberships/packages (not products)
                if (item.Type === 'Service' || item.Type === 'Package') {
                    const itemName = item.Name?.toLowerCase() || ''

                    // Determine member type from item name
                    let memberType = 'pack'
                    let monthlyRate = item.Price || 0

                    // Check if it's a monthly membership
                    if (itemName.includes('month') || itemName.includes('unlimited') ||
                        itemName.includes('membership')) {
                        memberType = 'monthly'
                    } else if (itemName.includes('drop') || itemName.includes('trial')) {
                        memberType = 'drop_in'
                    }

                    const current = memberPricing.get(clientId)

                    // Prefer monthly memberships over packs
                    if (!current ||
                        (memberType === 'monthly' && current.member_type !== 'monthly') ||
                        (memberType === current.member_type && monthlyRate > current.monthly_rate)) {
                        memberPricing.set(clientId, {
                            monthly_rate: monthlyRate,
                            membership_name: item.Name || 'Unknown',
                            member_type: memberType
                        })
                    }
                }
            }
        }

        // Update members with pricing info
        for (const [clientId, pricing] of memberPricing) {
            const { error } = await supabase
                .from('mb_members')
                .update({
                    monthly_rate: pricing.monthly_rate,
                    membership_name: pricing.membership_name,
                    member_type: pricing.member_type,
                    synced_at: new Date().toISOString()
                })
                .eq('user_id', user.id)
                .eq('mb_client_id', clientId)

            if (!error) membersUpdated++
        }

        await logSync('pricing', membersUpdated, apiCalls, true)
        return { success: true, membersUpdated, apiCalls }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Sync failed'
        await logSync('pricing', membersUpdated, apiCalls, false, errorMessage)
        return { success: false, membersUpdated, apiCalls, error: errorMessage }
    }
}

/**
 * Run full sync (members + pricing + today's classes)
 * Uses single MindbodyClient instance to minimize token requests
 */
export async function runFullMindbodySync(): Promise<{
    members: { synced: number; declines: number; error?: string }
    pricing: { updated: number; error?: string }
    classes: { synced: number; error?: string }
    apiCalls: number
    success: boolean
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // OPTIMIZATION: Create single client instance for all sync operations
    // This ensures only 1 token request per full sync instead of 3
    const mbClient = new MindbodyClient()

    let totalApiCalls = 0
    const errors: string[] = []

    // === MEMBERS SYNC ===
    let membersSynced = 0
    let newDeclines = 0
    let memberError: string | undefined

    try {
        const clients = await mbClient.getAllClients()
        totalApiCalls += Math.ceil(clients.length / 200) || 1

        const memberMap = new Map<string, any>()

        for (const c of clients) {
            const clientId = c.Id?.toString()
            if (!clientId) continue

            // Status field shows "Non-Member" if not a member, or the membership name if they are
            // Active field is just whether the client record is active
            const status = c.Status || ''
            const isNonMember = status.toLowerCase() === 'non-member'
            const isExpired = status.toLowerCase().includes('expired')
            const isSuspended = status.toLowerCase().includes('suspended')
            const isDeclined = status.toLowerCase().includes('declined')

            let membershipStatus = 'Active'
            if (isNonMember) membershipStatus = 'Non-Member'
            else if (isExpired) membershipStatus = 'Expired'
            else if (isSuspended) membershipStatus = 'Suspended'
            else if (isDeclined) membershipStatus = 'Declined'

            memberMap.set(clientId, {
                mb_client_id: clientId,
                first_name: c.FirstName || null,
                last_name: c.LastName || null,
                email: c.Email || null,
                phone: c.MobilePhone || c.HomePhone || null,
                date_of_birth: c.BirthDate?.split('T')[0] || null,
                gender: c.Gender || null,
                address_line1: c.AddressLine1 || c.Address || null,
                address_city: c.City || null,
                address_state: c.State || null,
                address_postal_code: c.PostalCode || null,
                creation_date: c.CreationDate?.split('T')[0] || null,
                member_type: isNonMember ? 'non_member' : 'monthly',
                membership_name: status || null,
                membership_status: membershipStatus,
                monthly_rate: 0,
                next_payment_date: null,
                contract_end_date: null,
            })
        }

        // Use TRANSACTIONS to determine truly active members
        // A member is Active if they have a successful transaction in the last 45 days
        const { data: recentTransactions } = await supabase
            .from('mb_transactions')
            .select('mb_client_id, status, transaction_date')
            .eq('user_id', user.id)
            .in('status', ['Approved', 'Scheduled'])
            .gte('transaction_date', new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('transaction_date', { ascending: false })

        // Create map of client IDs with their most recent transaction date
        const activeClientDates = new Map<string, string>()
        for (const tx of recentTransactions || []) {
            if (tx.mb_client_id && !activeClientDates.has(tx.mb_client_id)) {
                activeClientDates.set(tx.mb_client_id, tx.transaction_date)
            }
        }

        console.log(`runFullMindbodySync: Members with recent transactions: ${activeClientDates.size}`)

        // Update membership_status and calculate next_payment_date
        for (const [clientId, member] of memberMap) {
            if (activeClientDates.has(clientId)) {
                member.membership_status = 'Active'

                // Calculate next_payment_date as last transaction + 1 month
                const lastPayment = new Date(activeClientDates.get(clientId)!)
                lastPayment.setMonth(lastPayment.getMonth() + 1)
                member.next_payment_date = lastPayment.toISOString().split('T')[0]
            } else if (member.membership_status === 'Active') {
                member.membership_status = 'Expired'
            }
        }

        const { data: existingMembers } = await supabase
            .from('mb_members')
            .select('mb_client_id, membership_status, visits_30d, visits_prev_30d, last_visit_date')
            .eq('user_id', user.id)

        const existingMap = new Map(
            (existingMembers || []).map(m => [m.mb_client_id, m])
        )

        // Prepare all member records for batch upsert
        const memberRecords: any[] = []

        for (const [clientId, member] of memberMap) {
            const existing = existingMap.get(clientId)
            const churnRisk = calculateChurnRisk({
                visits_30d: existing?.visits_30d || 0,
                visits_prev_30d: existing?.visits_prev_30d || 0,
                last_visit_date: existing?.last_visit_date || null,
                membership_status: member.membership_status,
                contract_end_date: member.contract_end_date
            })

            if (existing?.membership_status !== 'Declined' && member.membership_status === 'Declined') {
                await supabase.from('mb_declines').insert({
                    user_id: user.id,
                    mb_client_id: clientId,
                    member_name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
                    email: member.email,
                    phone: member.phone,
                    amount: member.monthly_rate,
                    decline_date: new Date().toISOString().split('T')[0],
                    status: 'new',
                })
                newDeclines++
            }

            memberRecords.push({
                user_id: user.id,
                mb_client_id: clientId,
                ...member,
                churn_risk: churnRisk,
                synced_at: new Date().toISOString(),
            })
        }

        // Batch upsert in chunks of 500
        const batchSize = 500
        for (let i = 0; i < memberRecords.length; i += batchSize) {
            const batch = memberRecords.slice(i, i + batchSize)
            const { error } = await supabase.from('mb_members').upsert(batch, {
                onConflict: 'user_id,mb_client_id'
            })
            if (error) {
                console.error(`Batch upsert error at ${i}:`, error.message)
            }
        }

        membersSynced = memberRecords.length
    } catch (error) {
        memberError = error instanceof Error ? error.message : 'Members sync failed'
        errors.push(`Members: ${memberError}`)
    }

    // === PRICING SYNC ===
    let pricingUpdated = 0
    let pricingError: string | undefined

    try {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setFullYear(startDate.getFullYear() - 1) // Go back 1 YEAR

        const sales = await mbClient.getAllSales(startDate, endDate)
        totalApiCalls += Math.ceil(sales.length / 200) || 1

        const memberPricing = new Map<string, {
            monthly_rate: number
            membership_name: string
            member_type: string
            exp_date: string | null
            is_active: boolean
        }>()

        const today = new Date()

        for (const sale of sales) {
            const clientId = sale.ClientId?.toString()
            if (!clientId) continue

            // Use PurchasedItems (actual API field)
            const items = (sale as any).PurchasedItems || sale.Items || []
            for (const item of items) {
                const isService = item.IsService === true || item.Type === 'Service' || item.Type === 'Package'
                if (!isService) continue

                const itemName = (item.Description || item.Name || '').toLowerCase()
                let memberType = 'monthly' // Default to monthly for auto-pay
                let monthlyRate = item.UnitPrice || item.Price || item.TotalAmount || 0

                // Determine member type from item name
                // Both "Unlimited" AND "Pack" are auto-pay recurring = monthly
                if (itemName.includes('payg')) {
                    memberType = 'drop_in' // Pay as you go
                } else if (itemName.includes('intro') || itemName.includes('trial') || itemName.includes('free')) {
                    memberType = 'drop_in' // Trial/intro sessions
                } else if (itemName.includes('unlimited') || itemName.includes('pack')) {
                    memberType = 'monthly' // Auto-pay memberships (unlimited OR pack)
                }

                // Check if membership is active based on ExpDate
                const expDate = item.ExpDate ? new Date(item.ExpDate) : null
                const isActive = expDate ? expDate > today : false

                const current = memberPricing.get(clientId)
                // Prefer active memberships and higher value
                if (!current ||
                    (isActive && !current.is_active) ||
                    (isActive === current.is_active && monthlyRate > current.monthly_rate)) {
                    memberPricing.set(clientId, {
                        monthly_rate: monthlyRate,
                        membership_name: item.Description || item.Name || 'Unknown',
                        member_type: memberType,
                        exp_date: item.ExpDate?.split('T')[0] || null,
                        is_active: isActive
                    })
                }
            }
        }

        // Update members with pricing info (but DON'T override membership_status - that comes from the clients API)
        for (const [clientId, pricing] of memberPricing) {
            const { error } = await supabase
                .from('mb_members')
                .update({
                    monthly_rate: pricing.monthly_rate,
                    // Don't override membership_name - keep the one from clients API Status field
                    member_type: pricing.member_type,
                    contract_end_date: pricing.exp_date,
                    // Note: NOT updating membership_status here - that's set from clients API
                    synced_at: new Date().toISOString()
                })
                .eq('user_id', user.id)
                .eq('mb_client_id', clientId)

            if (!error) pricingUpdated++
        }
    } catch (error) {
        pricingError = error instanceof Error ? error.message : 'Pricing sync failed'
        errors.push(`Pricing: ${pricingError}`)
    }

    // === CLASSES SYNC ===
    let classesSynced = 0
    let classError: string | undefined

    try {
        const today = new Date()
        const classes = await mbClient.getClasses(today, today)
        totalApiCalls += 1

        for (const cls of classes.Classes || []) {
            const classDate = cls.StartDateTime?.split('T')[0]
            const classTime = cls.StartDateTime?.split('T')[1]?.slice(0, 5)

            if (!classDate) continue

            await supabase.from('mb_class_metrics').upsert({
                user_id: user.id,
                class_date: classDate,
                class_name: cls.ClassDescription?.Name || cls.Name || 'Unknown',
                class_time: classTime,
                instructor: cls.Staff?.Name || cls.Staff?.FirstName || null,
                capacity: cls.MaxCapacity || 0,
                booked: cls.TotalBooked || 0,
                fill_rate: cls.MaxCapacity ? Math.round((cls.TotalBooked / cls.MaxCapacity) * 100) : 0,
            }, {
                onConflict: 'user_id,class_date,class_name,class_time'
            })

            classesSynced++
        }
    } catch (error) {
        classError = error instanceof Error ? error.message : 'Classes sync failed'
        errors.push(`Classes: ${classError}`)
    }

    // === AUTOPAY FORECAST SYNC ===
    // Sync scheduled payments to integrate with Cash Flow
    try {
        const { syncMindbodyScheduledPayments } = await import('./mindbody-bi')
        await syncMindbodyScheduledPayments()
    } catch (error) {
        console.warn('Autopay forecast sync failed:', error)
        // Don't add to errors - this is non-critical
    }

    // Log the sync
    await logSync('full', membersSynced + pricingUpdated + classesSynced, totalApiCalls, errors.length === 0)

    return {
        members: { synced: membersSynced, declines: newDeclines, error: memberError },
        pricing: { updated: pricingUpdated, error: pricingError },
        classes: { synced: classesSynced, error: classError },
        apiCalls: totalApiCalls,
        success: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : undefined
    }
}

/**
 * Smart Mindbody Sync (like Starling Bank sync)
 * - Tracks last sync date
 * - Syncs transactions from last sync
 * - Updates scheduled → collected/declined status
 * - Syncs last visit date for churn analysis
 */
export async function smartMindbodySync(fromDate?: string): Promise<{
    success: boolean
    transactions: { synced: number; errors: string[] }
    scheduledUpdated: number
    lastVisitsUpdated: number
    lastSyncDate: string
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const errors: string[] = []
    const client = new MindbodyClient()

    // Calculate sync range
    const endDate = new Date()
    let startDate: Date

    if (fromDate) {
        startDate = new Date(fromDate)
    } else {
        // Default to 7 days if no last sync
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 7)
    }

    console.log(`[SMART SYNC] Syncing from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // === 1. SYNC TRANSACTIONS ===
    let transactionsSynced = 0
    let transactionErrors: string[] = []

    try {
        const transactions = await client.getAllTransactions(startDate, endDate)
        console.log(`[SMART SYNC] Fetched ${transactions.length} transactions from Mindbody`)

        const records = transactions.map((tx: any) => {
            const amount = tx.NetAmount || tx.Amount || 0
            const paymentType = tx.PaymentType || tx.Method || ''
            const status = tx.Status || tx.TransactionStatus || 'Unknown'

            return {
                user_id: user.id,
                mb_client_id: tx.ClientId?.toString() || null,
                mb_sale_id: tx.SaleId?.toString() || tx.Id?.toString() || '',
                mb_transaction_id: tx.TransactionId?.toString() || tx.Id?.toString() || '',
                gross_amount: tx.GrossAmount || tx.Amount || 0,
                net_amount: amount,
                payment_type: paymentType,
                status: status,
                decline_reason: tx.DeclineReason || null,
                description: tx.Description || tx.ItemName || null,
                transaction_date: tx.TransactionTime || tx.SaleDateTime || tx.TransactionDate || new Date().toISOString(),
                synced_at: new Date().toISOString(),
            }
        })

        // Batch upsert
        const batchSize = 500
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize)
            const { error } = await supabase.from('mb_transactions').upsert(batch, {
                onConflict: 'user_id,mb_transaction_id'
            })
            if (error) {
                transactionErrors.push(`Batch ${i}: ${error.message}`)
            } else {
                transactionsSynced += batch.length
            }
        }
    } catch (e) {
        transactionErrors.push(e instanceof Error ? e.message : 'Transaction sync failed')
    }

    // === 2. UPDATE SCHEDULED PAYMENT STATUSES ===
    let scheduledUpdated = 0
    try {
        // Get scheduled payments that haven't been marked collected yet
        const { data: scheduled } = await supabase
            .from('scheduled_payments')
            .select('id, client_name, scheduled_date, amount')
            .eq('user_id', user.id)
            .eq('source', 'mindbody')
            .eq('payment_status', 'scheduled')

        if (scheduled && scheduled.length > 0) {
            // Check which ones now have matching transactions
            const scheduledDates = scheduled.map(s => s.scheduled_date)
            const minDate = scheduledDates.reduce((a, b) => a < b ? a : b)
            const maxDate = scheduledDates.reduce((a, b) => a > b ? a : b)

            const { data: approvedTxs } = await supabase
                .from('mb_transactions')
                .select('transaction_date')
                .eq('user_id', user.id)
                .eq('status', 'Approved')
                .gte('transaction_date', minDate)
                .lte('transaction_date', maxDate)

            if (approvedTxs) {
                const txDates = new Set(approvedTxs.map(t => t.transaction_date?.split('T')[0]))
                const toUpdate: string[] = []

                for (const payment of scheduled) {
                    const paymentDate = new Date(payment.scheduled_date)
                    // Check ±2 days tolerance
                    for (let offset = -2; offset <= 2; offset++) {
                        const checkDate = new Date(paymentDate)
                        checkDate.setDate(checkDate.getDate() + offset)
                        if (txDates.has(checkDate.toISOString().split('T')[0])) {
                            toUpdate.push(payment.id)
                            break
                        }
                    }
                }

                if (toUpdate.length > 0) {
                    await supabase
                        .from('scheduled_payments')
                        .update({ payment_status: 'collected' })
                        .in('id', toUpdate)
                    scheduledUpdated = toUpdate.length
                }
            }
        }
    } catch (e) {
        console.error('[SMART SYNC] Error updating scheduled payments:', e)
    }

    // === 3. SYNC LAST VISIT DATES FOR CHURN ===
    let lastVisitsUpdated = 0
    try {
        // Get all active members who need last visit updated
        const { data: members } = await supabase
            .from('mb_members')
            .select('id, mb_client_id, last_visit_date')
            .eq('user_id', user.id)
            .eq('membership_status', 'Active')
            .limit(100) // Process in batches

        if (members && members.length > 0) {
            // For efficiency, get recent class visits in bulk
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90) // Look back 90 days

            for (const member of members) {
                try {
                    const visits = await client.getClientVisits(
                        member.mb_client_id,
                        thirtyDaysAgo,
                        new Date()
                    )

                    if (visits?.Visits && visits.Visits.length > 0) {
                        // Get most recent visit
                        const sortedVisits = visits.Visits.sort((a: any, b: any) =>
                            new Date(b.StartDateTime).getTime() - new Date(a.StartDateTime).getTime()
                        )
                        const lastVisit = sortedVisits[0]?.StartDateTime?.split('T')[0]

                        if (lastVisit && lastVisit !== member.last_visit_date) {
                            await supabase
                                .from('mb_members')
                                .update({ last_visit_date: lastVisit })
                                .eq('id', member.id)
                            lastVisitsUpdated++
                        }
                    }
                } catch (visitError) {
                    // Skip individual member errors
                    console.log(`[SMART SYNC] Could not get visits for ${member.mb_client_id}`)
                }
            }
        }
    } catch (e) {
        console.error('[SMART SYNC] Error syncing last visits:', e)
    }

    const lastSyncDate = endDate.toISOString().split('T')[0]
    console.log(`[SMART SYNC] Complete: ${transactionsSynced} txs, ${scheduledUpdated} scheduled updated, ${lastVisitsUpdated} visit dates`)

    return {
        success: transactionErrors.length === 0,
        transactions: { synced: transactionsSynced, errors: transactionErrors },
        scheduledUpdated,
        lastVisitsUpdated,
        lastSyncDate,
        error: transactionErrors.length > 0 ? transactionErrors.join('; ') : undefined
    }
}
