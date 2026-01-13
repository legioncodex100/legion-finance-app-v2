export type TransactionType = "income" | "expense";

export interface Category {
    id: string;
    name: string;
    groupId: string;
    type: TransactionType;
}

export interface CategoryGroup {
    id: string;
    name: string;
    class: "operating" | "financing" | "investing";
}

export interface Vendor {
    id: string;
    name: string;
    defaultCategoryId?: string;
    isRecurring: boolean;
}

export interface Transaction {
    id: string;
    userId: string;
    amount: number;
    description: string;
    vendorId?: string;
    date: Date;
    categoryId?: string;
    aiSuggestedCategory?: string;
    aiConfirmed: boolean;
    type: TransactionType;
    importHash: string;
}

export interface RecurringBill {
    id: string;
    name: string;
    amount: number;
    frequency: "weekly" | "monthly" | "yearly";
    nextDue: Date;
    isPaid: boolean;
}

export interface Staff {
    id: string;
    name: string;
    role: string;
    wageAmount: number;
    wageFrequency: string;
}

export interface Debt {
    id: string;
    creditorName: string;
    originalAmount: number;
    remainingBalance: number;
    monthlyPayment: number;
}

// Reconciliation Rules Feature
export type ReconciliationStatus =
    | 'unreconciled'
    | 'pending_approval'
    | 'approved'
    | 'rejected'
    | 'manually_matched'
    | 'exception';

export type MatchType = 'vendor' | 'description' | 'amount' | 'regex' | 'composite';

export interface ReconciliationRule {
    id: string;
    userId: string;
    name: string;
    description?: string;
    priority: number;
    isActive: boolean;

    // Match Criteria
    matchType: MatchType;
    matchVendorId?: string;
    matchDescriptionPattern?: string;
    matchAmountMin?: number;
    matchAmountMax?: number;
    matchTransactionType?: TransactionType;

    // Actions
    actionCategoryId?: string;
    actionNotesTemplate?: string;
    requiresApproval: boolean;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
    lastMatchedAt?: Date;
    matchCount: number;
}

export interface PendingMatch {
    id: string;
    userId: string;
    transactionId: string;
    ruleId: string;

    suggestedCategoryId?: string;
    suggestedNotes?: string;
    matchConfidence: number;

    status: 'pending' | 'approved' | 'rejected';
    createdAt: Date;
    reviewedAt?: Date;

    // Joined data for UI
    transaction?: any;
    rule?: ReconciliationRule;
    suggestedCategory?: Category;
}
