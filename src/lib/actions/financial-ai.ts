"use server"

import { createClient } from "@/lib/supabase/server"
import { getFinancialChatResponse } from "@/lib/ai/gemini"
import { createCategory } from "./transactions"
import { revalidatePath } from "next/cache"
import { getAISettings, getFinancialContext } from "./ai-settings"
import { buildDynamicContext } from "@/lib/ai/knowledge-base"

export async function askFinancialAI(messages: any[], pathname: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get user's AI settings
    const aiSettings = await getAISettings()

    // Get dynamic financial context
    const financialData = await getFinancialContext()

    // Fetch Categories for context
    const { data: categories } = await supabase
        .from('categories')
        .select('*, financial_classes(name)')
        .order('name')

    // Fetch Financial Classes for context
    const { data: classes } = await supabase
        .from('financial_classes')
        .select('*')
        .order('name')

    // Build chart of accounts context
    const accountsContext: string[] = ["## CHART OF ACCOUNTS"]
    if (categories) {
        categories.forEach(cat => {
            const typeStr = cat.type.toUpperCase()
            const classStr = cat.financial_classes?.name || "Unclassified"
            if (!cat.parent_id) {
                accountsContext.push(`- [GROUP] ${cat.name} (${typeStr} | ${classStr}) [ID: ${cat.id}]`)
                categories.filter(sub => sub.parent_id === cat.id).forEach(sub => {
                    accountsContext.push(`  - [SUB] ${sub.name} [ID: ${sub.id}]`)
                })
            }
        })
    }

    // Build financial classes context
    if (classes) {
        accountsContext.push("", "## ACCOUNTING CLASSES")
        classes.forEach(c => {
            accountsContext.push(`- ${c.name} [ID: ${c.id}]`)
        })
    }

    // Build dynamic context with financials
    const dynamicContext = aiSettings.includeFinancials
        ? buildDynamicContext({ ...financialData, currentPage: pathname })
        : `📍 **Current Page**: ${pathname}`

    // Combine all context
    const fullContext = [
        dynamicContext,
        "",
        accountsContext.join("\n"),
        "",
        aiSettings.customInstructions ? `## USER CUSTOM INSTRUCTIONS\n${aiSettings.customInstructions}` : "",
    ].filter(Boolean).join("\n")

    // Format messages helper
    const formatMessages = (msgs: any[]) => msgs.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: msg.parts ? msg.parts : [{ text: msg.content }]
    }))

    try {
        let currentMessages = [...messages]
        let response = await getFinancialChatResponse(
            formatMessages(currentMessages),
            fullContext,
            aiSettings.model,
            aiSettings.temperature
        )

        // Handle Tool Calls (single level for now)
        if (response.functionCalls && response.functionCalls.length > 0) {
            for (const call of response.functionCalls) {
                if (call.name === "create_category") {
                    const args: any = call.args
                    try {
                        const result = await createCategory({
                            name: args.name,
                            type: args.type,
                            parentId: args.parent_id,
                            classId: args.class_id
                        })

                        // Add function call and response to history
                        currentMessages.push({
                            role: 'model',
                            parts: [{ functionCall: call }]
                        })
                        currentMessages.push({
                            role: 'user',
                            parts: [{
                                functionResponse: {
                                    name: call.name,
                                    response: { success: true, category: result }
                                }
                            }]
                        })

                        revalidatePath(pathname)

                        // Get final response from AI explaining the creation
                        const finalResponse = await getFinancialChatResponse(
                            formatMessages(currentMessages),
                            fullContext,
                            aiSettings.model,
                            aiSettings.temperature
                        )
                        return { content: finalResponse.text, messages: currentMessages }
                    } catch (e: any) {
                        return { content: `I tried to create the category but ran into an error: ${e.message}` }
                    }
                }
            }
        }

        return { content: response.text }
    } catch (error) {
        console.error("Financial AI Action Error:", error)
        return { content: "I'm sorry, I'm having trouble processing your request right now." }
    }
}
