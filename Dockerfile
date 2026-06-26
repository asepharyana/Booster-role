FROM oven/bun:1.3.4-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

COPY src/db ./src/db
COPY drizzle.config.ts ./
RUN bun add -d drizzle-kit

CMD ["sh", "-c", "bun run db:migrate; bun run src/index.ts"]