/**
 * Example Tests for Legion Finance
 * 
 * This file demonstrates how to write tests.
 * Run with: npm test
 */

import { formatCurrency, formatDate, cn } from '@/lib/utils'

// ============================================
// UNIT TESTS: Testing individual functions
// ============================================

describe('formatCurrency', () => {
    it('formats positive numbers with £ symbol', () => {
        expect(formatCurrency(100)).toBe('£100')
        expect(formatCurrency(1234.56)).toBe('£1,234.56')
    })

    it('formats zero correctly', () => {
        expect(formatCurrency(0)).toBe('£0')
    })

    it('handles negative numbers', () => {
        expect(formatCurrency(-50)).toBe('-£50')
    })
})

describe('formatDate', () => {
    it('formats dates in UK format', () => {
        const date = new Date('2026-01-14')
        const result = formatDate(date)
        // Should contain day, month, year
        expect(result).toMatch(/14/)
        expect(result).toMatch(/Jan|January|01/)
    })
})

describe('cn (classnames utility)', () => {
    it('combines class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('handles conditional classes', () => {
        const isActive = true
        const result = cn('base', isActive && 'active')
        expect(result).toContain('active')
    })

    it('ignores falsy values', () => {
        expect(cn('base', false && 'hidden', null, undefined)).toBe('base')
    })
})

// ============================================
// TESTING ASYNC FUNCTIONS
// ============================================

describe('async operations', () => {
    it('can test promises', async () => {
        const fetchData = async () => {
            return { success: true, data: [1, 2, 3] }
        }

        const result = await fetchData()
        expect(result.success).toBe(true)
        expect(result.data).toHaveLength(3)
    })
})

// ============================================
// TESTING ERROR CASES
// ============================================

describe('error handling', () => {
    it('can test functions that throw', () => {
        const throwingFunction = () => {
            throw new Error('Something went wrong')
        }

        expect(throwingFunction).toThrow('Something went wrong')
    })

    it('can test async functions that reject', async () => {
        const failingFetch = async () => {
            throw new Error('Network error')
        }

        await expect(failingFetch()).rejects.toThrow('Network error')
    })
})
