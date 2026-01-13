"use server"

import { createClient } from "@/lib/supabase/server"

export interface DemographicsData {
    total_members: number
    gender_breakdown: { gender: string; count: number }[]
    age_brackets: { bracket: string; count: number }[]
    top_locations: { city: string; postal_code: string; count: number }[]
    data_completeness: {
        have_dob: number
        have_gender: number
        have_address: number
    }
}

export async function getMemberDemographics(): Promise<DemographicsData> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get all members with pagination (Supabase limits to 1000 per request)
    let allMembers: any[] = []
    let offset = 0
    const pageSize = 1000

    while (true) {
        const { data: batch } = await supabase
            .from('mb_members')
            .select('date_of_birth, gender, address_city, address_postal_code')
            .eq('user_id', user.id)
            .range(offset, offset + pageSize - 1)

        if (!batch || batch.length === 0) break
        allMembers = [...allMembers, ...batch]
        if (batch.length < pageSize) break
        offset += pageSize
    }

    const members = allMembers

    if (!members || members.length === 0) {
        return {
            total_members: 0,
            gender_breakdown: [],
            age_brackets: [],
            top_locations: [],
            data_completeness: { have_dob: 0, have_gender: 0, have_address: 0 }
        }
    }

    // Gender breakdown
    const genderCounts = new Map<string, number>()
    members.forEach(m => {
        const gender = m.gender && m.gender !== 'None' ? m.gender : 'Not specified'
        genderCounts.set(gender, (genderCounts.get(gender) || 0) + 1)
    })
    const gender_breakdown = Array.from(genderCounts.entries())
        .map(([gender, count]) => ({ gender, count }))
        .sort((a, b) => b.count - a.count)

    // Age brackets
    const now = new Date()
    const ageBrackets = new Map<string, number>()
    members.forEach(m => {
        if (!m.date_of_birth) {
            ageBrackets.set('Unknown', (ageBrackets.get('Unknown') || 0) + 1)
            return
        }
        const dob = new Date(m.date_of_birth)
        const age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

        let bracket = 'Unknown'
        if (age < 18) bracket = 'Under 18'
        else if (age < 25) bracket = '18-24'
        else if (age < 35) bracket = '25-34'
        else if (age < 45) bracket = '35-44'
        else if (age < 55) bracket = '45-54'
        else bracket = '55+'

        ageBrackets.set(bracket, (ageBrackets.get(bracket) || 0) + 1)
    })
    const bracketOrder = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55+', 'Unknown']
    const age_brackets = bracketOrder
        .filter(b => ageBrackets.has(b))
        .map(bracket => ({ bracket, count: ageBrackets.get(bracket) || 0 }))

    // Top locations (by postal code)
    const locationCounts = new Map<string, { city: string; postal_code: string; count: number }>()
    members.forEach(m => {
        if (!m.address_postal_code) return
        const key = m.address_postal_code.toUpperCase().replace(/\s+/g, '')
        const existing = locationCounts.get(key)
        if (existing) {
            existing.count++
        } else {
            locationCounts.set(key, {
                city: m.address_city || 'Unknown',
                postal_code: m.address_postal_code,
                count: 1
            })
        }
    })
    const top_locations = Array.from(locationCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

    // Data completeness
    const data_completeness = {
        have_dob: members.filter(m => m.date_of_birth).length,
        have_gender: members.filter(m => m.gender && m.gender !== 'None').length,
        have_address: members.filter(m => m.address_postal_code).length
    }

    return {
        total_members: members.length,
        gender_breakdown,
        age_brackets,
        top_locations,
        data_completeness
    }
}
