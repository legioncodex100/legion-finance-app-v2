// Mindbody API Types

// OAuth Token Response
export interface MindbodyTokenResponse {
    access_token: string
    refresh_token?: string
    token_type: string
    expires_in: number
    scope?: string
}

// Sale from Mindbody API
export interface MindbodySale {
    Id: number
    SaleDate: string
    SaleTime: string
    SaleDateTime: string
    ClientId: string
    ClientName?: string
    ClientFirstName?: string
    ClientLastName?: string
    LocationId: number
    TotalAmount: number
    TotalAmountPaid: number
    TotalTax: number
    TotalDiscount: number
    Payments: MindbodyPayment[]
    Items: MindbodySaleItem[]
}

export interface MindbodyPayment {
    Id: number
    Amount: number
    Method: string
    Type: string
    LastFour?: string
    Notes?: string
}

export interface MindbodySaleItem {
    Id: number
    Name: string
    Type: 'Service' | 'Product' | 'Package' | 'Other'
    Price: number
    Quantity: number
    TotalAmount: number
    CategoryId?: number
    CategoryName?: string
}

// API Response Wrapper
export interface MindbodyApiResponse<T> {
    PaginationResponse?: {
        RequestedLimit: number
        RequestedOffset: number
        PageSize: number
        TotalResults: number
    }
    Sales?: T[]
    Clients?: T[]
    Error?: {
        Message: string
        Code: string
    }
}

// Sync Result
export interface MindbodySyncResult {
    success: boolean
    salesFetched: number
    transactionsCreated: number
    transactionsSkipped: number
    errors: string[]
    syncedFrom: string
    syncedTo: string
}
