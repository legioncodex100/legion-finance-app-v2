---
name: deployment
description: Deployment patterns for Legion Finance with Vercel. Use when deploying, managing environment variables, or debugging production issues.
---

# Deployment Skill

## When to Use
- Deploying to production
- Setting up environment variables
- Debugging production issues
- Managing preview deployments

## Vercel Deployment

Legion Finance is deployed on Vercel.

### Deploy Process

1. **Push to main branch** → Automatic production deployment
2. **Push to other branch** → Preview deployment
3. **Manual deploy** → Via Vercel dashboard

### Commands

```bash
# Push to deploy (if on main)
git push

# Or deploy via Vercel CLI
npx vercel

# Deploy to production
npx vercel --prod
```

## Environment Variables

### Required Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key |
| `STARLING_ACCESS_TOKEN` | Starling API token |
| `MINDBODY_API_KEY` | Mindbody API key |
| `GEMINI_API_KEY` | Google AI key |

### Setting Variables in Vercel

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add each variable for Production, Preview, Development
3. Redeploy for changes to take effect

### Local Development

Variables in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STARLING_ACCESS_TOKEN=xxx
MINDBODY_API_KEY=xxx
```

## Build Process

```bash
# Test build locally before deploying
npm run build

# If build passes, deploy is likely to succeed
```

### Common Build Errors

| Error | Fix |
|-------|-----|
| Type errors | Fix TypeScript issues |
| Missing imports | Add missing imports |
| ESLint errors | Run `npm run lint` and fix |

## Preview Deployments

Every PR/branch gets a preview URL:
- `legion-finance-xxx.vercel.app`

Use for testing before merging to main.

## Production Debugging

### View Logs

1. Vercel Dashboard → Project → Logs
2. Filter by function, status, time

### Function Logs

Server actions and API routes log to Vercel Functions.

```typescript
// These show in Vercel logs
console.log('Processing webhook')
logger.info('WEBHOOK', 'Received event')
```

### Common Production Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 500 errors | Server action crash | Check logs for error |
| Missing data | Env var not set | Add in Vercel settings |
| Slow pages | Large data fetch | Add pagination |
| Auth errors | Session expired | Check Supabase auth settings |

## Cron Jobs

Set up in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-starling",
      "schedule": "0 9 * * *"
    }
  ]
}
```

## Rollbacks

If a deploy breaks production:
1. Go to Vercel Dashboard → Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"

## Domains

Production: Custom domain configured in Vercel
Preview: `*.vercel.app` subdomains
