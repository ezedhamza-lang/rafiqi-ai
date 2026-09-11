FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PDF_CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Paquets prouves existants par le log de build Render : chromium, ca-certificates,
# fonts-noto-core, fonts-noto-extra (seul fonts-amiri absent -> remplacre par la
# police Amiri embarquee dans le depot, etape ci-dessous). fontconfig vient en
# dependance obligatoire de chromium -> fc-cache disponible.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium ca-certificates fonts-noto-core fonts-noto-extra \
 && rm -rf /var/lib/apt/lists/*

# Police Amiri du projet elle-meme (meme TTF utilises par pdfkit) installee systeme
COPY backend/src/assets/fonts /usr/local/share/fonts/rafiqi
RUN fc-cache -f

# Backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm install --no-audit --no-fund

COPY backend/prisma ./backend/prisma
RUN cd backend && npx prisma generate

# Frontend build
COPY frontend/package*.json frontend/
RUN cd frontend && npm install --include=dev --no-audit --no-fund

COPY frontend/ frontend/
RUN cd frontend && npm run build

# Backend source
COPY backend/ backend/

EXPOSE 3001

CMD ["node", "backend/src/index.js"]
