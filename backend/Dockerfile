FROM node:20-alpine3.19

WORKDIR /app

# Backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY backend/prisma ./backend/prisma
RUN cd backend && npx prisma generate

# Frontend build
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci

COPY frontend/ frontend/
RUN cd frontend && npm run build

# Backend source
COPY backend/ backend/

EXPOSE 3001

CMD ["node", "backend/src/index.js"]
