# ---- Build Stage ----
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci --only=production && \
    cp -R node_modules node_modules_prod

RUN npm ci
COPY src/ ./src/
RUN npm run build

# ---- Production Stage ----
FROM node:18-alpine
WORKDIR /app

RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/node_modules_prod/ ./node_modules/
COPY package*.json ./

USER appuser
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
