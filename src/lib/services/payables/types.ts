/**
 * Payables Types
 * Centralized type definitions for the payables module
 */

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

export interface PayableTransaction {
    id: string
    payable_id: string
    transaction_id: string
    amount: number
    notes: string | null
    linked_at: string
}

export interface CreatePayableData {
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
    is_template?: boolean
    invoice_number?: string
    notes?: string
    description?: string
    category_id?: string
    auto_pay?: boolean
    reminder_days?: number
    payment_method?: PaymentMethod
    is_system_generated?: boolean
    is_variable_amount?: boolean
}

export interface CreateTemplateData {
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
}

export interface PayableFilters {
    status?: BillStatus | 'all'
    payeeType?: PayeeType | 'all'
    overdue?: boolean
}

export interface PayablesSummary {
    totalPayables: number
    dueWithin7Days: number
    merchantFees: number
    staffLiability: number
    dueThisMonth: number
    overdueAmount: number
}
