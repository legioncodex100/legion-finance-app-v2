import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files
    dir: './',
})

const config: Config = {
    // Add more setup options before each test is run
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

    // Use jsdom for testing React components
    testEnvironment: 'jsdom',

    // Where to find tests
    testMatch: [
        '**/__tests__/**/*.(ts|tsx)',
        '**/*.test.(ts|tsx)',
        '**/*.spec.(ts|tsx)',
    ],

    // Ignore these paths
    testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/.next/',
    ],

    // Module path aliases (match tsconfig paths)
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },

    // Coverage settings
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/index.ts',
    ],
}

export default createJestConfig(config)
