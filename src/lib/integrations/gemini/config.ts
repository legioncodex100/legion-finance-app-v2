// Gemini Integration Configuration
export const GEMINI_CONFIG = {
    // Available models
    models: {
        flash: {
            id: 'gemini-2.0-flash-exp',
            name: 'Gemini 2.0 Flash',
            description: 'Fast, efficient for most tasks',
            costTier: 'low'
        },
        flashLatest: {
            id: 'gemini-1.5-flash-latest',
            name: 'Gemini 1.5 Flash',
            description: 'Stable flash model',
            costTier: 'low'
        },
        pro: {
            id: 'gemini-1.5-pro-latest',
            name: 'Gemini 1.5 Pro',
            description: 'Most capable, best for complex tasks',
            costTier: 'high'
        }
    },

    // Default model assignments by task
    defaults: {
        categorization: 'flash',      // Fast categorization
        chat: 'flash',                // Financial AI chat
        ocr: 'flash',                 // Bill document analysis
        notesCleanup: 'flash'         // Budget notes
    } as const,

    // Rate limiting
    rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 1000000
    }
} as const

export type GeminiModelKey = keyof typeof GEMINI_CONFIG.models
export type GeminiTaskType = keyof typeof GEMINI_CONFIG.defaults

export function getModelId(taskType: GeminiTaskType): string {
    const modelKey = GEMINI_CONFIG.defaults[taskType]
    return GEMINI_CONFIG.models[modelKey].id
}

export function getModelInfo(modelKey: GeminiModelKey) {
    return GEMINI_CONFIG.models[modelKey]
}
