FROM node:20-slim AS base

# Install dependencies only when needed
FROM base AS deps
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Set npm registry to reduce network issues
RUN npm config set registry https://registry.npmjs.org/

# Install pnpm
RUN npm install -g pnpm@10.12.1

# Copy package.json and pnpm files first
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY app/package.json ./app/
COPY generator/package.json ./generator/

# Install dependencies without frozen lockfile to avoid Railway issues
RUN pnpm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.12.1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/app/node_modules ./app/node_modules
COPY --from=deps /app/generator/node_modules ./generator/node_modules

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

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]