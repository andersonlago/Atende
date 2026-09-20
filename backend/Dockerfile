FROM node:20-alpine

WORKDIR /app

# Install dependencies for Prisma and sharp
RUN apk add --no-cache openssl sqlite

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed.ts && node dist/index.js"]
