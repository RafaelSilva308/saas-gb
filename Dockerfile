# Imagem única: a API serve o front compilado na mesma origem. Contexto de build = raiz do repositório.
FROM node:22-slim AS front
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM node:22-slim AS api
WORKDIR /server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build
RUN npm ci --omit=dev

FROM node:22-slim
ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIST=/app/web \
    DB_DIR=/app/db
WORKDIR /app/server
COPY --from=api /server/node_modules ./node_modules
COPY --from=api /server/dist ./dist
COPY server/package.json ./
COPY --from=front /app/dist /app/web
COPY db /app/db
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
