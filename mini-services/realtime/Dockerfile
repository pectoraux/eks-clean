# ============================================================================
#  Eks-Clean — Realtime Service Dockerfile
# ============================================================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY mini-services/realtime/package.json ./
COPY mini-services/realtime/bun.lock* ./
RUN npm install

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY mini-services/realtime/index.ts ./
COPY mini-services/realtime/tsconfig.json* ./
EXPOSE 3001 3002
CMD ["npx", "tsx", "index.ts"]
