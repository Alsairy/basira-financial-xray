# Basira / Financial X-ray — single-container deploy (Node 24+ server, Python 3.11+ engine).
# Free-tier hosting note: containers on a free web-service plan have ephemeral disk, so
# BASIRA_DATA_DIR (the SQLite store + uploaded documents) does not survive a redeploy or
# restart. Fine for a demo/pilot link; not a durability guarantee.
FROM node:24-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv python3-pip \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY requirements.lock.txt ./
RUN python3 -m venv /app/.venv \
  && /app/.venv/bin/python -m pip install --no-cache-dir -r requirements.lock.txt

COPY . .
RUN pnpm build

ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PYTHON_BIN=/app/.venv/bin/python \
  BASIRA_DATA_DIR=/data

RUN mkdir -p /data

EXPOSE 4317
CMD ["node", "server/index.mjs"]
