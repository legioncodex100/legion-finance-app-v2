import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Mindbody Webhook Handler
 * 
 * Listens for:
 * - clientMembershipAssignment.cancelled
 * - client.updated (for decline detection)
 * 
 * POST /api/webhooks/mindbody
 */

// Event types we handle
type MindbodyEvent =
    | "clientMembershipAssignment.cancelled"
    | "client.updated"
    | "sale.created"

interface WebhookPayload {
    eventType: MindbodyEvent
    clientId?: string
    membershipId?: string
    data?: any
    timestamp?: string
}

export async function POST(request: NextRequest) {
    try {
        const payload: WebhookPayload = await request.json()
        const { eventType, clientId, membershipId, data } = payload

        // Verify webhook signature (if Mindbody provides one)
        const signature = request.headers.get("x-mindbody-signature")
        // TODO: Implement signature verification when Mindbody provides docs

        // Route to handler
        switch (eventType) {
            case "clientMembershipAssignment.cancelled":
                return handleMembershipCancelled(clientId, membershipId, data)

            case "client.updated":
                return handleClientUpdated(clientId, data)

            case "sale.created":
                return handleSaleCreated(data)

            default:
                return NextResponse.json({ received: true, handled: false })
        }
    } catch (error) {
        console.error("Webhook error:", error)
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        )
    }
}

// Handler: Membership Cancelled
async function handleMembershipCancelled(
    clientId?: string,
    membershipId?: string,
    data?: any
): Promise<NextResponse> {
    if (!clientId || !membershipId) {
        return NextResponse.json({ error: "Missing clientId or membershipId" }, { status: 400 })
    }

    const supabase = await createClient()

    // Update membership status in our database
    await supabase
        .from("mb_memberships")
        .update({
            status: "Terminated",
            termination_date: new Date().toISOString().split("T")[0],
            at_risk: false,
            synced_at: new Date().toISOString(),
        })
        .eq("mb_membership_id", membershipId)

    // Update member record if exists
    await supabase
        .from("mb_members")
        .update({
            membership_status: "Terminated",
            synced_at: new Date().toISOString(),
        })
        .eq("mb_client_id", clientId)

    return NextResponse.json({ received: true, handled: true, action: "membership_cancelled" })
}

// Handler: Client Updated (for decline detection)
async function handleClientUpdated(
    clientId?: string,
    data?: any
): Promise<NextResponse> {
    if (!clientId) {
        return NextResponse.json({ error: "Missing clientId" }, { status: 400 })
    }

    const supabase = await createClient()
    const newStatus = data?.Status || data?.status

    // Update member status
    if (newStatus) {
        await supabase
            .from("mb_members")
            .update({
                membership_status: newStatus,
                synced_at: new Date().toISOString(),
            })
            .eq("mb_client_id", clientId)
    }

    return NextResponse.json({ received: true, handled: true, action: "client_updated" })
}

// Handler: Sale Created - insert transaction in real-time
async function handleSaleCreated(data?: any): Promise<NextResponse> {
    if (!data) {
        return NextResponse.json({ error: "Missing sale data" }, { status: 400 })
    }

    const supabase = await createClient()
    const saleId = data.SaleId?.toString() || data.Id?.toString()

    console.log("[WEBHOOK] Sale created:", saleId)

    // Upsert the transaction
    const { error } = await supabase.from('mb_transactions').upsert({
        mb_sale_id: saleId,
        mb_transaction_id: data.TransactionId?.toString() || saleId,
        mb_client_id: data.ClientId?.toString(),
        gross_amount: data.GrossAmount || data.Amount || 0,
        net_amount: data.NetAmount || data.Amount || 0,
        payment_type: data.PaymentType || data.Method || '',
        status: data.Status || 'Approved',
        description: data.Description || data.ItemName,
        transaction_date: data.SaleDateTime || data.TransactionTime || new Date().toISOString(),
        synced_at: new Date().toISOString(),
    }, {
        onConflict: 'mb_transaction_id'
    })

    if (error) {
        console.error("[WEBHOOK] Sale upsert error:", error.message)
        return NextResponse.json({ received: true, handled: false, error: error.message })
    }

    return NextResponse.json({ received: true, handled: true, action: "sale_synced", saleId })
}

// GET for webhook verification (some providers require this)
export async function GET() {
    return NextResponse.json({
        status: "Mindbody webhook endpoint active",
        events: [
            "clientMembershipAssignment.cancelled",
            "client.updated",
            "sale.created"
        ]
    })
}
