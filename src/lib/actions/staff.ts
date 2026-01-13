"use server"

import { createClient } from "@/lib/supabase/server"

// Define types inline to avoid Turbopack import issues
export type StaffRole = 'director' | 'coach' | 'staff'
export type Discipline = 'BJJ' | 'No-Gi' | 'MMA' | 'Kickboxing' | 'Wrestling' | 'Judo' | 'Kids BJJ' | 'Kids MMA'
export type PayPeriod = 'hourly' | 'weekly' | 'monthly'

export interface Staff {
    id: string
    name: string
    role: StaffRole
    email?: string
    phone?: string
    pay_rate?: number
    is_active: boolean
    notes?: string
    created_at: string
    user_id: string
    // Staff types
    is_coach?: boolean
    is_facilities?: boolean
    is_va?: boolean
    is_owner?: boolean
    // Weekly salary (for owners/fixed salary staff)
    weekly_salary?: number
    // Coach pay
    coach_disciplines?: Discipline[]
    coach_hourly_rate?: number
    coach_pay_period?: PayPeriod
    // Facilities pay
    facilities_hourly_rate?: number
    facilities_pay_period?: PayPeriod
    // VA pay
    va_monthly_rate?: number
    va_pay_period?: PayPeriod
}

export async function getStaff(role?: StaffRole) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    let query = supabase
        .from('staff')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

    if (role) {
        query = query.eq('role', role)
    }

    const { data, error } = await query
    if (error) {
        console.error("getStaff error:", error)
        throw error
    }
    return data as Staff[]
}

export async function createStaff(data: {
    name: string
    role: StaffRole
    email?: string
    phone?: string
    pay_rate?: number
    notes?: string
    is_coach?: boolean
    is_facilities?: boolean
    is_va?: boolean
    is_owner?: boolean
    weekly_salary?: number
    coach_disciplines?: Discipline[]
    coach_hourly_rate?: number
    coach_pay_period?: PayPeriod
    facilities_hourly_rate?: number
    facilities_pay_period?: PayPeriod
    va_monthly_rate?: number
    va_pay_period?: PayPeriod
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: staff, error } = await supabase
        .from('staff')
        .insert({
            ...data,
            user_id: user.id,
            is_active: true
        })
        .select()
        .single()

    if (error) throw error
    return staff as Staff
}

export async function updateStaff(id: string, data: Partial<Omit<Staff, 'id' | 'user_id' | 'created_at'>>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('staff')
        .update(data)
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function deleteStaff(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}
