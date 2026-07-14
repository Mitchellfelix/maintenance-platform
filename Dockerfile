FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
COPY package*.json ./
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma
RUN npm install --omit=dev --workspace server
COPY --from=build /app/server ./server
COPY server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
  && mkdir -p /app/server/uploads/greentagging /app/server/public/downloads
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
