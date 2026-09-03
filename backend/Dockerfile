FROM node:20-alpine3.19

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy --advisory-lock-timeout=30000 && node prisma/seed.js && node src/index.js"]
