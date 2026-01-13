'use server'

import { createClient } from "@/lib/supabase/server"

export async function uploadBillDocument(
    base64Data: string,
    mimeType: string,
    billId: string
): Promise<{ url: string | null; error: string | null }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { url: null, error: "Not authenticated" }
    }

    // Convert base64 to buffer
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
    const buffer = Buffer.from(base64Content, 'base64')

    // Determine file extension
    const ext = mimeType.includes('pdf') ? 'pdf' :
        mimeType.includes('png') ? 'png' :
            mimeType.includes('webp') ? 'webp' : 'jpg'

    // Create unique filename
    const filename = `${user.id}/${billId}.${ext}`

    try {
        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
            .from('bill-documents')
            .upload(filename, buffer, {
                contentType: mimeType,
                upsert: true
            })

        if (uploadError) {
            console.error("Upload error:", uploadError)
            return { url: null, error: uploadError.message }
        }

        // Get public URL (or signed URL for private buckets)
        const { data: urlData } = await supabase.storage
            .from('bill-documents')
            .createSignedUrl(filename, 60 * 60 * 24 * 365) // 1 year signed URL

        if (urlData?.signedUrl) {
            return { url: urlData.signedUrl, error: null }
        }

        // Fallback: store the path and generate URL on demand
        return { url: filename, error: null }
    } catch (error) {
        console.error("Document upload failed:", error)
        return { url: null, error: "Failed to upload document" }
    }
}

export async function getSignedDocumentUrl(documentPath: string): Promise<string | null> {
    const supabase = await createClient()

    // If it's already a full URL, return it
    if (documentPath.startsWith('http')) {
        return documentPath
    }

    // Otherwise generate a signed URL
    const { data } = await supabase.storage
        .from('bill-documents')
        .createSignedUrl(documentPath, 60 * 60) // 1 hour signed URL

    return data?.signedUrl || null
}
