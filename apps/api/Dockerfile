FROM node:20-bullseye-slim AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Install deps (workspace-aware)
FROM base AS deps
WORKDIR /app
ENV NODE_ENV=development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY prisma/package.json prisma/schema.prisma ./prisma/
RUN pnpm install --frozen-lockfile=true --prod=false

# Build
FROM base AS build
WORKDIR /app
COPY --from=deps /pnpm /pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma/node_modules ./prisma/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/tsconfig.base.json ./
COPY packages ./packages
COPY prisma ./prisma
COPY apps/api ./apps/api
COPY scripts ./scripts
RUN pnpm --filter @uzeed/prisma run generate
RUN pnpm --filter @uzeed/shared build
RUN pnpm --filter @uzeed/api build

# Runtime
FROM node:20-bullseye-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma/node_modules ./prisma/node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD sh -lc "cd prisma && npx prisma migrate deploy --schema=schema.prisma && npx prisma db seed --schema=schema.prisma && cd .. && node apps/api/dist/index.js"
