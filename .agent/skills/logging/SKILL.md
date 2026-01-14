---
name: logging
description: Logging patterns for Legion Finance. Use when adding console logs, debugging, or tracking operations. Covers the logger utility, log levels, and what to log.
---

# Logging Skill

## When to Use
- Debugging issues
- Tracking sync operations
- Logging errors
- Monitoring API calls

## The Logger Utility

Instead of `console.log`, use the structured logger:

```typescript
import { logger, logError } from '@/lib/logger'

// Info - Successful operations
logger.info('PAYABLES', 'Fetched 10 payables')

// Warn - Something unusual
logger.warn('MINDBODY', 'Rate limit at 80%', { remaining: 20 })

// Error - Something failed
logger.error('STARLING', 'Failed to sync', { error: err.message })

// Debug - Verbose (only shown in development)
logger.debug('DB', 'Query executed', { table: 'payables', rows: 10 })
```

## Log Prefixes

Use these standard prefixes for consistency:

| Prefix | When to Use |
|--------|-------------|
| `PAYABLES` | Bill/payable operations |
| `STARLING` | Starling bank API calls |
| `MINDBODY` | Mindbody API calls |
| `AUTH` | Login, logout, session |
| `SYNC` | Data sync operations |
| `WEBHOOK` | Incoming webhooks |
| `CRON` | Scheduled jobs |
| `DB` | Database operations |
| `API` | API route handlers |

## Log Levels

| Level | When to Use | Production |
|-------|-------------|------------|
| `debug` | Verbose debugging | ❌ Hidden |
| `info` | Normal operations | ✅ Shown |
| `warn` | Something unusual | ✅ Shown |
| `error` | Something broke | ✅ Shown |

## What to Log

### ✅ DO Log

```typescript
// Sync completion
logger.info('STARLING', 'Sync completed', { 
    transactions: 25, 
    duration: '1.2s' 
})

// API errors
logger.error('MINDBODY', 'API call failed', { 
    endpoint: '/clients', 
    status: 429,
    message: 'Rate limited' 
})

// Important state changes
logger.info('PAYABLES', 'Bill marked as paid', { 
    billId: 'xxx',
    amount: 500 
})

// Auth events
logger.info('AUTH', 'User logged in', { userId: user.id })

// Webhook received
logger.info('WEBHOOK', 'Received MB webhook', { 
    type: 'client.created' 
})
```

### ❌ DON'T Log

```typescript
// Sensitive data
logger.info('AUTH', 'Login', { 
    password: 'secret123'  // ❌ NEVER
})

// PII
logger.info('SYNC', 'Member synced', { 
    email: 'user@email.com',  // ❌ Avoid
    phone: '07123456789'      // ❌ Avoid
})

// API keys
logger.debug('API', 'Request', { 
    apiKey: process.env.SECRET  // ❌ NEVER
})

// Excessive logging
for (const item of items) {
    logger.debug('LOOP', 'Processing', { item })  // ❌ Too noisy
}
// ✅ Instead:
logger.info('BATCH', 'Processed items', { count: items.length })
```

## Error Logging Helper

For caught errors, use the helper:

```typescript
import { logError } from '@/lib/logger'

try {
    await riskyOperation()
} catch (error) {
    logError('STARLING', 'Failed to fetch transactions', error)
    // Logs error message, name, and stack trace (in dev)
}
```

## Log Output Format

```
[2026-01-14T11:30:00.000Z] [INFO] [PAYABLES] Fetched 10 payables {"userId":"123"}
[2026-01-14T11:30:01.000Z] [ERROR] [STARLING] Failed to sync {"error":"Network timeout"}
```

## When to Add Logging

| Situation | Log Level |
|-----------|-----------|
| Entering a sync function | `debug` |
| Sync completed successfully | `info` |
| API rate limit warning | `warn` |
| API call failed | `error` |
| Webhook received | `info` |
| Background job started | `info` |
| Background job failed | `error` |
| User action completed | `info` (for important ones) |

## Migrating from console.log

```typescript
// Before
console.log('Fetching payables...')
console.log('Got', payables.length, 'payables')
console.error('Error:', error)

// After
import { logger } from '@/lib/logger'

logger.debug('PAYABLES', 'Fetching payables')
logger.info('PAYABLES', 'Fetched payables', { count: payables.length })
logger.error('PAYABLES', 'Failed to fetch', { error: error.message })
```

## Debugging Tips

1. **Use debug level liberally** - It's hidden in production
2. **Include context objects** - Makes filtering easier
3. **Use consistent prefixes** - Search logs by area
4. **Log before and after** - Know where failures occur
5. **Include IDs** - Reference specific records
