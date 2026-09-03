FROM node:20-slim

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

EXPOSE 3001

CMD ["node", "src/index.js"]
