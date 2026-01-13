"use server"

import { getGeminiModel, isGeminiConfigured } from "@/lib/integrations"

interface ExtractedBillData {
    vendor_name: string | null
    amount: number | null
    due_date: string | null
    description: string | null
    frequency: string | null
    suggested_category: string | null
}

export async function extractBillFromImage(base64Image: string, mimeType: string): Promise<ExtractedBillData> {
    if (!isGeminiConfigured()) {
        console.error("Gemini API key not configured")
        throw new Error("Google Gemini API key not configured")
    }

    console.log("Image mimeType:", mimeType)
    console.log("Image base64 length:", base64Image.length)

    const model = getGeminiModel('ocr')

    const prompt = `Analyze this bill/invoice image and extract the following information in JSON format:
{
    "vendor_name": "The company or vendor name on the bill",
    "amount": The total amount due as a number (no currency symbols),
    "due_date": "The due date in YYYY-MM-DD format if found, otherwise null",
    "description": "A brief description of what the bill is for",
    "frequency": "monthly, quarterly, yearly, or null if unclear",
    "suggested_category": "Suggest ONE category from this list that best fits: Utilities, Rent, Insurance, Internet, Phone, Software Subscriptions, Equipment Rental, Maintenance, Cleaning, Security, Marketing, Professional Services, Bank Fees, or null if unclear"
}

Important:
- Extract the TOTAL AMOUNT DUE, not individual line items
- If the amount includes currency, just extract the number
- For dates: Parse carefully! "02 Jan 2026" = 2026-01-02 (January 2nd). "15/01/2026" = 2026-01-15. Convert ALL dates to YYYY-MM-DD format
- If the invoice shows "Due on Receipt", use the Invoice Date as the due_date
- If you cannot determine a field with confidence, set it to null
- Return ONLY valid JSON, no other text`

    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Image
                }
            }
        ])

        const response = result.response
        const text = response.text()

        // Extract JSON from response (it might have markdown code blocks)
        let jsonStr = text
        if (text.includes("```json")) {
            jsonStr = text.split("```json")[1].split("```")[0].trim()
        } else if (text.includes("```")) {
            jsonStr = text.split("```")[1].split("```")[0].trim()
        }

        const data = JSON.parse(jsonStr)

        return {
            vendor_name: data.vendor_name || null,
            amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || null,
            due_date: data.due_date || null,
            description: data.description || null,
            frequency: data.frequency || null,
            suggested_category: data.suggested_category || null
        }
    } catch (error) {
        console.error("Error extracting bill data:", error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to extract bill data: ${errorMessage}`)
    }
}

// Extract bill data from text (for Word documents)
export async function extractBillFromText(text: string): Promise<ExtractedBillData> {
    if (!isGeminiConfigured()) {
        console.error("Gemini API key not configured")
        throw new Error("Google Gemini API key not configured")
    }

    const model = getGeminiModel('ocr')

    const prompt = `Analyze this bill/invoice text and extract the following information in JSON format:
{
    "vendor_name": "The company or vendor name on the bill",
    "amount": The total amount due as a number (no currency symbols),
    "due_date": "The due date in YYYY-MM-DD format if found, otherwise null",
    "description": "A brief description of what the bill is for",
    "frequency": "monthly, quarterly, yearly, or null if unclear",
    "suggested_category": "Suggest ONE category from this list that best fits: Utilities, Rent, Insurance, Internet, Phone, Software Subscriptions, Equipment Rental, Maintenance, Cleaning, Security, Marketing, Professional Services, Bank Fees, or null if unclear"
}

Bill/Invoice Text:
${text}

Important:
- Extract the TOTAL AMOUNT DUE, not individual line items
- If the amount includes currency, just extract the number
- For dates: Convert ALL dates to YYYY-MM-DD format
- If you cannot determine a field with confidence, set it to null
- Return ONLY valid JSON, no other text`

    try {
        const result = await model.generateContent(prompt)
        const response = result.response
        const responseText = response.text()

        // Extract JSON from response
        let jsonStr = responseText
        if (responseText.includes("```json")) {
            jsonStr = responseText.split("```json")[1].split("```")[0].trim()
        } else if (responseText.includes("```")) {
            jsonStr = responseText.split("```")[1].split("```")[0].trim()
        }

        const data = JSON.parse(jsonStr)

        return {
            vendor_name: data.vendor_name || null,
            amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || null,
            due_date: data.due_date || null,
            description: data.description || null,
            frequency: data.frequency || null,
            suggested_category: data.suggested_category || null
        }
    } catch (error) {
        console.error("Error extracting bill data from text:", error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to extract bill data from text: ${errorMessage}`)
    }
}
