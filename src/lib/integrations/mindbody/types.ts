// Mindbody API Types
// ============================================
// Complete type definitions for all Mindbody API entities
// ============================================

// ============================================
// TOKEN & AUTHENTICATION
// ============================================

// OAuth Token Response
export interface MindbodyTokenResponse {
    access_token: string
    refresh_token?: string
    token_type: string
    expires_in: number
    scope?: string
}

// Cached token with expiry tracking
export interface CachedToken {
    token: string
    expiresAt: number  // Unix timestamp
}

// ============================================
// CLIENT / MEMBER TYPES
// ============================================

export interface MindbodyClient {
    Id: number
    FirstName: string
    LastName: string
    Email: string | null
    MobilePhone: string | null
    HomePhone: string | null
    AddressLine1: string | null
    Address: string | null
    City: string | null
    State: string | null
    PostalCode: string | null
    Country: string | null
    BirthDate: string | null
    Gender: string | null
    Status: string  // Membership tier name or "Non-Member"
    Active: boolean
    CreationDate: string
    FirstAppointmentDate: string | null
    ReferredBy: string | null
    PhotoUrl: string | null
    UniqueId: number
    ProspectStage: {
        Id: number
        Description: string
    } | null
}

// ============================================
// CONTRACT / MEMBERSHIP TYPES
// ============================================

export interface MindbodyContract {
    Id: number
    ClientId: string
    OriginationLocationId: number
    Name: string
    Description: string | null
    AutoPay: boolean
    ContractStartDate: string
    ContractEndDate: string | null
    AgreementDate: string
    StartDate: string
    EndDate: string | null
    TerminationDate: string | null
    NumberOfAutopays: number
    AutopayStatus: 'Active' | 'Inactive' | 'Suspended' | null
    TotalAmount: number
    FirstAutopayFree: boolean
    LastAutopayDate: string | null
    RecurringPaymentAmountTotal: number
}

export interface MindbodyClientContract {
    Id: number
    ClientId: string
    ContractId: number
    ContractName: string
    AgreementDate: string
    StartDate: string
    EndDate: string | null
    AutoPay: boolean
    RecurringPaymentAmountTotal: number
}

export interface MindbodyActiveMembership {
    Id: number
    ClientId: string
    MembershipId: number
    Name: string
    ActiveDate: string
    ExpirationDate: string | null
    Count: number
    Remaining: number
    PaymentDate: string | null
    Program: {
        Id: number
        Name: string
    } | null
}

// ============================================
// TRANSACTION TYPES
// ============================================

export type MindbodyTransactionStatus =
    | 'Approved'
    | 'Declined'
    | 'Voided'
    | 'Approved (Voided)'
    | 'Scheduled'
    | 'Pending'
    | 'Credit'

export interface MindbodyTransaction {
    Id: number
    TransactionId: string
    SaleId: number
    ClientId: string
    TransactionTime: string
    TransactionDate: string
    Status: MindbodyTransactionStatus
    NetAmount: number
    GrossAmount: number
    Amount: number
    PaymentType: string
    Method: string
    EntryMethod: string | null
    SettlementId: string | null
    DeclineReason: string | null
    Description: string | null
    ItemName: string | null
    SaleDateTime: string | null
}

// ============================================
// SALE TYPES
// ============================================

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
    PurchasedItems?: MindbodyPurchasedItem[]
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

export interface MindbodyPurchasedItem {
    Id: number
    IsService: boolean
    Name: string
    Description: string
    UnitPrice: number
    TotalAmount: number
    Quantity: number
    ExpDate: string | null
}

// ============================================
// CLASS TYPES
// ============================================

export interface MindbodyClass {
    Id: number
    ClassDescriptionId: number
    StartDateTime: string
    EndDateTime: string
    LocationId: number
    MaxCapacity: number
    TotalBooked: number
    TotalBookedWaitlist: number
    IsCanceled: boolean
    IsEnrolled: boolean
    IsAvailable: boolean
    Name: string
    ClassDescription: {
        Id: number
        Name: string
        Description: string | null
    } | null
    Staff: {
        Id: number
        Name: string
        FirstName: string
        LastName: string
    } | null
}

export interface MindbodyClassVisit {
    Id: number
    ClientId: string
    ClassId: number
    StartDateTime: string
    EndDateTime: string
    SignedIn: boolean
    LateCancelled: boolean
    MakeUp: boolean
    Name: string
    Client: {
        Id: string
        FirstName: string
        LastName: string
    }
}

// ============================================
// SERVICE / PRODUCT TYPES
// ============================================

export interface MindbodyService {
    Id: number
    Name: string
    Price: number
    OnlinePrice: number
    TaxIncluded: number
    TaxRate: number
    ProductId: number
    Count: number
    Type: string
    CategoryId: number | null
    CategoryName: string | null
}

// ============================================
// API RESPONSE WRAPPERS
// ============================================

export interface MindbodyApiResponse<T> {
    PaginationResponse?: {
        RequestedLimit: number
        RequestedOffset: number
        PageSize: number
        TotalResults: number
    }
    Sales?: T[]
    Clients?: T[]
    Contracts?: T[]
    Transactions?: T[]
    Classes?: T[]
    Services?: T[]
    ClientMemberships?: T[]
    ClientContracts?: T[]
    PaymentReceipts?: T[]
    Visits?: T[]
    Error?: {
        Message: string
        Code: string
    }
}

// Generic response for any array type
export interface MindbodyListResponse<K extends string, T> {
    PaginationResponse?: {
        RequestedLimit: number
        RequestedOffset: number
        PageSize: number
        TotalResults: number
    }
    Error?: {
        Message: string
        Code: string
    }
}

// ============================================
// CACHE TYPES
// ============================================

export interface CacheEntry<T> {
    data: T
    expiresAt: number  // Unix timestamp
    createdAt: number
}

export interface CacheConfig {
    tokenTtlMs: number      // Token cache TTL (default: 7 days - 5 min buffer)
    clientsTtlMs: number    // Clients cache TTL (default: 5 min)
    contractsTtlMs: number  // Contracts cache TTL (default: 5 min)
    staticTtlMs: number     // Static data TTL (services, etc.) (default: 1 hour)
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
    tokenTtlMs: 7 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000,  // 7 days minus 5 min buffer
    clientsTtlMs: 5 * 60 * 1000,      // 5 minutes
    contractsTtlMs: 5 * 60 * 1000,    // 5 minutes
    staticTtlMs: 60 * 60 * 1000,      // 1 hour
}

// ============================================
// SYNC RESULT TYPES
// ============================================

export interface MindbodySyncResult {
    success: boolean
    salesFetched: number
    transactionsCreated: number
    transactionsSkipped: number
    errors: string[]
    syncedFrom: string
    syncedTo: string
}

export interface MindbodyApiStats {
    apiCalls: number
    cacheHits: number
    rateLimitRetries: number
    startTime: number
    endTime?: number
}
