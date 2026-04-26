# Stage 1: Base & Dependencies
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
RUN corepack enable

# Install build dependencies for native modules (like better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Stage 2: Build
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile

# Build both workspaces
RUN pnpm run build:client
RUN pnpm run build:server

# Remove devDependencies to keep image small
RUN pnpm prune --prod

# Stage 3: Production
FROM node:22-slim AS production
WORKDIR /app

# Copy production node_modules and built files
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/shared ./shared

# Environment variables
ENV NODE_ENV=production
ENV PORT=8085

# Create data directory for SQLite
RUN mkdir -p /app/server/data

EXPOSE 8085
CMD ["node", "server/dist/server.js"]
