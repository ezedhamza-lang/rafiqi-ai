FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

# الواجهة المبنية جاهزة
COPY frontend/dist /app/frontend/dist

EXPOSE 3001

CMD ["node", "src/index.js"]
