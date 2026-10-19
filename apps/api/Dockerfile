# Build context: repo root. Playwright's image ships Chromium's system deps; the tag must match the
# playwright version in pnpm-lock.yaml.
FROM mcr.microsoft.com/playwright:v1.64.0-noble

RUN npm install -g pnpm@11.9.0
WORKDIR /app

# Dependencies first: this is the big layer, and it stays cached (and is not re-pulled on the server)
# until the lockfile or Prisma schema changes. prisma generate runs as a postinstall and needs the
# schema, config, and some DATABASE_URL.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm install --frozen-lockfile --filter api... \
 && pnpm --filter api exec playwright install chromium

COPY . .
RUN pnpm --filter @trawler/shared build && pnpm --filter api build

WORKDIR /app/apps/api
ENV NODE_ENV=production TZ=Asia/Seoul
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && exec node dist/main.js"]
