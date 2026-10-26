# Build context: repo root.
FROM node:24-slim

RUN npm install -g pnpm@11.9.0
WORKDIR /app

# Dependencies first so the layer is reused until the lockfile changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web...

# Inlined at build time. Same origin as the dashboard: Caddy routes /admin/queues to the API.
ARG NEXT_PUBLIC_BULL_BOARD_URL=/admin/queues
ENV NEXT_PUBLIC_BULL_BOARD_URL=$NEXT_PUBLIC_BULL_BOARD_URL
# Clerk publishable key (public, not a secret). Empty = Clerk disabled in the built image.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

COPY . .
RUN pnpm --filter @trawler/shared build && pnpm --filter web build

WORKDIR /app/apps/web
ENV NODE_ENV=production TZ=Asia/Seoul
EXPOSE 3001
CMD ["pnpm", "start"]
