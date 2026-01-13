import { NextRequest, NextResponse } from 'next/server'
import { syncMindbodySales } from '@/lib/integrations'

export async function POST(request: NextRequest) {
    try {
        // Parse optional daysBack parameter
        const body = await request.json().catch(() => ({}))
        const daysBack = body.daysBack || 30

        const result = await syncMindbodySales(daysBack)

        return NextResponse.json(result)

    } catch (error) {
        console.error('Mindbody sync error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Sync failed',
            },
            { status: 500 }
        )
    }
}
