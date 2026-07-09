# ── Build Stage ──────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# ── Production Stage ────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy production deps only (no devDependencies)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/server.mjs"]
