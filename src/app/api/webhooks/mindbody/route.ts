import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { logApiCall } from "@/lib/actions/api-logs"

/**
 * Mindbody Webhook Handler
 * 
 * Listens for:
 * - client.created (new member)
 * - client.updated (profile changes, decline detection)
 * - clientProfileMerger.created (merged clients)
 * - clientMembershipAssignment.created (new membership)
 * - clientMembershipAssignment.cancelled (cancelled membership)
 * - clientSale.created (payment made)
 * 
 * POST /api/webhooks/mindbody
 */

// Event types we handle
type MindbodyEvent =
    | "client.created"
    | "client.updated"
    | "clientProfileMerger.created"
    | "clientMembershipAssignment.created"
    | "clientMembershipAssignment.cancelled"
    | "clientSale.created"
    | "sale.created" // Legacy event name

interface WebhookPayload {
    messageId?: string
    eventId?: string
    eventSchemaVersion?: string
    eventInstanceOriginationDateTime?: string
    eventData?: {
        siteId?: number
        clientId?: string
        clientUniqueId?: number
        // For merge events
        winnerClientId?: string
        loserClientId?: string
        mergeDateTime?: string
        // For membership events
        membershipId?: string
        // For sale events
        saleId?: string
        // Generic data
        [key: string]: any
    }
    // Legacy format support
    eventType?: string
    clientId?: string
    membershipId?: string
    data?: any
    timestamp?: string
}

// Get user_id from existing members (for multi-tenant support)
async function getDefaultUserId(supabase: any): Promise<string | null> {
    const { data } = await supabase
        .from('mb_members')
        .select('user_id')
        .limit(1)
        .single()

    return data?.user_id || null
}

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    let eventType: string | undefined
    let payloadForLogging: WebhookPayload | undefined

    try {
        const payload: WebhookPayload = await request.json()
        payloadForLogging = payload

        // Support both new format (eventId) and legacy format (eventType)
        eventType = payload.eventId || payload.eventType
        const eventData = payload.eventData || payload.data || {}
        const clientId = eventData.clientId?.toString() ||
            eventData.clientUniqueId?.toString() ||
            payload.clientId

        logger.info('WEBHOOK', 'Received Mindbody event', { eventType, clientId })

        // Verify webhook signature
        const signature = request.headers.get("x-mindbody-signature")
        if (process.env.MINDBODY_WEBHOOK_SECRET && signature) {
            // TODO: Implement HMAC signature verification
        }

        let response: NextResponse

        // Route to handler
        switch (eventType) {
            case "client.created":
                response = await handleClientCreated(clientId, eventData)
                break

            case "client.updated":
                response = await handleClientUpdated(clientId, eventData)
                break

            case "clientProfileMerger.created":
                response = await handleClientMerged(eventData)
                break

            case "clientMembershipAssignment.created":
                response = await handleMembershipCreated(clientId, eventData)
                break

            case "clientMembershipAssignment.cancelled":
                response = await handleMembershipCancelled(clientId, eventData.membershipId, eventData)
                break

            case "clientSale.created":
            case "sale.created":
                response = await handleSaleCreated(eventData)
                break

            default:
                logger.info('WEBHOOK', 'Unhandled event type', { eventType })
                response = NextResponse.json({ received: true, handled: false, eventType })
        }

        // Log successful webhook
        logApiCall({
            logType: 'webhook',
            source: 'mindbody',
            eventType: eventType || 'unknown',
            status: 'success',
            requestData: payloadForLogging,
            durationMs: Date.now() - startTime
        })

        return response
    } catch (error: any) {
        logger.error('WEBHOOK', 'Webhook processing failed', { error: error.message })

        // Log failed webhook
        logApiCall({
            logType: 'webhook',
            source: 'mindbody',
            eventType: eventType || 'unknown',
            status: 'error',
            requestData: payloadForLogging,
            errorMessage: error.message,
            durationMs: Date.now() - startTime
        })

        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        )
    }
}

