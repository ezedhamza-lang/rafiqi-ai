FROM node:20-alpine3.19

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

EXPOSE 3001

CMD ["node", "src/index.js"]
