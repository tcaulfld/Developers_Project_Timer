FROM node:22-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install --prefix server && npm install --prefix client

COPY server ./server
COPY client ./client

RUN npm run build --prefix client

FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/
RUN npm install --omit=dev --prefix server

COPY server ./server
COPY --from=build /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 8787

CMD ["node", "server/src/index.js"]
