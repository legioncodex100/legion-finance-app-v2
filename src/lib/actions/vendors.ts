"use server"

import { createClient } from "@/lib/supabase/server"

export interface Vendor {
    id: string
    name: string
    default_category_id?: string
    is_recurring: boolean
    created_at: string
    user_id: string
}

export async function getVendors() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

    if (error) throw error
    return data as Vendor[]
}

export async function createVendor(data: { name: string, is_recurring?: boolean }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: vendor, error } = await supabase
        .from('vendors')
        .insert({
            name: data.name,
            is_recurring: data.is_recurring || false,
            user_id: user.id
        })
        .select()
        .single()

    if (error) throw error
    return vendor as Vendor
}

export async function updateVendor(id: string, data: { name?: string, is_recurring?: boolean }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('vendors')
        .update(data)
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function deleteVendor(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function convertVendorToStaff(vendorId: string, role: 'coach' | 'staff' = 'coach') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // 1. Get vendor details
    const { data: vendor, error: fetchError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .eq('user_id', user.id)
        .single()

    if (fetchError || !vendor) throw new Error("Vendor not found")

    // 2. Create staff record
    const { data: newStaff, error: insertError } = await supabase
        .from('staff')
        .insert({
            name: vendor.name,
            role: role,
            user_id: user.id,
            is_active: true
        })
        .select()
        .single()

    if (insertError) throw insertError

    // 3. Update any transactions that reference this vendor to point to staff AND clear vendor_id
    await supabase
        .from('transactions')
        .update({ staff_id: newStaff.id, vendor_id: null })
        .eq('vendor_id', vendorId)
        .eq('user_id', user.id)

    // 4. Update any coach_invoices AND clear vendor_id
    await supabase
        .from('coach_invoices')
        .update({ staff_id: newStaff.id, vendor_id: null })
        .eq('vendor_id', vendorId)
        .eq('user_id', user.id)

    // 5. Delete the vendor (now safe as no FK references remain)
    const { error: deleteError } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId)
        .eq('user_id', user.id)

    if (deleteError) {
        console.error('Failed to delete vendor:', deleteError)
        // Still return success since the staff was created and transactions updated
    }

    return { success: true, staffId: newStaff.id }
}

export async function assignVendorBulk(vendorId: string, rawPartyPattern: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Update all transactions where raw_party contains the pattern (case-insensitive)
    const { data, error } = await supabase
        .from('transactions')
        .update({ vendor_id: vendorId })
        .eq('user_id', user.id)
        .ilike('raw_party', `%${rawPartyPattern}%`)
        .select('id')

    if (error) throw error
    return { success: true, updated: data?.length || 0 }
}
