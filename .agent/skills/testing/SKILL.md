---
name: testing
description: Testing patterns for Legion Finance. Use when writing unit tests, component tests, or setting up test infrastructure. Covers Jest, React Testing Library, and test organization.
---

# Testing Skill

## When to Use
- Writing tests for new features
- Setting up test files
- Mocking dependencies
- Running the test suite

## Quick Commands

```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode (re-run on changes)
npm run test:coverage # Run tests with coverage report
```

## File Structure

```
src/
├── __tests__/              # Global test utilities and examples
│   └── example.test.ts     # Example patterns
├── lib/
│   ├── actions/
│   │   └── payables.test.ts    # Test alongside the file
│   └── utils.test.ts           # Or in same folder
└── components/
    └── vendor-list.test.tsx    # Component tests
```

## Test File Naming

| Pattern | When to Use |
|---------|-------------|
| `*.test.ts` | Unit tests for functions |
| `*.test.tsx` | Component tests |
| `*.spec.ts` | Alternative (same behavior) |

## Test Structure

```typescript
import { functionToTest } from '@/lib/utils'

describe('functionToTest', () => {
    // Group related tests with describe
    
    it('does something expected', () => {
        // Arrange
        const input = 'test'
        
        // Act
        const result = functionToTest(input)
        
        // Assert
        expect(result).toBe('expected')
    })

    it('handles edge cases', () => {
        expect(functionToTest(null)).toBeNull()
    })
})
```

## Common Matchers

```typescript
// Equality
expect(value).toBe(exact)           // Strict equality (===)
expect(value).toEqual(object)       // Deep equality for objects/arrays

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()

// Numbers
expect(value).toBeGreaterThan(3)
expect(value).toBeLessThan(5)
expect(value).toBeCloseTo(0.3)      // For floating point

// Strings
expect(string).toMatch(/regex/)
expect(string).toContain('substring')

// Arrays
expect(array).toContain(item)
expect(array).toHaveLength(3)

// Objects
expect(object).toHaveProperty('key')
expect(object).toHaveProperty('key', 'value')

// Errors
expect(() => fn()).toThrow()
expect(() => fn()).toThrow('message')
```

## Testing Async Code

```typescript
// Async/await
it('fetches data', async () => {
    const result = await fetchData()
    expect(result).toBeDefined()
})

// Testing rejections
it('handles errors', async () => {
    await expect(failingFn()).rejects.toThrow('error message')
})
```

## Mocking

### Mocking Supabase

```typescript
// Create a mock at the top of test file
jest.mock('@/lib/supabase/server', () => ({
    createClient: jest.fn(() => ({
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    data: [{ id: '1', name: 'Test' }],
                    error: null
                }))
            }))
        })),
        auth: {
            getUser: jest.fn(() => ({
                data: { user: { id: 'user-123' } }
            }))
        }
    }))
}))
```

### Mocking Server Actions

```typescript
jest.mock('@/lib/actions/payables', () => ({
    getPayables: jest.fn(() => Promise.resolve([
        { id: '1', name: 'Test Bill', amount: 100 }
    ])),
    createPayable: jest.fn(() => Promise.resolve({ id: 'new-1' }))
}))
```

## What to Test (Priority Order)

1. **Server Actions** - Test business logic in `src/lib/actions/*`
   - CRUD operations return correct data
   - Error cases handled properly
   - Auth checks work
   
2. **Utility Functions** - Test helpers in `src/lib/utils.ts`
   - Edge cases (null, undefined, empty)
   - Format functions return expected output

3. **Custom Hooks** - Test hooks in `src/hooks/*`
   - State changes correctly
   - Cleanup works

4. **Components** (lower priority) - Focus on critical UI
   - Key user interactions work
   - Conditional rendering is correct

## Running Specific Tests

```bash
# Run tests matching a pattern
npm test -- payables

# Run a specific file
npm test -- src/__tests__/example.test.ts

# Run tests with verbose output
npm test -- --verbose
```

## Test Best Practices

1. **Test behavior, not implementation** - What does the user see/get?
2. **One assertion per concept** - Keep tests focused
3. **Use descriptive names** - Explain what's being tested
4. **Test edge cases** - Empty arrays, null, errors
5. **Mock external dependencies** - Don't call real APIs
6. **Keep tests fast** - Under 1 second each
