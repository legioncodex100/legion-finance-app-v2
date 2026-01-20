// Mindbody Cache Utility
// ============================================
// Intelligent caching with TTL for Mindbody API responses
// ============================================

import { CacheEntry, CacheConfig, DEFAULT_CACHE_CONFIG } from './types'

/**
 * Simple in-memory cache with TTL support
 * Used for caching API responses and tokens
 */
export class MindbodyCache {
    private cache = new Map<string, CacheEntry<unknown>>()
    private config: CacheConfig

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = { ...DEFAULT_CACHE_CONFIG, ...config }
    }

    /**
     * Get a cached value if it exists and hasn't expired
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined

        if (!entry) {
            return null
        }

        // Check if expired
        if (entry.expiresAt < Date.now()) {
            this.cache.delete(key)
            return null
        }

        return entry.data
    }

    /**
     * Set a cached value with TTL
     */
    set<T>(key: string, data: T, ttlMs?: number): void {
        const now = Date.now()
        this.cache.set(key, {
            data,
            expiresAt: now + (ttlMs || this.config.clientsTtlMs),
            createdAt: now,
        })
    }

    /**
     * Check if a key exists and is valid
     */
    has(key: string): boolean {
        return this.get(key) !== null
    }

    /**
     * Delete a specific key
     */
    delete(key: string): boolean {
        return this.cache.delete(key)
    }

    /**
     * Clear all cached values
     */
    clear(): void {
        this.cache.clear()
    }

    /**
     * Clear all expired entries
     */
    prune(): number {
        const now = Date.now()
        let pruned = 0

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt < now) {
                this.cache.delete(key)
                pruned++
            }
        }

        return pruned
    }

    /**
     * Get cache statistics
     */
    stats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        }
    }

    // ============================================
    // CONVENIENCE METHODS FOR SPECIFIC DATA TYPES
    // ============================================

    /**
     * Cache clients data
     */
    setClients<T>(data: T): void {
        this.set('all_clients', data, this.config.clientsTtlMs)
    }

    getClients<T>(): T | null {
        return this.get<T>('all_clients')
    }

    /**
     * Cache contracts data
     */
    setContracts<T>(data: T): void {
        this.set('all_contracts', data, this.config.contractsTtlMs)
    }

    getContracts<T>(): T | null {
        return this.get<T>('all_contracts')
    }

    /**
     * Cache services (static data, longer TTL)
     */
    setServices<T>(data: T): void {
        this.set('all_services', data, this.config.staticTtlMs)
    }

    getServices<T>(): T | null {
        return this.get<T>('all_services')
    }
}

// ============================================
// GLOBAL TOKEN CACHE
// ============================================

interface TokenCache {
    token: string
    expiresAt: number
}

let globalTokenCache: TokenCache | null = null

/**
 * Get cached token or return null if expired
 */
export function getCachedToken(): string | null {
    if (!globalTokenCache) {
        return null
    }

    // Check if expired (with 5 minute buffer)
    const bufferMs = 5 * 60 * 1000
    if (globalTokenCache.expiresAt < Date.now() + bufferMs) {
        globalTokenCache = null
        return null
    }

    return globalTokenCache.token
}

/**
 * Set the cached token
 * Mindbody tokens typically last 7 days
 */
export function setCachedToken(token: string, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): void {
    globalTokenCache = {
        token,
        expiresAt: Date.now() + expiresInMs,
    }
}

/**
 * Clear the token cache
 */
export function clearTokenCache(): void {
    globalTokenCache = null
}

/**
 * Check if we have a valid cached token
 */
export function hasValidToken(): boolean {
    return getCachedToken() !== null
}
