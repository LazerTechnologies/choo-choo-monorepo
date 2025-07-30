FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache python3 make g++ git
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY app/package.json ./app/
COPY generator/package.json ./generator/
COPY contracts/package.json ./contracts/

# Install dependencies with better error handling
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/app/node_modules ./app/node_modules
COPY --from=deps /app/generator/node_modules ./generator/node_modules
COPY --from=deps /app/contracts/node_modules ./contracts/node_modules

# Copy source code
COPY . .

# Build the application in the correct order
ENV NEXT_TELEMETRY_DISABLED 1

# Set required environment variables for build
ENV NEXT_PUBLIC_MINI_APP_NAME="ChooChoo on Base"
ENV NEXT_PUBLIC_MINI_APP_BUTTON_TEXT="Launch Mini App"
ENV NEXT_PUBLIC_URL="https://placeholder.railway.app"
ENV NEXTAUTH_SECRET="railway-build-secret-placeholder"
ENV NEXTAUTH_URL="https://placeholder.railway.app"
# @todo: keep address updated to latest address
ENV NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS="0x0000000000000000000000000000000000000001"
ENV KV_REST_API_URL="https://placeholder-redis.upstash.io"
ENV KV_REST_API_TOKEN="placeholder-token"

# First build generator package
RUN pnpm --filter generator build
# Then build the app using Next.js directly (skip interactive script)
RUN cd app && pnpm exec next build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/app/.next/standalone ./
COPY --from=builder /app/app/.next/static ./.next/static
COPY --from=builder /app/app/public ./public

# Copy necessary files for the generator package
COPY --from=builder /app/generator/dist ./generator/dist
COPY --from=builder /app/generator/layers ./generator/layers
COPY --from=builder /app/generator/rarities.json ./generator/rarities.json

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]