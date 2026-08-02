# Stage 1: Build Frontend React PWA
FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Run Production Server
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY server/ ./server
COPY --from=client-builder /app/client/dist ./client/dist

# Expose Port 5000
EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

# Seed initial database and start server
CMD ["sh", "-c", "node server/seed.js && node server/index.js"]
