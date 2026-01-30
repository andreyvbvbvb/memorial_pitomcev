FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --filter @memorial/api... --frozen-lockfile

FROM base AS build
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
ARG DATABASE_URL=postgresql://user:pass@localhost:5432/db?schema=public
ENV DATABASE_URL=$DATABASE_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api apps/api
COPY packages packages
RUN pnpm --filter @memorial/api... prisma:generate
RUN node -e "const fs=require('fs');const path=require('path');const clientDir=path.dirname(require.resolve('@prisma/client'));const link=path.join(clientDir,'.prisma');const target=path.join(clientDir,'..','.prisma');if(!fs.existsSync(link)){fs.symlinkSync(target, link, 'dir');}"
RUN pnpm --filter @memorial/api... build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/prisma /app/apps/api/prisma
COPY apps/api/prisma.config.ts /app/apps/api/prisma.config.ts
COPY apps/api/package.json apps/api/
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
