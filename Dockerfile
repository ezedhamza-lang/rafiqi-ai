FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PDF_CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Chromium (محرك توليد PDF العربي السليم) + خطوط عربية (Amiri + Noto Naskh)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium ca-certificates fonts-amiri fonts-noto-core fonts-noto-extra \
 && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm install --no-audit --no-fund

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

# الواجهة المبنية مسبقًا (نفس رابط المنصة بدون CORS)
COPY frontend/dist /app/frontend/dist

EXPOSE 3001

CMD ["node", "src/index.js"]