// ============================================
// HANDLER: Client Created (New Member)
// ============================================
async function handleClientCreated(
    clientId?: string,
    data?: any
): Promise<NextResponse> {
    if (!clientId) {
        return NextResponse.json({ error: "Missing clientId" }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get user_id from existing members
    const userId = await getDefaultUserId(supabase)
    if (!userId) {
        return NextResponse.json({
            received: true,
            handled: false,
            error: "No existing members found to determine user_id"
        })
    }

    // Insert new member (upsert to avoid duplicates)
    const { error } = await supabase.from("mb_members").upsert({
        user_id: userId,
        mb_client_id: clientId,
        first_name: data?.FirstName || data?.firstName,
        last_name: data?.LastName || data?.lastName,
        email: data?.Email || data?.email,
        phone: data?.MobilePhone || data?.HomePhone || data?.mobilePhone,
        mobile_phone: data?.MobilePhone || data?.mobilePhone,
        gender: data?.Gender || data?.gender,
        birth_date: data?.BirthDate || data?.birthDate,
        address_line1: data?.AddressLine1 || data?.addressLine1,
        city: data?.City || data?.city,
        postal_code: data?.PostalCode || data?.postalCode,
        membership_status: "New",
        join_date: new Date().toISOString().split("T")[0],
        synced_at: new Date().toISOString(),
    }, { onConflict: 'mb_client_id,user_id' })

    if (error) {
        logger.error('WEBHOOK', 'Failed to create member', { clientId, error: error.message })
        return NextResponse.json({ received: true, handled: false, error: error.message })
    }

    logger.info('WEBHOOK', 'Member created', { clientId })
    return NextResponse.json({ received: true, handled: true, action: "client_created", clientId })
}

// ============================================
// HANDLER: Client Updated
// ============================================
async function handleClientUpdated(
    clientId?: string,
    data?: any
): Promise<NextResponse> {
    if (!clientId) {
        return NextResponse.json({ error: "Missing clientId" }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Build update object with only provided fields
    const updates: Record<string, any> = {
        synced_at: new Date().toISOString()
    }

    // Map possible field names
    if (data?.FirstName || data?.firstName) updates.first_name = data.FirstName || data.firstName
    if (data?.LastName || data?.lastName) updates.last_name = data.LastName || data.lastName
    if (data?.Email || data?.email) updates.email = data.Email || data.email
    if (data?.MobilePhone || data?.mobilePhone) updates.mobile_phone = data.MobilePhone || data.mobilePhone
    if (data?.HomePhone || data?.homePhone) updates.home_phone = data.HomePhone || data.homePhone
    if (data?.Gender || data?.gender) updates.gender = data.Gender || data.gender
    if (data?.BirthDate || data?.birthDate) updates.birth_date = data.BirthDate || data.birthDate
    if (data?.Status || data?.status) updates.membership_status = data.Status || data.status
    if (data?.PhotoUrl || data?.photoUrl) updates.photo_url = data.PhotoUrl || data.photoUrl

    await supabase
        .from("mb_members")
        .update(updates)
        .eq("mb_client_id", clientId)

    logger.info('WEBHOOK', 'Member updated', { clientId, fields: Object.keys(updates) })
    return NextResponse.json({ received: true, handled: true, action: "client_updated", clientId })
}

// ============================================
// HANDLER: Client Merged
// ============================================
async function handleClientMerged(data?: any): Promise<NextResponse> {
    // Mindbody sends winnerClientId and loserClientId (or similar)
    const winnerId = data?.winnerClientId?.toString() ||
        data?.WinnerClientId?.toString() ||
        data?.targetClientId?.toString()
    const loserId = data?.loserClientId?.toString() ||
        data?.LoserClientId?.toString() ||
        data?.sourceClientId?.toString()

    if (!winnerId || !loserId) {
        logger.warn('WEBHOOK', 'Merge event missing client IDs', { data })
        return NextResponse.json({ error: "Missing winner or loser clientId" }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Mark the loser as merged (soft delete)
    const { error } = await supabase
        .from("mb_members")
        .update({
            is_merged: true,
            merged_into_id: winnerId,
            merged_at: data?.mergeDateTime || new Date().toISOString(),
            synced_at: new Date().toISOString()
        })
        .eq("mb_client_id", loserId)

    if (error) {
        logger.error('WEBHOOK', 'Failed to mark member as merged', { loserId, winnerId, error: error.message })
        return NextResponse.json({ received: true, handled: false, error: error.message })
    }

    logger.info('WEBHOOK', 'Member merged', { loserId, winnerId })
    return NextResponse.json({
        received: true,
        handled: true,
        action: "client_merged",
        loserId,
        winnerId
    })
}

// ============================================
// HANDLER: Membership Created
// ============================================
async function handleMembershipCreated(
    clientId?: string,
    data?: any
): Promise<NextResponse> {
    if (!clientId) {
        return NextResponse.json({ error: "Missing clientId" }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Update member status to Active
    await supabase
        .from("mb_members")
        .update({
            membership_status: "Active",
            membership_name: data?.MembershipName || data?.membershipName,
            synced_at: new Date().toISOString()
        })
        .eq("mb_client_id", clientId)

    logger.info('WEBHOOK', 'Membership created', { clientId })
    return NextResponse.json({ received: true, handled: true, action: "membership_created", clientId })
}

// ============================================
// HANDLER: Membership Cancelled
// ============================================
async function handleMembershipCancelled(
    clientId?: string,
    membershipId?: string,
    data?: any
): Promise<NextResponse> {
    if (!clientId) {
        return NextResponse.json({ error: "Missing clientId" }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Update membership if we track it
    if (membershipId) {
        await supabase
            .from("mb_memberships")
            .update({
                status: "Terminated",
                termination_date: new Date().toISOString().split("T")[0],
                at_risk: false,
                synced_at: new Date().toISOString(),
            })
            .eq("mb_membership_id", membershipId)
    }

    // Update member status
    await supabase
        .from("mb_members")
        .update({
            membership_status: "Terminated",
            synced_at: new Date().toISOString(),
        })
        .eq("mb_client_id", clientId)

    logger.info('WEBHOOK', 'Membership cancelled', { clientId, membershipId })
    return NextResponse.json({ received: true, handled: true, action: "membership_cancelled", clientId })
}

// ============================================
// HANDLER: Sale Created
// ============================================
async function handleSaleCreated(data?: any): Promise<NextResponse> {
    if (!data) {
        return NextResponse.json({ error: "Missing sale data" }, { status: 400 })
    }

    const supabase = createServiceClient()
    const saleId = data.SaleId?.toString() || data.saleId?.toString() || data.Id?.toString()
    const clientId = data.ClientId?.toString() || data.clientId?.toString()

    logger.info('WEBHOOK', 'Sale created', { saleId, clientId })

    // Upsert the transaction
    const { error } = await supabase.from('mb_transactions').upsert({
        mb_sale_id: saleId,
        mb_transaction_id: data.TransactionId?.toString() || saleId,
        mb_client_id: clientId,
        gross_amount: data.GrossAmount || data.grossAmount || data.Amount || 0,
        net_amount: data.NetAmount || data.netAmount || data.Amount || 0,
        payment_type: data.PaymentType || data.paymentType || data.Method || '',
        status: data.Status || data.status || 'Approved',
        description: data.Description || data.description || data.ItemName,
        transaction_date: data.SaleDateTime || data.saleDateTime || data.TransactionTime || new Date().toISOString(),
        synced_at: new Date().toISOString(),
    }, {
        onConflict: 'mb_transaction_id'
    })

    if (error) {
        logger.error('WEBHOOK', 'Sale upsert error', { saleId, error: error.message })
        return NextResponse.json({ received: true, handled: false, error: error.message })
    }

    return NextResponse.json({ received: true, handled: true, action: "sale_synced", saleId })
}

// ============================================
// HEAD/GET for webhook verification
// ============================================
export async function HEAD() {
    return new NextResponse(null, { status: 200 })
}

export async function GET() {
    return NextResponse.json({
        status: "Mindbody webhook endpoint active",
        events: [
            "client.created",
            "client.updated",
            "clientProfileMerger.created",
            "clientMembershipAssignment.created",
            "clientMembershipAssignment.cancelled",
            "clientSale.created"
        ]
    })
}
