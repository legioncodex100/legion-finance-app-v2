import '@testing-library/jest-dom'

// Mock next/navigation (used in many components)
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
        refresh: jest.fn(),
        prefetch: jest.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/',
}))

// Suppress console.error in tests (optional, comment out if you want to see errors)
// global.console.error = jest.fn()
