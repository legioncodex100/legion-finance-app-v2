import { SchemaType, Part } from "@google/generative-ai";
import { getGeminiModel, getGeminiClient, isGeminiConfigured } from "@/lib/integrations";
import { ARIA_SYSTEM_PROMPT } from "@/lib/ai/knowledge-base";

export async function categorizeTransaction(description: string, amount: number, type: string) {
    if (!isGeminiConfigured()) {
        console.warn("Gemini API Key missing, skipping categorization.");
        return "OTHER > UNIDENTIFIED";
    }

    try {
        const model = getGeminiModel('categorization');

        const prompt = `
      You are a specialized financial assistant for 'Legion Grappling Academy'.
      Categorize this transaction into a 'Category > Subcategory' format.
      
      STRUCTURE (Respond ONLY with 'PARENT > SUB' in ALL CAPS):
      
      - REVENUE > MEMBERSHIPS: Mindbody, regular dues, member payments.
      - REVENUE > DROP-INS: Stripe, Square, guest fees, seminars, cash.
      - REVENUE > MERCHANDISE: Gi sales, apparel, equipment.
      
      - STAFF > WAGES: Coaches (Amir, Khalid), instructors, cleaning staff.
      - STAFF > BENEFITS: Insurance, training courses, staff meals.
      
      - FACILITY > RENT: Monthly commercial rent, property fees.
      - FACILITY > UTILITIES: Gas, Electric (British Gas, E.ON), Water, Internet.
      - FACILITY > MAINTENANCE: Screwfix, B&Q, repairs, janitorial supplies.
      
      - OPERATIONS > SOFTWARE: Lucid, OpenAI, Adobe, Zoho, Mindbody fees, website hosting (Cloudways, DigitalOcean).
      - OPERATIONS > MARKETING: Google Ads, Meta Ads, flyers.
      - OPERATIONS > PROFESSIONAL: Accountants, legal fees, consultants.
      - OPERATIONS > BANK FEES: Starling fees, interest, currency exchange.
      - OPERATIONS > HARDWARE: Computers, cameras, phones from Apple, Curry's.
      
      - MEALS > BUSINESS: Uber Eats, Deliveroo (only if business related), coffee for meetings.
      - TRAVEL > BUSINESS: Train tickets, fuel for academy business.
      
      - DEBT > REPAYMENT: Bank loans, interest payments.
      
      - OTHER > UNIDENTIFIED: If absolutely no other category fits.

      Transaction: "${description}" | £${amount} | Type: ${type}
      Respond ONLY with 'CATEGORY > SUBCATEGORY' (all caps).
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim().toUpperCase();

        // Basic validation of format
        if (text.includes(' > ')) return text;
        return `${text} > GENERAL`;
    } catch (error) {
        console.error("Gemini Categorization Error:", error);
        return "OTHER > UNIDENTIFIED";
    }
}

// On-demand category name suggestion based on transaction label, reference, and bank category
export async function suggestCategoryName(label: string, reference: string, bankCategory?: string): Promise<string> {
    if (!isGeminiConfigured()) {
        console.warn("Gemini API Key missing, skipping suggestion.");
        return "";
    }

    try {
        const model = getGeminiModel('categorization');

        const bankCategoryContext = bankCategory
            ? `\nBank's Original Category: "${bankCategory}" (use this as a strong hint)`
            : '';

        const prompt = `
You are a financial assistant helping categorize transactions for a martial arts academy.

Based on the following transaction details, suggest a SHORT, CLEAR category name (2-4 words max).
Focus on what the transaction represents, not the vendor name.

Transaction Label: "${label}"
Reference: "${reference}"${bankCategoryContext}

Examples of good category names:
- "Mat Cleaning Supplies"
- "Monthly Rent"
- "Coaching Wages"
- "Software Subscription"
- "Member Dues"
- "Equipment Purchase"

Respond with ONLY the suggested category name, nothing else.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Gemini Suggestion Error:", error);
        return "";
    }
}


export async function getFinancialChatResponse(
    messages: { role: 'user' | 'model', parts: { text?: string, functionCall?: any, functionResponse?: any }[] }[],
    context: string,
    modelId: string = 'gemini-2.0-flash-exp',
    temperature: number = 0.7
) {
    if (!isGeminiConfigured()) {
        throw new Error("Gemini API Key missing");
    }

    try {
        const client = getGeminiClient();
        const model = client.getGenerativeModel({
            model: modelId,
            generationConfig: {
                temperature,
            },
            tools: [{
                functionDeclarations: [
                    {
                        name: "create_category",
                        description: "Create a new financial category or subcategory",
                        parameters: {
                            type: SchemaType.OBJECT,
                            properties: {
                                name: { type: SchemaType.STRING, description: "The name of the category" },
                                type: { type: SchemaType.STRING, enum: ["income", "expense"], description: "Whether this is an income or expense category" } as any,
                                parent_id: { type: SchemaType.STRING, description: "Optional UUID of the parent category if this is a subcategory" },
                                class_id: { type: SchemaType.STRING, description: "Optional UUID of the financial class (e.g. Revenue, Staff, Facility)" }
                            },
                            required: ["name", "type"]
                        } as any
                    }
                ]
            }],
            systemInstruction: `${ARIA_SYSTEM_PROMPT}

## LIVE CONTEXT
${context}

## TOOL USAGE
When the user asks you to create a category, use the 'create_category' tool.
Always check the context to ensure the category doesn't already exist.
If creating a SUB-category, find the parent_id from context.
If creating a category, find the most appropriate class_id from context.
`
        });

        // Filter history to ensure it starts with a user message (Gemini requirement)
        const formattedHistory = messages.slice(0, -1).map(m => ({
            role: m.role,
            parts: m.parts.map(p => {
                if (p.functionCall) return { functionCall: p.functionCall }
                if (p.functionResponse) return { functionResponse: p.functionResponse }
                return { text: p.text || "" }
            }) as Part[]
        }));

        // Find first user message and slice from there
        const firstUserIndex = formattedHistory.findIndex(m => m.role === 'user');
        const validHistory = firstUserIndex >= 0 ? formattedHistory.slice(firstUserIndex) : [];

        const chat = model.startChat({
            history: validHistory,
        });

        const lastMessage = messages[messages.length - 1];

        // Handle if last message was a function response
        let result;
        if (lastMessage.parts[0].functionResponse) {
            result = await chat.sendMessage(lastMessage.parts.map(p => ({ functionResponse: p.functionResponse })) as Part[]);
        } else {
            result = await chat.sendMessage(lastMessage.parts[0].text || "");
        }

        const response = await result.response;
        const functionCalls = response.functionCalls();
        const text = response.text();

        return {
            text: text || "",
            functionCalls: functionCalls || []
        };
    } catch (error) {
        console.error("Gemini Chat Error:", error);
        throw error;
    }
}
