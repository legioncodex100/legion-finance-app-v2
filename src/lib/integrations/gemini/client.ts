import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import { getModelId, GeminiTaskType } from "./config"

// Singleton instances cache
let genAIInstance: GoogleGenerativeAI | null = null
const modelCache: Map<string, GenerativeModel> = new Map()

/**
 * Get the Gemini API key from environment
 * Uses GEMINI_API_KEY as the canonical env var
 */
export function getGeminiApiKey(): string | null {
    // Check canonical env var first, then fallback
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || null
}

/**
 * Check if Gemini is configured and available
 */
export function isGeminiConfigured(): boolean {
    return !!getGeminiApiKey()
}

/**
 * Get the GoogleGenerativeAI client instance
 * Creates singleton for efficiency
 */
export function getGeminiClient(): GoogleGenerativeAI {
    const apiKey = getGeminiApiKey()

    if (!apiKey) {
        throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.')
    }

    if (!genAIInstance) {
        genAIInstance = new GoogleGenerativeAI(apiKey)
    }

    return genAIInstance
}

/**
 * Get a model instance for a specific task type
 * Uses configuration to determine appropriate model
 */
export function getGeminiModel(taskType: GeminiTaskType): GenerativeModel {
    const modelId = getModelId(taskType)

    // Check cache
    if (modelCache.has(modelId)) {
        return modelCache.get(modelId)!
    }

    const client = getGeminiClient()
    const model = client.getGenerativeModel({ model: modelId })

    // Cache for reuse
    modelCache.set(modelId, model)

    return model
}

/**
 * Get a specific model by ID (for custom use cases)
 */
export function getGeminiModelById(modelId: string): GenerativeModel {
    if (modelCache.has(modelId)) {
        return modelCache.get(modelId)!
    }

    const client = getGeminiClient()
    const model = client.getGenerativeModel({ model: modelId })

    modelCache.set(modelId, model)

    return model
}

/**
 * Test the Gemini connection with a simple request
 */
export async function testGeminiConnection(): Promise<{
    success: boolean
    latencyMs: number
    model: string
    error?: string
}> {
    const startTime = Date.now()

    try {
        const model = getGeminiModel('categorization')
        const result = await model.generateContent('Say "connected" if you can read this.')
        const response = await result.response
        const text = response.text()

        return {
            success: text.toLowerCase().includes('connected'),
            latencyMs: Date.now() - startTime,
            model: getModelId('categorization')
        }
    } catch (error) {
        return {
            success: false,
            latencyMs: Date.now() - startTime,
            model: getModelId('categorization'),
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Clear the model cache (useful for hot reloading config)
 */
export function clearGeminiCache(): void {
    modelCache.clear()
    genAIInstance = null
}
