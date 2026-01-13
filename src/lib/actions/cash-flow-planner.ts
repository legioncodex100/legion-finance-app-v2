"use server"

import { createClient } from "@/lib/supabase/server"

// Types for calendar planner
export interface ScheduledPayable {
    id: string
    name: string
    amount: number
    dueDate: string
    type: 'bill' | 'invoice' | 'payable'
    vendorName: string | null
    staffName: string | null
    categoryName: string | null
    isPaid: boolean
}

export interface ScheduledReceivable {
    id: string
    name: string
    amount: number
    dueDate: string
    clientName: string | null
    isPaid: boolean
}

export interface DateChange {
    id: string
    originalDate: string
    newDate: string
}

/**
 * Get all scheduled payables (bills, invoices, one-off items)
 * Excludes templates - only actual scheduled items
 */
export async function getScheduledPayables(startDate?: string, endDate?: string): Promise<ScheduledPayable[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Base query - get all non-template payables that aren't paid
    let query = supabase
        .from('payables')
        .select(`
            id,
            name,
            amount,
            next_due,
            is_paid,
            vendor_id,
            staff_id,
            category_id,
            vendors(name),
            staff(name),
            categories(name)
        `)
        .eq('user_id', user.id)
        .eq('is_template', false) // Exclude templates
        .not('next_due', 'is', null) // Must have a due date

    // Apply date filters if provided
    if (startDate) {
        query = query.gte('next_due', startDate)
    }
    if (endDate) {
        query = query.lte('next_due', endDate)
    }

    const { data, error } = await query.order('next_due')

    if (error) {
        console.error('Error fetching scheduled payables:', error)
        return []
    }

    return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        amount: Math.abs(p.amount),
        dueDate: p.next_due,
        type: 'payable' as const,
        vendorName: (p.vendors as any)?.name || null,
        staffName: (p.staff as any)?.name || null,
        categoryName: (p.categories as any)?.name || null,
        isPaid: p.is_paid || false
    }))
}

/**
 * Get scheduled receivables (Mindbody scheduled payments)
 */
export async function getScheduledReceivables(startDate?: string, endDate?: string): Promise<ScheduledReceivable[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Get scheduled payments from Mindbody
    let query = supabase
        .from('scheduled_payments')
        .select('*')
        .eq('user_id', user.id)
        .eq('payment_status', 'scheduled') // Only scheduled (not paid/failed)
        .not('scheduled_date', 'is', null)

    if (startDate) {
        query = query.gte('scheduled_date', startDate)
    }
    if (endDate) {
        query = query.lte('scheduled_date', endDate)
    }

    const { data, error } = await query.order('scheduled_date')

    if (error) {
        console.error('Error fetching scheduled payments:', error)
        return []
    }

    return (data || []).map(payment => ({
        id: payment.id,
        name: payment.member_name || 'Membership Payment',
        amount: Math.abs(payment.amount || 0),
        dueDate: payment.scheduled_date,
        clientName: payment.member_name || null,
        isPaid: payment.payment_status === 'paid'
    }))
}

/**
 * Apply date changes to payables (bulk update due dates)
 */
export async function applyScheduleChanges(changes: DateChange[]): Promise<{ success: boolean; updated: number; errors: string[] }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, updated: 0, errors: ['Unauthorized'] }

    const errors: string[] = []
    let updated = 0

    for (const change of changes) {
        const { error } = await supabase
            .from('payables')
            .update({ next_due: change.newDate })
            .eq('id', change.id)
            .eq('user_id', user.id)

        if (error) {
            errors.push(`Failed to update ${change.id}: ${error.message}`)
        } else {
            updated++
        }
    }

    return {
        success: errors.length === 0,
        updated,
        errors
    }
}

/**
 * Get calendar data for a month (all scheduled items)
 */
export async function getCalendarData(year: number, month: number): Promise<{
    payables: ScheduledPayable[]
    receivables: ScheduledReceivable[]
}> {
    // Calculate month date range
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0] // Last day of month

    const [payables, receivables] = await Promise.all([
        getScheduledPayables(startDate, endDate),
        getScheduledReceivables(startDate, endDate)
    ])

    return { payables, receivables }
}
