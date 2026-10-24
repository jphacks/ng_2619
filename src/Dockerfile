# Web（Next.js：画面＋API）。バッチも同じイメージで `npx tsx jobs/run.ts <job>` として動かす（基本設計書 1.3）
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS build
COPY . .
RUN npx prisma generate && NEXT_OUTPUT=standalone npx next build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
# バッチ用（jobs/run.ts を tsx で動かす）
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/jobs ./jobs
COPY --from=build /app/server ./server
COPY --from=build /app/lib ./lib
COPY --from=build /app/tsconfig.json ./tsconfig.json
EXPOSE 8080
CMD ["node", "server.js"]
