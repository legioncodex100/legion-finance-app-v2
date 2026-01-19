"use server"

import { createClient } from "@/lib/supabase/server"

// Types
export type PayeeType = 'vendor' | 'staff' | 'system'
export type BillStatus = 'draft' | 'approved' | 'scheduled' | 'paid' | 'voided' | 'overdue'
export type Frequency = 'one-time' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type PaymentMethod = 'bacs' | 'direct_debit' | 'card' | 'cash' | 'auto'

export interface Payable {
    id: string
    user_id: string
    name: string
    payee_type: PayeeType
    vendor_id: string | null
    staff_id: string | null
    amount: number
    amount_paid: number
    amount_tax: number
    frequency: Frequency
    next_due: string
    is_recurring: boolean
    bill_status: BillStatus
    is_paid: boolean
    last_paid_date: string | null
    is_system_generated: boolean
    is_variable_amount: boolean
    is_template: boolean
    template_id: string | null
    is_active: boolean
    use_smart_name: boolean
    is_ended: boolean
    ended_at: string | null
    linked_transaction_id: string | null
    reconciled_at: string | null
    document_url: string | null
    invoice_number: string | null
    notes: string | null
    description: string | null
    category_id: string | null
    auto_pay: boolean
    reminder_days: number
    payment_method: PaymentMethod
    created_at: string
    updated_at: string
    // Joined data
    vendors?: { name: string } | null
    staff?: { name: string } | null
    categories?: { name: string } | null
}

// ============= CRUD Operations =============

export async function getPayables(filters?: {
    status?: BillStatus | 'all'
    payeeType?: PayeeType | 'all'
    overdue?: boolean
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    let query = supabase
        .from('payables')
        .select('*, vendors(name), staff(name), categories(name)')
        .eq('user_id', user.id)
        .eq('is_template', false) // Exclude templates from normal payables list
        .order('next_due', { ascending: true })

    if (filters?.status && filters.status !== 'all') {
        query = query.eq('bill_status', filters.status)
    }

    if (filters?.payeeType && filters.payeeType !== 'all') {
        query = query.eq('payee_type', filters.payeeType)
    }

    if (filters?.overdue) {
        query = query.lt('next_due', new Date().toISOString().split('T')[0])
            .neq('bill_status', 'paid')
    }

    const { data, error } = await query
    if (error) throw error
    return data as Payable[]
}

export async function getTemplates() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data, error } = await supabase
        .from('payables')
        .select('*, vendors(name), staff(name), categories(name)')
        .eq('user_id', user.id)
        .eq('is_template', true)
        .order('name', { ascending: true })

    if (error) throw error
    return data as Payable[]
}

export async function getPayable(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data, error } = await supabase
        .from('payables')
        .select('*, vendors(name), staff(name), categories(name)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (error) throw error
    return data as Payable
}

export async function createPayable(data: {
    name: string
    payee_type?: PayeeType
    vendor_id?: string
    staff_id?: string
    amount: number
    amount_tax?: number
    frequency?: Frequency
    next_due: string
    is_recurring?: boolean
    bill_status?: BillStatus
    document_url?: string
    invoice_number?: string
    notes?: string
    description?: string
    category_id?: string
    auto_pay?: boolean
    reminder_days?: number
    payment_method?: PaymentMethod
    is_system_generated?: boolean
    is_variable_amount?: boolean
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: payable, error } = await supabase
        .from('payables')
        .insert({
            ...data,
            user_id: user.id
        })
        .select()
        .single()

    if (error) throw error
    return payable as Payable
}

