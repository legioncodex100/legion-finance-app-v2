// Mindbody API Configuration
export const MINDBODY_CONFIG = {
    // API Base URL
    apiBaseUrl: 'https://api.mindbodyonline.com/public/v6',

    // User Token Endpoint
    userTokenUrl: 'https://api.mindbodyonline.com/public/v6/usertoken/issue',

    // Default sync settings
    sync: {
        defaultDaysBack: 30,        // How many days of sales to sync
        maxRecordsPerRequest: 200,  // Mindbody pagination limit
    }
} as const

// Environment variable helpers
export function getMindbodyEnv() {
    return {
        apiKey: process.env.MINDBODY_API_KEY || '',
        siteId: process.env.MINDBODY_SITE_ID || '',
        locationId: process.env.MINDBODY_LOCATION_ID ? parseInt(process.env.MINDBODY_LOCATION_ID) : undefined,
        staffUsername: process.env.MINDBODY_STAFF_USERNAME || '',
        staffPassword: process.env.MINDBODY_STAFF_PASSWORD || '',
    }
}

export function isMindbodyConfigured(): boolean {
    const env = getMindbodyEnv()
    return !!(env.apiKey && env.siteId)
}

export function hasMindbodyStaffCredentials(): boolean {
    const env = getMindbodyEnv()
    return !!(env.staffUsername && env.staffPassword)
}
