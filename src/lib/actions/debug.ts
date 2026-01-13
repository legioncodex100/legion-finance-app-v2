"use server"

import { createClient } from "@/lib/supabase/server"
import { MindbodyClient } from "@/lib/integrations/mindbody/client"

/**
 * Debug: Fetch raw client contracts from Mindbody API
 * Returns first 10 contracts with full structure for inspection
 */
export async function debugGetClientContracts(): Promise<{
    success: boolean
    contractCount: number
    sampleContracts: any[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, contractCount: 0, sampleContracts: [], error: "Unauthorized" }

    try {
        const client = new MindbodyClient()
        const contracts = await client.getAllClientContractsBulk()

        // Return first 10 for inspection
        return {
            success: true,
            contractCount: contracts.length,
            sampleContracts: contracts.slice(0, 10)
        }
    } catch (error) {
        return {
            success: false,
            contractCount: 0,
            sampleContracts: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Debug: Get scheduled payments from database
 */
export async function debugGetScheduledPayments(): Promise<{
    success: boolean
    count: number
    payments: any[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, count: 0, payments: [], error: "Unauthorized" }

    try {
        const { data: payments, error } = await supabase
            .from('scheduled_payments')
            .select('*')
            .eq('user_id', user.id)
            .eq('source', 'mindbody')
            .order('scheduled_date', { ascending: true })
            .limit(50)

        if (error) throw error

        return {
            success: true,
            count: payments?.length || 0,
            payments: payments || []
        }
    } catch (error) {
        return {
            success: false,
            count: 0,
            payments: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Debug: Get mb_members data sample
 */
export async function debugGetMembers(): Promise<{
    success: boolean
    count: number
    members: any[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, count: 0, members: [], error: "Unauthorized" }

    try {
        const { data: members, error, count } = await supabase
            .from('mb_members')
            .select('mb_client_id, first_name, last_name, membership_status, monthly_rate, next_payment_date, membership_name', { count: 'exact' })
            .eq('user_id', user.id)
            .order('monthly_rate', { ascending: false })
            .limit(20)

        if (error) throw error

        return {
            success: true,
            count: count || 0,
            members: members || []
        }
    } catch (error) {
        return {
            success: false,
            count: 0,
            members: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Debug: Test raw API call to a specific endpoint
 */
export async function debugRawApiCall(endpoint: string): Promise<{
    success: boolean
    data: any
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, data: null, error: "Unauthorized" }

    try {
        const client = new MindbodyClient()

        // Only allow safe GET endpoints
        const safeEndpoints = [
            'contracts',
            'clients',
            'memberships',
            'services',
            'activememberships',
            'salecontracts'
        ]

        if (!safeEndpoints.includes(endpoint)) {
            return { success: false, data: null, error: `Invalid endpoint: ${endpoint}` }
        }

        let data: any = null

        switch (endpoint) {
            case 'contracts':
                data = await client.getAllClientContractsBulk()
                break
            case 'clients':
                data = (await client.searchClients('', 10)).Clients?.slice(0, 10)
                break
            case 'memberships':
                data = await client.getAllActiveClientMemberships()
                break
            case 'activememberships':
                // Try without pagination first to see raw response
                const resp = await client.getActiveClientMemberships(undefined, 20)
                data = resp
                break
            case 'salecontracts':
                // Try sale/contracts endpoint
                data = await client.getAllContracts()
                break
            case 'services':
                data = await client.getAllServices()
                break
        }

        return { success: true, data }
    } catch (error) {
        return {
            success: false,
            data: null,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Debug: Get February 2026 forecast comparison
 */
export async function debugGetFeb2026Forecast(): Promise<{
    success: boolean
    count: number
    total: number
    payments: any[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, count: 0, total: 0, payments: [], error: "Unauthorized" }

    try {
        const { data: payments, error } = await supabase
            .from('scheduled_payments')
            .select('*')
            .eq('user_id', user.id)
            .eq('source', 'mindbody')
            .gte('scheduled_date', '2026-02-01')
            .lte('scheduled_date', '2026-02-28')
            .order('scheduled_date', { ascending: true })

        if (error) throw error

        const total = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

        return {
            success: true,
            count: payments?.length || 0,
            total,
            payments: payments || []
        }
    } catch (error) {
        return {
            success: false,
            count: 0,
            total: 0,
            payments: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Debug: Check contracts with autopay schedules
 * Fetches contracts for sample members to find autopay data
 */
export async function debugCheckAutopayContracts(): Promise<{
    success: boolean
    membersChecked: number
    contractsWithAutopay: any[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, membersChecked: 0, contractsWithAutopay: [], error: "Unauthorized" }

    try {
        const client = new MindbodyClient()

        // Get sample of members with monthly_rate > 0 (active payers)
        const { data: members, error } = await supabase
            .from('mb_members')
            .select('mb_client_id, first_name, last_name, monthly_rate, membership_status')
            .eq('user_id', user.id)
            .gt('monthly_rate', 0)
            .limit(15) // Sample size to avoid rate limits

        if (error) throw error

        const contractsWithAutopay: any[] = []

        for (const member of members || []) {
            try {
                // Fetch contracts for this specific client
                const contracts = await client.getClientContracts(member.mb_client_id)

                // Look for autopay schedule data
                if (contracts.Contracts && contracts.Contracts.length > 0) {
                    for (const contract of contracts.Contracts) {
                        if (contract.AutopaySchedule || contract.AutopayStatus) {
                            contractsWithAutopay.push({
                                clientId: member.mb_client_id,
                                clientName: `${member.first_name} ${member.last_name}`,
                                memberStatus: member.membership_status,
                                monthlyRate: member.monthly_rate,
                                contractName: contract.ContractName || contract.Name,
                                autopayStatus: contract.AutopayStatus,
                                autopaySchedule: contract.AutopaySchedule,
                                nextAutopayDate: contract.NextAutopayDate,
                                agreementDate: contract.AgreementDate
                            })
                        }
                    }
                }
            } catch (e) {
                // Skip failed clients, continue with others
                console.error(`Failed to fetch contracts for ${member.mb_client_id}:`, e)
            }
        }

        return {
            success: true,
            membersChecked: members?.length || 0,
            contractsWithAutopay
        }
    } catch (error) {
        return {
            success: false,
            membersChecked: 0,
            contractsWithAutopay: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Debug: Check Declined members data
 */
export async function debugCheckDeclinedMembers(): Promise<{
    success: boolean
    total: number
    withNextPayment: number
    withoutNextPayment: number
    sample: any[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, total: 0, withNextPayment: 0, withoutNextPayment: 0, sample: [], error: "Unauthorized" }

    try {
        const { data: members, error } = await supabase
            .from('mb_members')
            .select('mb_client_id, first_name, last_name, monthly_rate, membership_status, next_payment_date, last_visit_date')
            .eq('user_id', user.id)
            .eq('membership_status', 'Declined')
            .gt('monthly_rate', 0)
            .limit(50)

        if (error) throw error

        const withNextPayment = members?.filter(m => m.next_payment_date).length || 0
        const withoutNextPayment = members?.filter(m => !m.next_payment_date).length || 0

        return {
            success: true,
            total: members?.length || 0,
            withNextPayment,
            withoutNextPayment,
            sample: members?.slice(0, 10) || []
        }
    } catch (error) {
        return {
            success: false,
            total: 0,
            withNextPayment: 0,
            withoutNextPayment: 0,
            sample: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Debug: Check scheduled payments breakdown by week (for Cash Flow)
 */
export async function debugCheckCashFlowScheduled(): Promise<{
    success: boolean
    totalPayments: number
    totalAmount: number
    byWeek: Array<{ weekStart: string; weekEnd: string; count: number; total: number }>
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, totalPayments: 0, totalAmount: 0, byWeek: [], error: "Unauthorized" }

    try {
        const weeks = 12
        const futureEndDate = new Date()
        futureEndDate.setDate(futureEndDate.getDate() + (weeks * 7))

        const { data: scheduledPayments, error } = await supabase
            .from('scheduled_payments')
            .select('*')
            .eq('user_id', user.id)
            .eq('payment_status', 'scheduled')
            .gte('scheduled_date', new Date().toISOString().split('T')[0])
            .lte('scheduled_date', futureEndDate.toISOString().split('T')[0])

        if (error) throw error

        const today = new Date()
        const byWeek: Array<{ weekStart: string; weekEnd: string; count: number; total: number }> = []

        for (let w = 0; w < weeks; w++) {
            const weekStart = new Date(today)
            weekStart.setDate(today.getDate() + (w * 7))
            weekStart.setHours(0, 0, 0, 0)

            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekStart.getDate() + 6)

            const weekPayments = scheduledPayments?.filter(p => {
                const d = new Date(p.scheduled_date)
                return d >= weekStart && d <= weekEnd
            }) || []

            byWeek.push({
                weekStart: weekStart.toISOString().split('T')[0],
                weekEnd: weekEnd.toISOString().split('T')[0],
                count: weekPayments.length,
                total: weekPayments.reduce((sum, p) => sum + Number(p.amount), 0)
            })
        }

        return {
            success: true,
            totalPayments: scheduledPayments?.length || 0,
            totalAmount: scheduledPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
            byWeek
        }
    } catch (error) {
        return {
            success: false,
            totalPayments: 0,
            totalAmount: 0,
            byWeek: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Debug: Check all payables and their status
 */
export async function debugCheckPayablesStatus(): Promise<{
    success: boolean
    total: number
    byStatus: Record<string, number>
    byPaid: { paid: number; unpaid: number }
    sample: any[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, total: 0, byStatus: {}, byPaid: { paid: 0, unpaid: 0 }, sample: [], error: "Unauthorized" }

    try {
        const { data: payables, error } = await supabase
            .from('payables')
            .select('id, name, amount, next_due, bill_status, is_paid, vendor:vendor_id(name), staff:staff_id(name)')
            .eq('user_id', user.id)
            .limit(50)

        if (error) throw error

        const byStatus: Record<string, number> = {}
        let paid = 0, unpaid = 0
        for (const p of payables || []) {
            byStatus[p.bill_status || 'unknown'] = (byStatus[p.bill_status || 'unknown'] || 0) + 1
            if (p.is_paid) paid++; else unpaid++
        }

        return {
            success: true,
            total: payables?.length || 0,
            byStatus,
            byPaid: { paid, unpaid },
            sample: (payables || []).slice(0, 10).map(p => ({
                name: (p.vendor as any)?.name || (p.staff as any)?.name || p.name,
                amount: p.amount,
                status: p.bill_status,
                is_paid: p.is_paid,
                next_due: p.next_due
            }))
        }
    } catch (error) {
        return {
            success: false,
            total: 0,
            byStatus: {},
            byPaid: { paid: 0, unpaid: 0 },
            sample: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Migration: Find transactions with legacy bill_id or invoice_id links
 * and optionally clear them so they can be re-linked to payables
 */
export async function migrateLegacyBillInvoiceLinks(options?: {
    previewOnly?: boolean
}): Promise<{
    success: boolean
    billLinks: number
    invoiceLinks: number
    cleared: number
    sample: { id: string; description: string | null; amount: number; bill_id?: string; invoice_id?: string }[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return {
        success: false,
        billLinks: 0,
        invoiceLinks: 0,
        cleared: 0,
        sample: [],
        error: "Unauthorized"
    }

    try {
        // Find transactions with bill_id
        const { data: withBills, error: billError } = await supabase
            .from('transactions')
            .select('id, description, amount, bill_id')
            .eq('user_id', user.id)
            .not('bill_id', 'is', null)

        if (billError) throw billError

        // Find transactions with invoice_id
        const { data: withInvoices, error: invoiceError } = await supabase
            .from('transactions')
            .select('id, description, amount, invoice_id')
            .eq('user_id', user.id)
            .not('invoice_id', 'is', null)

        if (invoiceError) throw invoiceError

        const billLinks = withBills?.length || 0
        const invoiceLinks = withInvoices?.length || 0

        // Combine samples
        const sample = [
            ...(withBills || []).slice(0, 5).map(t => ({
                id: t.id,
                description: t.description,
                amount: t.amount,
                bill_id: t.bill_id
            })),
            ...(withInvoices || []).slice(0, 5).map(t => ({
                id: t.id,
                description: t.description,
                amount: t.amount,
                invoice_id: t.invoice_id
            }))
        ]

        // If preview only, just return counts
        if (options?.previewOnly) {
            return {
                success: true,
                billLinks,
                invoiceLinks,
                cleared: 0,
                sample
            }
        }

        // Clear bill_id links
        let cleared = 0
        if (billLinks > 0) {
            const { error: clearBillError } = await supabase
                .from('transactions')
                .update({ bill_id: null })
                .eq('user_id', user.id)
                .not('bill_id', 'is', null)

            if (clearBillError) throw clearBillError
            cleared += billLinks
        }

        // Clear invoice_id links
        if (invoiceLinks > 0) {
            const { error: clearInvoiceError } = await supabase
                .from('transactions')
                .update({ invoice_id: null })
                .eq('user_id', user.id)
                .not('invoice_id', 'is', null)

            if (clearInvoiceError) throw clearInvoiceError
            cleared += invoiceLinks
        }

        return {
            success: true,
            billLinks,
            invoiceLinks,
            cleared,
            sample
        }
    } catch (error: any) {
        return {
            success: false,
            billLinks: 0,
            invoiceLinks: 0,
            cleared: 0,
            sample: [],
            error: error?.message || error?.details || JSON.stringify(error) || 'Unknown error'
        }
    }
}
