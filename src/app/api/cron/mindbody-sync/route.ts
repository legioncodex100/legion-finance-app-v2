import { NextRequest, NextResponse } from 'next/server'
import { smartMindbodySync } from '@/lib/actions/mindbody-sync'
import { runFullMindbodySync } from '@/lib/actions/mindbody-sync'

/**
 * Nightly Mindbody Sync Cron Job
 * Runs at 3 AM UTC daily via Vercel Cron
 * 
 * Syncs:
 * - Transactions from last 7 days
 * - Updates scheduled payment statuses
 * - Refreshes last visit dates for churn
 * - Full member sync weekly (Sundays)
 */
export async function GET(request: NextRequest) {
    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.log('[CRON] Unauthorized cron attempt')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] Starting nightly Mindbody sync...')

    try {
        // Run smart sync (transactions + scheduled updates + last visits)
        const smartResult = await smartMindbodySync()
        console.log('[CRON] Smart sync result:', smartResult)

        // On Sundays, also run full member sync
        const dayOfWeek = new Date().getDay() // 0 = Sunday
        let fullResult = null
        if (dayOfWeek === 0) {
            console.log('[CRON] Sunday - running full member sync')
            fullResult = await runFullMindbodySync()
            console.log('[CRON] Full sync result:', fullResult)
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            smartSync: {
                transactions: smartResult.transactions.synced,
                scheduledUpdated: smartResult.scheduledUpdated,
                lastVisitsUpdated: smartResult.lastVisitsUpdated,
            },
            fullSync: fullResult ? {
                members: fullResult.members.synced,
                pricing: fullResult.pricing.updated,
                declines: fullResult.members.declines,
            } : null,
        })
    } catch (error) {
        console.error('[CRON] Mindbody sync failed:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 })
    }
}
