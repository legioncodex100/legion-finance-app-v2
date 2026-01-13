"use server"

import { createClient } from '@/lib/supabase/server'
import { MindbodyClient } from './client'
import { MINDBODY_CONFIG, isMindbodyConfigured, hasMindbodyStaffCredentials } from './config'
import type { MindbodySale, MindbodySyncResult } from './types'
import { categorizeTransaction } from '@/lib/ai/gemini'
import crypto from 'crypto'

/**
 * Generate import hash for deduplication
 */
function generateSaleHash(sale: MindbodySale): string {
    const hashInput = `mindbody-${sale.Id}-${sale.SaleDateTime}`
    return crypto.createHash('md5').update(hashInput).digest('hex')
}

/**
 * Test Mindbody connection
 */
export async function testMindbodyConnection(): Promise<{ success: boolean; message: string }> {
    if (!isMindbodyConfigured()) {
        return { success: false, message: 'Mindbody API key not configured' }
    }

    if (!hasMindbodyStaffCredentials()) {
        return { success: false, message: 'Staff credentials not configured' }
    }

    try {
        const client = new MindbodyClient()
        return await client.testConnection()
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Connection test failed'
        }
    }
}

/**
 * Sync sales from Mindbody to transactions
 */
export async function syncMindbodySales(daysBack: number = MINDBODY_CONFIG.sync.defaultDaysBack): Promise<MindbodySyncResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return {
            success: false,
            salesFetched: 0,
            transactionsCreated: 0,
            transactionsSkipped: 0,
            errors: ['Not authenticated'],
            syncedFrom: '',
            syncedTo: '',
        }
    }

    if (!isMindbodyConfigured() || !hasMindbodyStaffCredentials()) {
        return {
            success: false,
            salesFetched: 0,
            transactionsCreated: 0,
            transactionsSkipped: 0,
            errors: ['Mindbody not configured. Check environment variables.'],
            syncedFrom: '',
            syncedTo: '',
        }
    }

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    const result: MindbodySyncResult = {
        success: true,
        salesFetched: 0,
        transactionsCreated: 0,
        transactionsSkipped: 0,
        errors: [],
        syncedFrom: startDate.toISOString().split('T')[0],
        syncedTo: endDate.toISOString().split('T')[0],
    }

    try {
        const client = new MindbodyClient()
        const sales = await client.getAllSales(startDate, endDate)
        result.salesFetched = sales.length

        // Process each sale
        for (const sale of sales) {
            const importHash = generateSaleHash(sale)

            // Check if already imported
            const { data: existing } = await supabase
                .from('transactions')
                .select('id')
                .eq('user_id', user.id)
                .eq('import_hash', importHash)
                .single()

            if (existing) {
                result.transactionsSkipped++
                continue
            }

            // Build description from items
            const itemNames = sale.Items?.map(i => i.Name).join(', ') || 'Mindbody Sale'
            const clientName = sale.ClientName ||
                (sale.ClientFirstName && sale.ClientLastName
                    ? `${sale.ClientFirstName} ${sale.ClientLastName}`
                    : 'Client')

            // Get AI category suggestion
            let aiSuggested = null
            try {
                aiSuggested = await categorizeTransaction(itemNames, sale.TotalAmountPaid, 'income')
            } catch (e) {
                // AI categorization is optional
            }

            // Create transaction
            const { error } = await supabase.from('transactions').insert({
                user_id: user.id,
                amount: sale.TotalAmountPaid,
                description: itemNames,
                raw_party: clientName,
                transaction_date: sale.SaleDateTime.split('T')[0],
                type: 'income',
                import_hash: importHash,
                ai_suggested: aiSuggested,
                confirmed: false,
                notes: `Imported from Mindbody (Sale ID: ${sale.Id})`,
            })

            if (error) {
                result.errors.push(`Sale ${sale.Id}: ${error.message}`)
            } else {
                result.transactionsCreated++
            }
        }

        // Upsert integration record
        await supabase
            .from('integrations')
            .upsert({
                user_id: user.id,
                provider: 'mindbody',
                is_enabled: true,
                status: 'connected',
                last_sync_at: new Date().toISOString(),
                error_message: null,
            }, {
                onConflict: 'user_id,provider'
            })

        // Log sync
        const { data: integration } = await supabase
            .from('integrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('provider', 'mindbody')
            .single()

        if (integration) {
            await supabase.from('integration_sync_logs').insert({
                integration_id: integration.id,
                sync_type: 'sales',
                status: 'completed',
                records_processed: result.salesFetched,
                metadata: {
                    created: result.transactionsCreated,
                    skipped: result.transactionsSkipped,
                    errors: result.errors.length,
                },
                completed_at: new Date().toISOString(),
            })
        }

    } catch (error) {
        result.success = false
        result.errors.push(error instanceof Error ? error.message : 'Unknown error')

        // Update integration with error
        await supabase
            .from('integrations')
            .upsert({
                user_id: user.id,
                provider: 'mindbody',
                status: 'error',
                error_message: error instanceof Error ? error.message : 'Sync failed',
            }, {
                onConflict: 'user_id,provider'
            })
    }

    return result
}
