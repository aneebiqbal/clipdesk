FROM node:20-slim AS base

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python worker
COPY worker/ ./worker/
RUN python3 -m venv /app/worker/.venv && \
    /app/worker/.venv/bin/pip install --no-cache-dir -r worker/requirements.txt

# Node dependencies
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/types/package*.json ./packages/types/
RUN npm install

# Source
COPY packages/types/ ./packages/types/
COPY apps/api/ ./apps/api/

# Build
RUN npm run build --workspace=packages/types
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

ENV PYTHON_PATH=/app/worker/.venv/bin/python3
ENV PORT=8765

EXPOSE 8765
CMD ["node", "apps/api/dist/index.js"]
