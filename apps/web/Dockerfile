# Build context: repo root.
FROM node:24-slim

RUN npm install -g pnpm@11.9.0
WORKDIR /app
COPY . .

# Inlined at build time. Same origin as the dashboard: Caddy routes /admin/queues to the API.
ARG NEXT_PUBLIC_BULL_BOARD_URL=/admin/queues
ENV NEXT_PUBLIC_BULL_BOARD_URL=$NEXT_PUBLIC_BULL_BOARD_URL

RUN pnpm install --frozen-lockfile --filter web... \
 && pnpm --filter @trawler/shared build \
 && pnpm --filter web build

WORKDIR /app/apps/web
ENV NODE_ENV=production TZ=Asia/Seoul
EXPOSE 3001
CMD ["pnpm", "start"]
