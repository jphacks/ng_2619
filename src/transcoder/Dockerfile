# 動画変換サービス（Cloud Run: 2 vCPU / 2GiB、同時実行数1、タイムアウト600秒、最大10インスタンス）
# ビルド: docker build -f transcoder/Dockerfile -t transcoder .
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install --no-save tsx prisma@6

COPY prisma ./prisma
RUN npx prisma generate
COPY lib ./lib
COPY server ./server
COPY transcoder ./transcoder
COPY tsconfig.json ./

ENV NODE_ENV=production STORAGE_DRIVER=gcs PORT=8080
CMD ["npx", "tsx", "transcoder/server.ts"]
