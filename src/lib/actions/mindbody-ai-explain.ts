"use server"

import { getGeminiModel, isGeminiConfigured } from "@/lib/integrations"

/**
 * Use AI to explain what's in a JSON response from a Mindbody API
 */
export async function explainMindbodyJson(
    endpointName: string,
    jsonData: any
): Promise<string> {
    if (!isGeminiConfigured()) {
        return "⚠️ Gemini API not configured. Add GEMINI_API_KEY to your environment."
    }

    try {
        const model = getGeminiModel('categorization')

        // Truncate JSON if too large
        const jsonStr = JSON.stringify(jsonData, null, 2)
        const truncatedJson = jsonStr.length > 4000
            ? jsonStr.slice(0, 4000) + '\n... (truncated)'
            : jsonStr

        const prompt = `You are a helpful assistant explaining Mindbody API responses for a martial arts gym owner.

API Endpoint: ${endpointName}

JSON Response:
\`\`\`json
${truncatedJson}
\`\`\`

Please provide a brief, useful explanation of this data:
1. **What This Data Shows** - A 1-2 sentence summary
2. **Key Fields** - List the most important fields and what they mean for a gym business
3. **Actionable Insights** - Any useful observations (e.g., "X members have autopay enabled", "Y payment failed")

Keep your response concise and focused on practical business insights. Use markdown formatting.`

        const result = await model.generateContent(prompt)
        const response = await result.response
        return response.text()
    } catch (error) {
        console.error("AI Explain Error:", error)
        return `❌ Failed to analyze: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
}
