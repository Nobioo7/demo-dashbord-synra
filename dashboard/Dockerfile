FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies using pnpm
COPY dashboard/package.json dashboard/pnpm-lock.yaml* ./n
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY dashboard/ ./

# Build the Next.js app
RUN pnpm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only the built files and production dependencies
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/next-env.d.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/pnpm-lock.yaml* ./

# Install only production dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install --prod --frozen-lockfile

EXPOSE 3000

ENV NODE_ENV production

CMD ["pnpm", "run", "start"]
