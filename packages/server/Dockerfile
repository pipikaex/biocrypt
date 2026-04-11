FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y \
  build-essential \
  libcairo2-dev \
  libjpeg-dev \
  libpango1.0-dev \
  libgif-dev \
  librsvg2-dev \
  python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY packages/core/package.json packages/core/
COPY packages/core/tsconfig.json packages/core/
COPY packages/core/src packages/core/src
WORKDIR /app/packages/core
RUN npm install && npm run build

WORKDIR /app
COPY packages/server/package.json packages/server/
COPY packages/server/tsconfig.json packages/server/
COPY packages/server/nest-cli.json packages/server/
COPY packages/server/src packages/server/src
COPY package.json .
RUN npm install
WORKDIR /app/packages/server
RUN npx nest build

FROM node:22-slim

RUN apt-get update && apt-get install -y \
  libcairo2 libjpeg62-turbo libpango-1.0-0 libgif7 librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app .

EXPOSE 3000
ENV DATA_DIR=/app/data
VOLUME ["/app/data"]

CMD ["node", "packages/server/dist/main.js"]
