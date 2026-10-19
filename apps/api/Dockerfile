# Build context: repo root. Playwright's image ships Chromium's system deps; the tag must match the
# playwright version in pnpm-lock.yaml.
FROM mcr.microsoft.com/playwright:v1.64.0-noble

RUN npm install -g pnpm@11.9.0
WORKDIR /app
COPY . .

# prisma generate (postinstall) reads prisma.config.ts, which wants a DATABASE_URL to exist.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm install --frozen-lockfile --filter api... \
 && pnpm --filter @trawler/shared build \
 && pnpm --filter api build \
 && pnpm --filter api exec playwright install chromium

WORKDIR /app/apps/api
ENV NODE_ENV=production TZ=Asia/Seoul
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && exec node dist/main.js"]
