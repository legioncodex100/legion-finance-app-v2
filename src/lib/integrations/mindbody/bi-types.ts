// Mindbody BI Types
export interface MBMember {
    id: string
    user_id: string
    mb_client_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    member_type: 'monthly' | 'pack' | 'drop_in' | null
    membership_name: string | null
    membership_status: 'Active' | 'Declined' | 'Expired' | 'Suspended' | null
    monthly_rate: number
    credits_remaining: number
    credits_expiration: string | null
    next_payment_date: string | null
    contract_end_date: string | null
    last_visit_date: string | null
    total_visits: number
    visits_30d: number
    visits_prev_30d: number
    first_purchase_type: 'free_trial' | 'paid_trial' | 'drop_in' | 'pack' | 'monthly' | null
    first_purchase_date: string | null
    upgraded_at: string | null
    upgraded_from: string | null
    lifetime_value: number
    churn_risk: number
    synced_at: string
}

export interface MBDecline {
    id: string
    user_id: string
    mb_client_id: string
    member_name: string | null
    email: string | null
    phone: string | null
    amount: number
    decline_date: string
    decline_reason: string | null
    status: 'new' | 'contacted' | 'recovered' | 'lost'
    contact_attempts: number
    last_contacted_at: string | null
    recovered_at: string | null
    notes: string | null
    created_at: string
}

export interface MBClassMetrics {
    id: string
    user_id: string
    class_date: string
    class_name: string
    class_time: string
    instructor: string | null
    capacity: number
    booked: number
    attended: number
    no_shows: number
    fill_rate: number
}

export interface MBWeeklyMetrics {
    id: string
    user_id: string
    year: number
    week_of_year: number
    total_revenue: number
    mrr: number
    active_monthly: number
    active_packs: number
    new_members: number
    churned_members: number
    trials_started: number
    trials_converted: number
    total_visits: number
    avg_class_fill_rate: number
}

export interface MBSyncLog {
    id: string
    user_id: string
    sync_type: 'members' | 'sales' | 'classes'
    last_sync_at: string
    records_synced: number
    api_calls_used: number
    success: boolean
    error_message: string | null
}

// MRR Summary
export interface MRRSummary {
    total_mrr: number
    at_risk_mrr: number
    active_members: number
    declined_members: number
    pack_members: number
}

// Churn Risk Tiers
export type ChurnRiskTier = 'low' | 'medium' | 'high' | 'critical'

export function getChurnRiskTier(score: number): ChurnRiskTier {
    if (score >= 76) return 'critical'
    if (score >= 51) return 'high'
    if (score >= 26) return 'medium'
    return 'low'
}

export function getChurnRiskColor(score: number): string {
    if (score >= 76) return 'text-red-600'
    if (score >= 51) return 'text-orange-500'
    if (score >= 26) return 'text-yellow-500'
    return 'text-green-500'
}

// Calculate churn risk score for a member (0-100)
export function calculateChurnRisk(member: Partial<MBMember>): number {
    let risk = 0

    // Days since last visit
    if (member.last_visit_date) {
        const daysSince = Math.floor(
            (Date.now() - new Date(member.last_visit_date).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSince > 14) risk += 30
        if (daysSince > 30) risk += 20
    }

    // Declining engagement
    if (member.visits_30d !== undefined && member.visits_prev_30d !== undefined) {
        if (member.visits_prev_30d > 0 && member.visits_30d < member.visits_prev_30d * 0.7) {
            risk += 20
        }
    }

    // Payment declined
    if (member.membership_status === 'Declined') {
        risk += 40
    }

    // Contract expiring soon
    if (member.contract_end_date) {
        const daysUntil = Math.floor(
            (new Date(member.contract_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        if (daysUntil > 0 && daysUntil < 30) {
            risk += 25
        }
    }

    // Credit pack running low
    if (member.credits_remaining !== undefined && member.credits_remaining > 0 && member.credits_remaining <= 2) {
        risk += 15
    }

    return Math.min(risk, 100)
}
