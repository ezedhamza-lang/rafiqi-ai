FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PDF_CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Chromium (moteur PDF pour l'arabe) + polices arabes (Amiri + Noto)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium ca-certificates fonts-amiri fonts-noto-core fonts-noto-extra \
 && rm -rf /var/lib/apt/lists/*

# Backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm install --no-audit --no-fund

COPY backend/prisma ./backend/prisma
RUN cd backend && npx prisma generate

# Frontend build
COPY frontend/package*.json frontend/
RUN cd frontend && npm install --no-audit --no-fund

COPY frontend/ frontend/
RUN cd frontend && npm run build

# Backend source
COPY backend/ backend/

EXPOSE 3001

CMD ["node", "backend/src/index.js"]