export async function createTemplate(data: {
    name: string
    payee_type?: PayeeType
    vendor_id?: string
    staff_id?: string
    amount: number
    amount_tax?: number
    frequency: Frequency
    day_of_month?: number
    category_id?: string
    notes?: string
    auto_pay?: boolean
    is_variable_amount?: boolean
    use_smart_name?: boolean
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Templates don't have a real due date, but we store a placeholder
    const { data: template, error } = await supabase
        .from('payables')
        .insert({
            ...data,
            user_id: user.id,
            is_template: true,
            is_recurring: true,
            is_active: true,
            use_smart_name: data.use_smart_name ?? true, // Default to true
            next_due: '2099-12-31', // Placeholder - templates don't have due dates
            bill_status: 'scheduled'
        })
        .select()
        .single()

    if (error) throw error
    return template as Payable
}

export async function toggleTemplateActive(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get current state
    const { data: template } = await supabase
        .from('payables')
        .select('is_active')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (!template) throw new Error("Template not found")

    // Toggle
    const { error } = await supabase
        .from('payables')
        .update({ is_active: !template.is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true, is_active: !template.is_active }
}

export async function endTemplate(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('payables')
        .update({
            is_ended: true,
            is_active: false,
            ended_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function updatePayable(id: string, data: Partial<Omit<Payable, 'id' | 'user_id' | 'created_at'>>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('payables')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function deletePayable(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('payables')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

// ============= Reconciliation (Multi-Transaction Support) =============

export interface PayableTransaction {
    id: string
    payable_id: string
    transaction_id: string
    amount: number
    notes: string | null
    linked_at: string
}

/**
 * Get all transactions linked to a payable
 */
export async function getPayableTransactions(payableId: string): Promise<PayableTransaction[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data, error } = await supabase
        .from('payable_transactions')
        .select('*, transactions(transaction_date, amount, description, counterparty_name)')
        .eq('payable_id', payableId)
        .order('linked_at', { ascending: false })

    if (error) throw error
    return data || []
}

/**
 * Link a transaction to a payable (supports multiple transactions)
 */
export async function linkPayableToTransaction(payableId: string, transactionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Fetch payable to get total amount
    const { data: payable } = await supabase
        .from('payables')
        .select('amount, amount_paid')
        .eq('id', payableId)
        .single()

    if (!payable) throw new Error("Payable not found")

    // Fetch transaction to get payment amount and date
    const { data: transaction } = await supabase
        .from('transactions')
        .select('transaction_date, amount')
        .eq('id', transactionId)
        .single()

    if (!transaction) throw new Error("Transaction not found")

    const paidDate = transaction.transaction_date || new Date().toISOString().split('T')[0]
    const paymentAmount = Math.abs(Number(transaction.amount || 0))

    // Insert into junction table
    const { error: junctionError } = await supabase
        .from('payable_transactions')
        .insert({
            payable_id: payableId,
            transaction_id: transactionId,
            amount: paymentAmount,
            linked_by: user.id
        })

    if (junctionError) {
        if (junctionError.code === '23505') {
            throw new Error("This transaction is already linked to this bill")
        }
        throw junctionError
    }

    // Calculate new amount_paid from all linked transactions
    const { data: allLinks } = await supabase
        .from('payable_transactions')
        .select('amount')
        .eq('payable_id', payableId)

    const totalPaid = (allLinks || []).reduce((sum, link) => sum + Number(link.amount), 0)
    const totalAmount = Number(payable.amount)
    const isFullyPaid = totalPaid >= totalAmount

    // Update payable with new totals
    const { error: payableError } = await supabase
        .from('payables')
        .update({
            amount_paid: totalPaid,
            bill_status: isFullyPaid ? 'paid' : 'scheduled',
            is_paid: isFullyPaid,
            reconciled_at: isFullyPaid ? new Date().toISOString() : null,
            last_paid_date: paidDate
        })
        .eq('id', payableId)
        .eq('user_id', user.id)

    if (payableError) throw payableError

    // Update transaction
    const { error: txnError } = await supabase
        .from('transactions')
        .update({
            linked_payable_id: payableId,
            reconciliation_status: 'reconciled',
            confirmed: true
        })
        .eq('id', transactionId)
        .eq('user_id', user.id)

    if (txnError) throw txnError

    return { success: true, totalPaid, isFullyPaid }
}

/**
 * Retroactively link a paid payable to a transaction
 * Only sets the link - doesn't change paid status (for already-paid items)
 */
export async function linkPayableRetroactive(payableId: string, transactionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Fetch transaction to get amount and date
    const { data: transaction } = await supabase
        .from('transactions')
        .select('transaction_date, amount')
        .eq('id', transactionId)
        .single()

    const paidDate = transaction?.transaction_date || new Date().toISOString().split('T')[0]
    const paymentAmount = Math.abs(Number(transaction?.amount || 0))

    // Insert into junction table
    const { error: junctionError } = await supabase
        .from('payable_transactions')
        .insert({
            payable_id: payableId,
            transaction_id: transactionId,
            amount: paymentAmount,
            linked_by: user.id
        })

    if (junctionError && junctionError.code !== '23505') {
        throw junctionError
    }

    // Calculate new amount_paid from all linked transactions
    const { data: allLinks } = await supabase
        .from('payable_transactions')
        .select('amount')
        .eq('payable_id', payableId)

    const totalPaid = (allLinks || []).reduce((sum, link) => sum + Number(link.amount), 0)

    // Update payable with recalculated amount_paid
    const { error: payableError } = await supabase
        .from('payables')
        .update({
            amount_paid: totalPaid,
            reconciled_at: new Date().toISOString(),
            last_paid_date: paidDate
        })
        .eq('id', payableId)
        .eq('user_id', user.id)

    if (payableError) throw payableError

    // Update transaction
    const { error: txnError } = await supabase
        .from('transactions')
        .update({
            linked_payable_id: payableId,
            reconciliation_status: 'reconciled',
            confirmed: true
        })
        .eq('id', transactionId)
        .eq('user_id', user.id)

    if (txnError) throw txnError

    return { success: true }
}

/**
 * Unlink a specific transaction from a payable
 */
export async function unlinkTransactionFromPayable(payableId: string, transactionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Remove from junction table
    const { error: deleteError } = await supabase
        .from('payable_transactions')
        .delete()
        .eq('payable_id', payableId)
        .eq('transaction_id', transactionId)

    if (deleteError) throw deleteError

    // Unlink transaction
    await supabase
        .from('transactions')
        .update({ linked_payable_id: null, reconciliation_status: 'unreconciled' })
        .eq('id', transactionId)
        .eq('user_id', user.id)

    // Recalculate total paid from remaining links WITH transaction dates
    const { data: remainingLinks } = await supabase
        .from('payable_transactions')
        .select('amount, transactions(transaction_date)')
        .eq('payable_id', payableId)

    const totalPaid = (remainingLinks || []).reduce((sum, link) => sum + Number(link.amount), 0)

    // Find the most recent transaction date from remaining links
    let lastPaidDate: string | null = null
    if (remainingLinks && remainingLinks.length > 0) {
        const dates = remainingLinks
            .map(link => (link.transactions as any)?.transaction_date)
            .filter(Boolean)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        lastPaidDate = dates[0] || null
    }

    // Fetch payable to check if still fully paid
    const { data: payable } = await supabase
        .from('payables')
        .select('amount')
        .eq('id', payableId)
        .single()

    const totalAmount = Number(payable?.amount || 0)
    const isFullyPaid = totalPaid >= totalAmount && totalPaid > 0

    // Update payable with recalculated values
    const { error: updateError } = await supabase
        .from('payables')
        .update({
            amount_paid: totalPaid,
            bill_status: isFullyPaid ? 'paid' : 'scheduled',
            is_paid: isFullyPaid,
            reconciled_at: isFullyPaid ? new Date().toISOString() : null,
            last_paid_date: lastPaidDate
        })
        .eq('id', payableId)
        .eq('user_id', user.id)

    if (updateError) throw updateError

    return { success: true, totalPaid, isFullyPaid }
}

/**
 * Unlink ALL transactions from a payable (reset bill)
 * Handles both new junction table AND legacy linked_transaction_id
 */
export async function unlinkPayableFromTransaction(payableId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get all linked transactions from JUNCTION table
    const { data: links } = await supabase
        .from('payable_transactions')
        .select('transaction_id')
        .eq('payable_id', payableId)

    // Unlink all transactions from junction table
    if (links && links.length > 0) {
        const txIds = links.map(l => l.transaction_id)
        await supabase
            .from('transactions')
            .update({ linked_payable_id: null, reconciliation_status: 'unreconciled' })
            .in('id', txIds)
            .eq('user_id', user.id)
    }

    // Delete all junction records
    await supabase
        .from('payable_transactions')
        .delete()
        .eq('payable_id', payableId)

    // ALSO check legacy linked_transaction_id column
    const { data: payable } = await supabase
        .from('payables')
        .select('linked_transaction_id')
        .eq('id', payableId)
        .single()

    if (payable?.linked_transaction_id) {
        // Unlink the legacy transaction
        await supabase
            .from('transactions')
            .update({ linked_payable_id: null, reconciliation_status: 'unreconciled' })
            .eq('id', payable.linked_transaction_id)
            .eq('user_id', user.id)
    }

    // Reset payable (clear both new and legacy fields)
    const { error } = await supabase
        .from('payables')
        .update({
            amount_paid: 0,
            bill_status: 'scheduled',
            is_paid: false,
            reconciled_at: null,
            last_paid_date: null,
            linked_transaction_id: null  // Clear legacy field too
        })
        .eq('id', payableId)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

// ============= Summary Stats =============

export async function getPayablesSummary() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const today = new Date().toISOString().split('T')[0]
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Get all unpaid payables
    const { data: payables } = await supabase
        .from('payables')
        .select('amount, payee_type, next_due, bill_status, is_system_generated')
        .eq('user_id', user.id)
        .neq('bill_status', 'paid')
        .neq('bill_status', 'voided')

    if (!payables) return { totalPayables: 0, dueWithin7Days: 0, merchantFees: 0, staffLiability: 0 }

    const totalPayables = payables.reduce((sum, p) => sum + Number(p.amount), 0)
    const dueWithin7Days = payables
        .filter(p => p.next_due <= weekFromNow)
        .reduce((sum, p) => sum + Number(p.amount), 0)
    const merchantFees = payables
        .filter(p => p.payee_type === 'system' && p.is_system_generated)
        .reduce((sum, p) => sum + Number(p.amount), 0)
    const staffLiability = payables
        .filter(p => p.payee_type === 'staff')
        .reduce((sum, p) => sum + Number(p.amount), 0)

    return { totalPayables, dueWithin7Days, merchantFees, staffLiability }
}

// ============= Auto-Bill Generation =============

export async function generateStaffSalaryBills(targetMonth?: number, targetYear?: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Default to current month if not specified
    const now = new Date()
    const month = targetMonth ?? now.getMonth()
    const year = targetYear ?? now.getFullYear()

    // Get all Fridays in the target month
    function getFridaysInMonth(y: number, m: number): Date[] {
        const fridays: Date[] = []
        const date = new Date(y, m, 1)

        // Find first Friday
        while (date.getDay() !== 5) {
            date.setDate(date.getDate() + 1)
        }

        // Collect all Fridays in the month
        while (date.getMonth() === m) {
            fridays.push(new Date(date))
            date.setDate(date.getDate() + 7)
        }

        return fridays
    }

    const fridays = getFridaysInMonth(year, month)
    if (fridays.length === 0) return { created: 0, skipped: 0 }

    // Get staff with weekly salary
    const { data: staffList } = await supabase
        .from('staff')
        .select('id, name, weekly_salary, is_owner')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('weekly_salary', 0)

    if (!staffList || staffList.length === 0) return { created: 0, skipped: 0 }

    let created = 0
    let skipped = 0

    // For each staff member, create a bill for each Friday
    for (const staff of staffList) {
        for (const friday of fridays) {
            const dueDateStr = friday.toISOString().split('T')[0]

            // Check if bill already exists for this week
            const { data: existing } = await supabase
                .from('payables')
                .select('id')
                .eq('user_id', user.id)
                .eq('staff_id', staff.id)
                .eq('next_due', dueDateStr)
                .maybeSingle()

            if (existing) {
                skipped++
            } else {
                await supabase.from('payables').insert({
                    user_id: user.id,
                    name: `Salary: ${staff.name}`,
                    payee_type: 'staff',
                    staff_id: staff.id,
                    amount: staff.weekly_salary,
                    frequency: 'weekly',
                    next_due: dueDateStr,
                    is_recurring: true,
                    bill_status: 'scheduled',
                    is_system_generated: true,
                    notes: staff.is_owner ? 'Owner salary' : 'Staff salary'
                })
                created++
            }
        }
    }

    return { created, skipped }
}

export async function generateUpcomingBills(targetMonth: number, targetYear: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get all ACTIVE templates (not regular recurring bills)
    const { data: templates } = await supabase
        .from('payables')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_template', true)
        .eq('is_active', true)
        .neq('frequency', 'one-time')
        .order('name', { ascending: true })

    if (!templates || templates.length === 0) {
        return { created: 0, skipped: 0 }
    }

    // Month names for smart naming
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']

    let created = 0
    let skipped = 0

    // Helper: Get all Fridays in a month
    function getFridaysInMonth(year: number, month: number): Date[] {
        const fridays: Date[] = []
        const date = new Date(year, month, 1)

        // Find first Friday
        while (date.getDay() !== 5) {
            date.setDate(date.getDate() + 1)
        }

        // Collect all Fridays in the month
        while (date.getMonth() === month) {
            fridays.push(new Date(date))
            date.setDate(date.getDate() + 7)
        }

        return fridays
    }

    // Process each template
    for (const template of templates) {
        // Get base name (strip date suffixes for smart naming)
        const baseName = template.name
            .replace(/\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}$/i, '')
            .replace(/\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}$/i, '')
            .replace(/\s*-\s*Week\s*\d+$/i, '')
            .replace(/\s*Week\s*\d+$/i, '')
            .replace(/\s*\d{4}-\d{2}$/, '')
            .replace(/\s*\d{1,2}\/\d{4}$/, '')
            .replace(/\s*Q\d\s*\d{4}$/i, '')
            .replace(/\s*\d{4}$/, '')
            .trim()

        // Handle WEEKLY templates - generate 4 Friday bills
        if (template.frequency === 'weekly') {
            const fridays = getFridaysInMonth(targetYear, targetMonth)

            for (const friday of fridays) {
                const fridayStr = friday.toISOString().split('T')[0]

                // Check if bill already exists for this Friday
                const { data: existing } = await supabase
                    .from('payables')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('template_id', template.id)
                    .eq('next_due', fridayStr)
                    .single()

                if (existing) {
                    skipped++
                    continue
                }

                // Generate smart name with week number
                const weekNum = getWeekNumberForDate(friday)
                const newName = template.use_smart_name !== false
                    ? `${baseName} - Week ${weekNum}`
                    : baseName

                // Create the bill
                await supabase.from('payables').insert({
                    user_id: user.id,
                    name: newName,
                    payee_type: template.payee_type,
                    vendor_id: template.vendor_id,
                    staff_id: template.staff_id,
                    amount: template.amount,
                    amount_tax: template.amount_tax,
                    frequency: template.frequency,
                    next_due: fridayStr,
                    is_recurring: false,
                    is_template: false,
                    template_id: template.id,
                    bill_status: template.is_variable_amount ? 'draft' : 'scheduled',
                    is_paid: false,
                    is_system_generated: false,
                    is_variable_amount: template.is_variable_amount || false,
                    category_id: template.category_id,
                    auto_pay: template.auto_pay,
                    reminder_days: template.reminder_days,
                    payment_method: template.payment_method,
                    notes: template.notes,
                    description: template.description
                })
                created++
            }
        } else {
            // Handle MONTHLY, QUARTERLY, YEARLY - single bill per period
            const targetMonthStart = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`
            const targetMonthEnd = new Date(targetYear, targetMonth + 1, 0).toISOString().split('T')[0]

            const { data: existingBill } = await supabase
                .from('payables')
                .select('id')
                .eq('user_id', user.id)
                .eq('template_id', template.id)
                .gte('next_due', targetMonthStart)
                .lte('next_due', targetMonthEnd)
                .single()

            if (existingBill) {
                skipped++
                continue
            }

            // Use the template's day_of_month, or default to 15
            const dayOfMonth = template.day_of_month || 15
            const newDueDate = new Date(targetYear, targetMonth, dayOfMonth)

            // Apply smart naming
            let newName = baseName
            if (template.use_smart_name !== false) {
                if (template.frequency === 'monthly') {
                    newName = `${baseName} - ${months[targetMonth]} ${targetYear}`
                } else if (template.frequency === 'quarterly') {
                    const quarter = Math.floor(targetMonth / 3) + 1
                    newName = `${baseName} Q${quarter} ${targetYear}`
                } else if (template.frequency === 'yearly') {
                    newName = `${baseName} ${targetYear}`
                }
            }

            // Create the new bill
            await supabase.from('payables').insert({
                user_id: user.id,
                name: newName,
                payee_type: template.payee_type,
                vendor_id: template.vendor_id,
                staff_id: template.staff_id,
                amount: template.amount,
                amount_tax: template.amount_tax,
                frequency: template.frequency,
                next_due: newDueDate.toISOString().split('T')[0],
                is_recurring: false,
                is_template: false,
                template_id: template.id,
                bill_status: template.is_variable_amount ? 'draft' : 'scheduled',
                is_paid: false,
                is_system_generated: false,
                is_variable_amount: template.is_variable_amount || false,
                category_id: template.category_id,
                auto_pay: template.auto_pay,
                reminder_days: template.reminder_days,
                payment_method: template.payment_method,
                notes: template.is_variable_amount ? `Estimated: £${template.amount.toFixed(2)} - Update with actual amount` : template.notes,
                description: template.description
            })
            created++
        }
    }

    return { created, skipped }
}

function getWeekNumberForDate(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export async function generateMerchantFeeBill(
    grossRevenue: number,
    transactionCount: number,
    month: string // Format: "2026-01"
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // UK CNP rate: 1.99% + £0.20 per transaction
    const percentageFee = grossRevenue * 0.0199
    const perTxnFee = transactionCount * 0.20
    const totalFee = percentageFee + perTxnFee

    // Last day of the month
    const [year, monthNum] = month.split('-').map(Number)
    const lastDay = new Date(year, monthNum, 0).toISOString().split('T')[0]

    const billName = `Mindbody/TSYS Fees - ${month}`

    // Upsert (update if exists, create if not)
    const { data: existing } = await supabase
        .from('payables')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', billName)
        .single()

    if (existing) {
        await supabase
            .from('payables')
            .update({
                amount: totalFee,
                notes: `Gross: £${grossRevenue.toFixed(2)} × 1.99% = £${percentageFee.toFixed(2)} + ${transactionCount} txns × £0.20 = £${perTxnFee.toFixed(2)}`
            })
            .eq('id', existing.id)
    } else {
        await supabase.from('payables').insert({
            user_id: user.id,
            name: billName,
            payee_type: 'system',
            amount: totalFee,
            frequency: 'one-time',
            next_due: lastDay,
            bill_status: 'scheduled',
            is_system_generated: true,
            payment_method: 'auto',
            notes: `Gross: £${grossRevenue.toFixed(2)} × 1.99% = £${percentageFee.toFixed(2)} + ${transactionCount} txns × £0.20 = £${perTxnFee.toFixed(2)}`
        })
    }

    return { fee: totalFee }
}

// ============= Mark Paid & Smart Recurring =============

export async function markPayableAsPaid(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get the payable
    const { data: payable } = await supabase
        .from('payables')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (!payable) throw new Error("Payable not found")

    const today = new Date().toISOString().split('T')[0]

    // Mark current bill as paid
    await supabase
        .from('payables')
        .update({
            bill_status: 'paid',
            is_paid: true,
            last_paid_date: today
        })
        .eq('id', id)
        .eq('user_id', user.id)

    // If recurring, create a NEW bill for the next period
    if (payable.is_recurring && payable.frequency !== 'one-time') {
        const currentDue = new Date(payable.next_due)
        const nextDue = calculateNextDueDate(currentDue, payable.frequency)

        // Generate smart name for next occurrence
        const nextName = generateSmartBillName(payable.name, currentDue, nextDue, payable.frequency)

        // Create new bill for next period
        await supabase.from('payables').insert({
            user_id: user.id,
            name: nextName,
            payee_type: payable.payee_type,
            vendor_id: payable.vendor_id,
            staff_id: payable.staff_id,
            amount: payable.amount,
            amount_tax: payable.amount_tax,
            frequency: payable.frequency,
            next_due: nextDue.toISOString().split('T')[0],
            is_recurring: true,
            bill_status: 'scheduled',
            is_paid: false,
            is_system_generated: payable.is_system_generated,
            category_id: payable.category_id,
            auto_pay: payable.auto_pay,
            reminder_days: payable.reminder_days,
            payment_method: payable.payment_method,
            notes: payable.notes,
            description: payable.description
        })
    }

    return { success: true }
}

export async function markPayableAsUnpaid(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get the payable to check if linked to a transaction
    const { data: payable } = await supabase
        .from('payables')
        .select('linked_transaction_id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (!payable) throw new Error("Payable not found")

    // If linked to transaction, unlink it
    if (payable.linked_transaction_id) {
        await supabase
            .from('transactions')
            .update({ linked_payable_id: null, reconciliation_status: 'unreconciled' })
            .eq('id', payable.linked_transaction_id)
            .eq('user_id', user.id)
    }

    // Reset payable to unpaid
    const { error } = await supabase
        .from('payables')
        .update({
            bill_status: 'approved',
            is_paid: false,
            linked_transaction_id: null,
            reconciled_at: null
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

// ============= Smart Naming Functions =============

function generateSmartBillName(
    currentName: string,
    currentDue: Date,
    nextDue: Date,
    frequency: Frequency
): string {
    // Month names for pattern matching
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const currentYear = currentDue.getFullYear()
    const currentMonth = currentDue.getMonth()
    const nextYear = nextDue.getFullYear()
    const nextMonth = nextDue.getMonth()

    let newName = currentName

    // Pattern 1: Full month name (e.g., "Rent - December 2025")
    const fullMonthPattern = new RegExp(`(${months.join('|')})\\s*(\\d{4})`, 'gi')
    if (fullMonthPattern.test(currentName)) {
        newName = currentName.replace(fullMonthPattern, (match) => {
            return `${months[nextMonth]} ${nextYear}`
        })
        return newName
    }

    // Pattern 2: Short month name (e.g., "Rent - Dec 2025")
    const shortMonthPattern = new RegExp(`(${shortMonths.join('|')})\\s*(\\d{4})`, 'gi')
    if (shortMonthPattern.test(currentName)) {
        newName = currentName.replace(shortMonthPattern, (match) => {
            return `${shortMonths[nextMonth]} ${nextYear}`
        })
        return newName
    }

    // Pattern 3: YYYY-MM format (e.g., "Invoice 2025-12")
    const isoPattern = /(\d{4})-(\d{2})/g
    if (isoPattern.test(currentName)) {
        newName = currentName.replace(isoPattern, (match) => {
            return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`
        })
        return newName
    }

    // Pattern 4: MM/YYYY format (e.g., "Bill 12/2025")
    const slashPattern = /(\d{1,2})\/(\d{4})/g
    if (slashPattern.test(currentName)) {
        newName = currentName.replace(slashPattern, (match) => {
            return `${nextMonth + 1}/${nextYear}`
        })
        return newName
    }

    // Pattern 5: Week number (e.g., "Salary Week 52")
    const weekPattern = /Week\s*(\d+)/gi
    if (weekPattern.test(currentName)) {
        const nextWeek = getWeekNumber(nextDue)
        newName = currentName.replace(weekPattern, (match) => {
            return `Week ${nextWeek}`
        })
        return newName
    }

    // Pattern 6: Quarter (e.g., "Q4 2025")
    const quarterPattern = /Q(\d)\s*(\d{4})/gi
    if (quarterPattern.test(currentName) && frequency === 'quarterly') {
        const nextQuarter = Math.floor(nextMonth / 3) + 1
        newName = currentName.replace(quarterPattern, (match) => {
            return `Q${nextQuarter} ${nextYear}`
        })
        return newName
    }

    // Pattern 7: Just year (yearly bills like "Insurance 2025")
    if (frequency === 'yearly') {
        const yearPattern = /\b(20\d{2})\b/g
        if (yearPattern.test(currentName)) {
            newName = currentName.replace(yearPattern, (match) => {
                return String(nextYear)
            })
            return newName
        }
    }

    // No recognizable pattern - append next period
    if (frequency === 'monthly') {
        return `${currentName.replace(/\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}$/i, '')} - ${months[nextMonth]} ${nextYear}`
    } else if (frequency === 'weekly') {
        return `${currentName.replace(/\s*Week\s*\d+/i, '')} Week ${getWeekNumber(nextDue)}`
    } else if (frequency === 'quarterly') {
        const nextQuarter = Math.floor(nextMonth / 3) + 1
        return `${currentName.replace(/\s*Q\d\s*\d{4}/i, '')} Q${nextQuarter} ${nextYear}`
    } else if (frequency === 'yearly') {
        return `${currentName.replace(/\s*\d{4}$/, '')} ${nextYear}`
    }

    return currentName // Fallback
}

function calculateNextDueDate(current: Date, frequency: Frequency): Date {
    const next = new Date(current)

    switch (frequency) {
        case 'weekly':
            next.setDate(next.getDate() + 7)
            break
        case 'monthly':
            next.setMonth(next.getMonth() + 1)
            break
        case 'quarterly':
            next.setMonth(next.getMonth() + 3)
            break
        case 'yearly':
            next.setFullYear(next.getFullYear() + 1)
            break
    }

    return next
}

function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getNextFriday(): Date {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
    const friday = new Date(today)
    friday.setDate(today.getDate() + daysUntilFriday)
    return friday
}
