# ===== منصة رفيقي — صورة إنتاج واحدة =====
# الواجهة تُبنى محلياً (npm run build) وتُلتزم في frontend/dist —
# الحاوية تنسخها جاهزة: بلا بناء داخلي = نشر سريع وبلا مخاطر ذاكرة.

FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

# الواجهة المبنية جاهزة + محتوى الدروس الثابت
COPY frontend/dist /app/frontend/dist

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && (node prisma/seed.js &) && exec node src/index.js"]
