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
```

## Apps
- `apps/web` - Next.js frontend
- `apps/api` - NestJS backend
- `packages/shared` - shared types and utilities
