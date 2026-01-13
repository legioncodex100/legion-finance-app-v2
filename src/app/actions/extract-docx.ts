"use server"

import mammoth from 'mammoth'

export async function extractTextFromDocx(base64Data: string): Promise<string> {
    try {
        // Convert base64 to Buffer
        const buffer = Buffer.from(base64Data, 'base64')

        // Extract text using mammoth
        const result = await mammoth.extractRawText({ buffer })

        return result.value
    } catch (error) {
        console.error("Error extracting text from docx:", error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to extract text from Word document: ${errorMessage}`)
    }
}
