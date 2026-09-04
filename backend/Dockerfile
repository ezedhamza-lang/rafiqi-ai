FROM node:20-alpine3.19

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

# الواجهة المبنية جاهزة
COPY frontend/dist /app/frontend/dist

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
