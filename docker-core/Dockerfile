FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# ─── System dependencies (Playwright Chromium minimal) ───────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    bash \
    curl \
    jq \
    # Playwright/Chromium runtime deps
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*

# Configure git global settings
RUN git config --global http.lowSpeedLimit 1000 && \
    git config --global http.lowSpeedTime 60

# ─── Playwright (Node package — uses system Chromium) ────────────────────────
# PLAYWRIGHT_BROWSERS_PATH=0 でシステムChromiumを使用 (追加ダウンロード不要)
ENV PLAYWRIGHT_BROWSERS_PATH=0
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g playwright @playwright/test && \
    npx playwright install chromium --with-deps 2>/dev/null || true

# Daemon Core code
COPY agent-loop.js /app/agent-loop.js
RUN chmod +x /app/agent-loop.js

# Environment variables
ENV ANTIGRAVITY_DIR=/antigravity
ENV HOST_HOME=/host_home
ENV BROWSER_CHECK=true

CMD ["node", "/app/agent-loop.js"]
