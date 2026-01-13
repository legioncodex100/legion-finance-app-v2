// AI Settings Types
export interface AISettings {
    model: 'gemini-2.0-flash-exp' | 'gemini-1.5-flash-latest' | 'gemini-1.5-pro-latest';
    temperature: number; // 0.1 - 1.0
    includeTransactions: boolean;
    includeFinancials: boolean;
    customInstructions: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
    model: 'gemini-2.0-flash-exp',
    temperature: 0.7,
    includeTransactions: true,
    includeFinancials: true,
    customInstructions: '',
};

export const AVAILABLE_MODELS = [
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash (Experimental)',
        description: 'Latest model with best performance',
        recommended: true,
    },
    {
        id: 'gemini-1.5-flash-latest',
        name: 'Gemini 1.5 Flash',
        description: 'Fast responses, good for quick queries',
        recommended: false,
    },
    {
        id: 'gemini-1.5-pro-latest',
        name: 'Gemini 1.5 Pro',
        description: 'More capable, better for complex analysis',
        recommended: false,
    },
] as const;
