import Papa from "papaparse"
import { Transaction, TransactionType } from "@/types"

export interface StarlingRow {
    Date: string
    "Counter Party": string
    Reference: string
    Type: string
    "Amount (GBP)": string
    "Balance (GBP)": string
    "Spending Category": string
    Notes: string
}

// Starling transaction types that indicate outgoing payments (expenses)
const EXPENSE_TYPES = [
    'FASTER PAYMENT OUT',
    'OUTGOING',
    'DIRECT DEBIT',
    'CARD PAYMENT',
    'FEE',
    'TRANSFER OUT',
    'STANDING ORDER',
    'WITHDRAWAL'
]

// Starling transaction types that indicate incoming payments (income)
const INCOME_TYPES = [
    'FASTER PAYMENT IN',
    'INBOUND',
    'INTEREST',
    'DEPOSIT',
    'TRANSFER IN',
    'REFUND'
]

export const parseStarlingCSV = (file: File): Promise<Partial<Transaction>[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as StarlingRow[]
                const transactions: Partial<Transaction>[] = data.map((row, index) => {
                    const rawAmount = parseFloat(row["Amount (GBP)"])
                    const txType = (row.Type || '').toUpperCase()

                    // Determine type: prioritize the sign of amount, fallback to Type column
                    let type: TransactionType
                    if (rawAmount < 0) {
                        type = "expense"
                    } else if (rawAmount > 0) {
                        type = "income"
                    } else {
                        // Zero amount - use Type column to determine
                        const isExpenseType = EXPENSE_TYPES.some(t => txType.includes(t))
                        type = isExpenseType ? "expense" : "income"
                    }

                    return {
                        date: new Date(row.Date.split("/").reverse().join("-")), // DD/MM/YYYY to YYYY-MM-DD
                        description: row.Reference,
                        party: row["Counter Party"],
                        amount: Math.abs(rawAmount),
                        type,
                        aiSuggestedCategory: row["Spending Category"],
                        // Include row index and counter party for better uniqueness
                        importHash: `${index}-${row.Date}-${row["Counter Party"]}-${row.Reference}-${row["Amount (GBP)"]}-${row["Balance (GBP)"]}`,
                        aiConfirmed: false,
                    }
                })

                resolve(transactions)
            },
            error: (error) => reject(error),
        })
    })
}
