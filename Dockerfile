FROM node:18.19-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
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
# First build generator package
RUN pnpm --filter generator build
# Then build the app (which depends on generator)
RUN pnpm --filter app build

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