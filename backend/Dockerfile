FROM node:20-alpine

# Install OpenSSL 1.1 compatibility for Prisma 5.22
RUN apk add --no-cache openssl1.1-compat

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

EXPOSE 3001

CMD ["node", "src/index.js"]
