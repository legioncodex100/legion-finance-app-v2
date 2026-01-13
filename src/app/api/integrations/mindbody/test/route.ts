import { NextResponse } from 'next/server'
import { testMindbodyConnection } from '@/lib/integrations'

export async function POST() {
    const result = await testMindbodyConnection()
    return NextResponse.json(result)
}
