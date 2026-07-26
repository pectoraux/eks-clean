# ============================================================================
#  Eks-Clean — Production Dockerfile (multi-stage)
# ============================================================================

# ---- 1. Deps stage ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* bun.lock* ./
COPY prisma ./prisma
RUN npm install --legacy-peer-deps

# ---- 2. Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Generate Prisma client + build Next.js
RUN npx prisma generate
RUN npm run build

# ---- 3. Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/scripts ./scripts

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations on container start, then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
