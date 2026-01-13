"use server"

import { MindbodyClient } from "@/lib/integrations/mindbody/client"
import { getMindbodyEnv } from "@/lib/integrations/mindbody/config"

/**
 * Debug function to see raw sales, contracts, and client data structure
 */
export async function debugSalesData(): Promise<{
    salesCount: number
    sampleSale: any
    itemTypes: string[]
    itemNames: string[]
    contracts: {
        count: number
        sample: any
        activeCount: number
    }
    sampleClient: any
}> {
    const client = new MindbodyClient()
    const env = getMindbodyEnv()

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30) // Last 30 days

    const sales = await client.getAllSales(startDate, endDate)

    // Fetch contracts
    const contracts = await client.getAllContracts(env.locationId)
    const activeContracts = contracts.filter((c: any) =>
        c.AutopayStatus?.Active === true || c.IsSigned === true
    )

    // Fetch a sample client to see membership fields
    const allClients = await client.getAllClients()
    const sampleClient = allClients[0] || null

    // Collect unique item types and names
    const itemTypes = new Set<string>()
    const itemNames = new Set<string>()

    for (const sale of sales) {
        const items = (sale as any).PurchasedItems || []
        for (const item of items) {
            if (item.IsService) itemTypes.add('Service')
            if (item.Description) itemNames.add(item.Description)
        }
    }

    return {
        salesCount: sales.length,
        sampleSale: sales[0] || null,
        itemTypes: Array.from(itemTypes),
        itemNames: Array.from(itemNames).slice(0, 20),
        contracts: {
            count: contracts.length,
            sample: contracts[0] || null,
            activeCount: activeContracts.length
        },
        sampleClient
    }
}

/**
 * Debug function to test the 4 new financial endpoints
 */
export async function debugNewEndpoints(): Promise<{
    services: {
        count: number
        sample: any
    }
    paymentReceipts: {
        count: number
        sample: any
        failedCount: number
        refundCount: number
    }
    clientContracts: {
        sample: any
        sampleClientId: string
    }
    clientPurchases: {
        sample: any
        sampleClientId: string
    }
}> {
    const client = new MindbodyClient()
    const env = getMindbodyEnv()

    // Get services / pricing catalog
    const services = await client.getAllServices(env.locationId)

    // Get payment receipts for last 30 days
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    const receipts = await client.getAllPaymentReceipts(startDate, endDate)
    const failedReceipts = receipts.filter((r: any) => r.IsVoided || r.Status === 'Declined')
    const refundReceipts = receipts.filter((r: any) => r.Type === 'Refund' || (r.Amount || 0) < 0)

    // Get a sample client's contracts and purchases (use first active client)
    const allClients = await client.getAllClients()
    const activeClient = allClients.find((c: any) => c.Status !== 'Non-Member') || allClients[0]
    const sampleClientId = activeClient?.Id?.toString() || ''

    let clientContractsSample = null
    let clientPurchasesSample = null

    if (sampleClientId) {
        try {
            const contractsResponse = await client.getClientContracts(sampleClientId)
            clientContractsSample = contractsResponse.ClientContracts?.[0] || contractsResponse
        } catch (e) {
            clientContractsSample = { error: 'Failed to fetch contracts' }
        }

        try {
            const purchasesResponse = await client.getClientPurchases(sampleClientId)
            clientPurchasesSample = purchasesResponse.Purchases?.[0] || purchasesResponse
        } catch (e) {
            clientPurchasesSample = { error: 'Failed to fetch purchases' }
        }
    }

    return {
        services: {
            count: services.length,
            sample: services[0] || null
        },
        paymentReceipts: {
            count: receipts.length,
            sample: receipts[0] || null,
            failedCount: failedReceipts.length,
            refundCount: refundReceipts.length
        },
        clientContracts: {
            sample: clientContractsSample,
            sampleClientId
        },
        clientPurchases: {
            sample: clientPurchasesSample,
            sampleClientId
        }
    }
}
