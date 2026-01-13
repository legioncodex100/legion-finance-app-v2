"use server"

import { createClient } from "@/lib/supabase/server"

export interface FinancialClass {
    id: string
    code: string
    name: string
    description?: string
    affects_profit: boolean
    sort_order: number
    user_id: string
    created_at: string
}

export async function getFinancialClasses() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data, error } = await supabase
        .from('financial_classes')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order')

    if (error) throw error
    return data as FinancialClass[]
}

export async function createFinancialClass(data: {
    code: string
    name: string
    description?: string
    affects_profit?: boolean
    sort_order?: number
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: newClass, error } = await supabase
        .from('financial_classes')
        .insert({
            code: data.code.toUpperCase(),
            name: data.name,
            description: data.description,
            affects_profit: data.affects_profit ?? true,
            sort_order: data.sort_order ?? 0,
            user_id: user.id
        })
        .select()
        .single()

    if (error) throw error
    return newClass as FinancialClass
}

export async function updateFinancialClass(id: string, data: Partial<Omit<FinancialClass, 'id' | 'user_id' | 'created_at'>>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('financial_classes')
        .update(data)
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function deleteFinancialClass(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // First, unlink any categories using this class
    await supabase
        .from('categories')
        .update({ class_id: null })
        .eq('class_id', id)
        .eq('user_id', user.id)

    const { error } = await supabase
        .from('financial_classes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}
