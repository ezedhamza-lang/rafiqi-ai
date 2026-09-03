FROM node:20-alpine3.19

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

EXPOSE 3001

CMD ["sh", "-c", "export DATABASE_URL=\"${DATABASE_URL}${DATABASE_URL##*\\?*}&advisory_lock_timeout=30000\" && (npx prisma migrate deploy && node prisma/seed.js) & node src/index.js"]
