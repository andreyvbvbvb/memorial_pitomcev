# Architecture Overview

This project is a monorepo with two apps and one shared package:

- `apps/web` (Next.js): UI, pages, SEO, client UX.
- `apps/api` (NestJS): business logic, data access, auth, payments, map queries.
- `packages/shared`: shared DTOs, types, and validation schemas.

## Data flow
Client requests data from the API. The API enforces access rules and reads/writes
PostgreSQL. Media uploads go to S3-compatible storage via presigned URLs.
Background jobs (dust stages, gift expiration) run via a queue.

## Privacy rule
Private memorials are stored with exact coordinates but are never returned from
public map endpoints. Owners can see their private items.
