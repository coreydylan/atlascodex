FROM node:20-alpine

# Install Redis, Chromium and dependencies
RUN apk update && apk add --no-cache \
    redis \
    supervisor \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    && rm -rf /var/cache/apk/*

# Set Chromium path
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --no-audit --no-fund || npm install --only=production

# Copy application code
COPY . .

# Create supervisor config to run both Redis and Node
RUN mkdir -p /etc/supervisor/conf.d && \
    echo "[supervisord]" > /etc/supervisor/conf.d/supervisord.conf && \
    echo "nodaemon=true" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "[program:redis]" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "command=redis-server --bind 127.0.0.1" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "autostart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "autorestart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "priority=1" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "[program:api]" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "command=node server.js" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "autostart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "autorestart=true" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "priority=2" >> /etc/supervisor/conf.d/supervisord.conf && \
    echo "environment=NODE_ENV=production,REDIS_URL=redis://127.0.0.1:6379" >> /etc/supervisor/conf.d/supervisord.conf

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start both Redis and API using supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]