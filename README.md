# Memorial Pitomcev

Monorepo with Next.js (web) and NestJS (api).

## Requirements
- Node.js 18+ (or 20+)
- pnpm 9+

## Quick start
```bash
pnpm install
pnpm dev
```

## Environment
Create `.env.local` in `apps/web`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
```

Create `.env` in `apps/api`:
```
DATABASE_URL="postgresql://memorial:memorial_password@localhost:5433/memorial_dev?schema=public"
SMTP_HOST="smtp.timeweb.ru"
SMTP_PORT="465"
SMTP_USER="meowgav.service@xn--80aeb9a9a9d.com"
SMTP_PASS="SET_IN_SERVER_ENV"
SMTP_FROM="МЯУГАВ <meowgav.service@xn--80aeb9a9a9d.com>"
SMTP_SECURE="true"
```

## Production domain
Primary public domain: `https://мяугав.com`.

Use the ASCII/punycode form in server env values when a platform does not handle IDN domains reliably:
`https://xn--80aeb9a9a9d.com`.

Recommended production values when web and API are served through the same domain:
```
FRONTEND_URL=https://xn--80aeb9a9a9d.com
NEXT_PUBLIC_API_URL=/api
INTERNAL_API_URL=http://api:3001
```

## Apps
- `apps/web` - Next.js frontend
- `apps/api` - NestJS backend
- `packages/shared` - shared types and utilities
