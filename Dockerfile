FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PDF_CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium ca-certificates fonts-noto-core fonts-noto-extra \
 && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm install --no-audit --no-fund

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .
COPY backend/src/assets/fonts /usr/local/share/fonts/rafiqi
RUN fc-cache -f

# Build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --include=dev --no-audit --no-fund
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

EXPOSE 3001

CMD ["node", "src/index.js"]
