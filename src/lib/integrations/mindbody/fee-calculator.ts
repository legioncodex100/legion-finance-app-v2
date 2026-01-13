/**
 * UK Merchant Fee Calculator
 * Calculates fees for Mindbody transactions based on payment method
 * 
 * NOTE: Pure utility functions - NOT server actions
 */

export interface FeeCalculation {
    fee: number
    rate: number
    fixedFee: number
    feeType: 'card_present' | 'card_not_present' | 'bacs' | 'chargeback' | 'none'
}

// UK Merchant Rates
const RATES = {
    CARD_NOT_PRESENT: { rate: 0.0199, fixedFee: 0.20 },  // 1.99% + £0.20
    CARD_PRESENT: { rate: 0.0175, fixedFee: 0 },          // 1.75% flat
    BACS_DIRECT_DEBIT: { rate: 0.01, fixedFee: 0.20 },    // 1.00% + £0.20
    CHARGEBACK: { fee: 25.00 },                            // £25.00 flat
}

/**
 * Calculate merchant fee for a single transaction
 * 
 * @param amount - Transaction amount in GBP
 * @param paymentType - Payment type from Mindbody (e.g., 'CreditCard', 'DirectDebit', 'Account')
 * @param entryMethod - Entry method from Mindbody (e.g., 'CardPresent', 'CardNotPresent', 'Bacs')
 * @returns Fee calculation details
 */
export function calculateMerchantFee(
    amount: number,
    paymentType: string,
    entryMethod: string
): FeeCalculation {
    // Skip "On Account" payments - no card was processed
    if (paymentType === 'Account' || paymentType === 'OnAccount') {
        return { fee: 0, rate: 0, fixedFee: 0, feeType: 'none' }
    }

    // Skip cash payments
    if (paymentType === 'Cash') {
        return { fee: 0, rate: 0, fixedFee: 0, feeType: 'none' }
    }

    // Bacs Direct Debit: 1.00% + £0.20
    if (paymentType === 'DirectDebit' || entryMethod === 'Bacs' || entryMethod === 'DirectDebit') {
        const { rate, fixedFee } = RATES.BACS_DIRECT_DEBIT
        const fee = (amount * rate) + fixedFee
        return { fee: Math.round(fee * 100) / 100, rate, fixedFee, feeType: 'bacs' }
    }

    // Card Present: 1.75% flat
    if (entryMethod === 'CardPresent' || entryMethod === 'Chip' || entryMethod === 'Swipe') {
        const { rate, fixedFee } = RATES.CARD_PRESENT
        const fee = amount * rate
        return { fee: Math.round(fee * 100) / 100, rate, fixedFee, feeType: 'card_present' }
    }

    // Card Not Present: 1.99% + £0.20 (default for credit cards)
    const { rate, fixedFee } = RATES.CARD_NOT_PRESENT
    const fee = (amount * rate) + fixedFee
    return { fee: Math.round(fee * 100) / 100, rate, fixedFee, feeType: 'card_not_present' }
}

/**
 * Calculate total fees for a batch of transactions
 * CRITICAL: The £0.20 fixed fee is PER TRANSACTION
 * In a batch of 100 transactions, that's £20 in fixed fees alone!
 */
export function calculateBatchFees(
    transactions: { amount: number; paymentType: string; entryMethod: string }[]
): {
    totalFees: number
    totalFixedFees: number
    totalPercentageFees: number
    breakdown: {
        cardPresent: { count: number; fees: number }
        cardNotPresent: { count: number; fees: number }
        bacs: { count: number; fees: number }
        skipped: { count: number }
    }
} {
    let totalFees = 0
    let totalFixedFees = 0
    let totalPercentageFees = 0

    const breakdown = {
        cardPresent: { count: 0, fees: 0 },
        cardNotPresent: { count: 0, fees: 0 },
        bacs: { count: 0, fees: 0 },
        skipped: { count: 0 },
    }

    for (const tx of transactions) {
        const calc = calculateMerchantFee(tx.amount, tx.paymentType, tx.entryMethod)

        if (calc.feeType === 'none') {
            breakdown.skipped.count++
            continue
        }

        totalFees += calc.fee
        totalFixedFees += calc.fixedFee
        totalPercentageFees += calc.fee - calc.fixedFee

        switch (calc.feeType) {
            case 'card_present':
                breakdown.cardPresent.count++
                breakdown.cardPresent.fees += calc.fee
                break
            case 'card_not_present':
                breakdown.cardNotPresent.count++
                breakdown.cardNotPresent.fees += calc.fee
                break
            case 'bacs':
                breakdown.bacs.count++
                breakdown.bacs.fees += calc.fee
                break
        }
    }

    return {
        totalFees: Math.round(totalFees * 100) / 100,
        totalFixedFees: Math.round(totalFixedFees * 100) / 100,
        totalPercentageFees: Math.round(totalPercentageFees * 100) / 100,
        breakdown,
    }
}

/**
 * Estimate if a bank deposit matches Mindbody net after fees
 * Uses £0.05 margin for rounding differences
 */
export function checkReconciliation(
    mbNet: number,
    bankDeposit: number,
    marginGBP: number = 0.05
): {
    matched: boolean
    variance: number
} {
    const variance = Math.abs(mbNet - bankDeposit)
    return {
        matched: variance <= marginGBP,
        variance: Math.round(variance * 100) / 100,
    }
}
