/**
 * Legion Finance Logger
 * 
 * A structured logger that provides consistent formatting and context.
 * Use this instead of console.log for better debugging.
 * 
 * @example
 * import { logger } from '@/lib/logger'
 * 
 * logger.info('PAYABLES', 'Fetched 10 payables')
 * logger.error('STARLING', 'Failed to sync', { error: err.message })
 * logger.warn('MINDBODY', 'Rate limit approaching', { remaining: 5 })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// Prefixes for different areas of the app
type LogPrefix =
    | 'PAYABLES'
    | 'STARLING'
    | 'MINDBODY'
    | 'AUTH'
    | 'SYNC'
    | 'WEBHOOK'
    | 'CRON'
    | 'DB'
    | 'API'
    | string  // Allow custom prefixes

interface LogContext {
    [key: string]: unknown
}

// Only log debug in development
const isDev = process.env.NODE_ENV === 'development'

function formatMessage(level: LogLevel, prefix: LogPrefix, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] [${prefix}] ${message}${contextStr}`
}

function log(level: LogLevel, prefix: LogPrefix, message: string, context?: LogContext) {
    const formattedMessage = formatMessage(level, prefix, message, context)

    switch (level) {
        case 'debug':
            if (isDev) console.log(formattedMessage)
            break
        case 'info':
            console.log(formattedMessage)
            break
        case 'warn':
            console.warn(formattedMessage)
            break
        case 'error':
            console.error(formattedMessage)
            break
    }
}

export const logger = {
    /**
     * Debug messages - only shown in development
     * Use for verbose debugging information
     */
    debug: (prefix: LogPrefix, message: string, context?: LogContext) =>
        log('debug', prefix, message, context),

    /**
     * Info messages - general operational logs
     * Use for successful operations, sync completions, etc.
     */
    info: (prefix: LogPrefix, message: string, context?: LogContext) =>
        log('info', prefix, message, context),

    /**
     * Warning messages - something unusual but not broken
     * Use for rate limits, deprecated features, partial failures
     */
    warn: (prefix: LogPrefix, message: string, context?: LogContext) =>
        log('warn', prefix, message, context),

    /**
     * Error messages - something went wrong
     * Use for caught errors, failed operations
     */
    error: (prefix: LogPrefix, message: string, context?: LogContext) =>
        log('error', prefix, message, context),
}

// Convenience function to log errors with stack trace
export function logError(prefix: LogPrefix, message: string, error: unknown) {
    const errorInfo: LogContext = {}

    if (error instanceof Error) {
        errorInfo.message = error.message
        errorInfo.name = error.name
        if (isDev && error.stack) {
            errorInfo.stack = error.stack.split('\n').slice(0, 5).join('\n')
        }
    } else {
        errorInfo.error = String(error)
    }

    logger.error(prefix, message, errorInfo)
}
