FROM node:22-alpine AS deps

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/


COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma

RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/root/.cache/prisma \
    npm ci --workspace apps/api --include-workspace-root=false


# ------------------------ step 2 ---------------------------
FROM node:22-alpine AS runtime

RUN apk add --no-cache openssl tini

ENV NODE_ENV=production \
    PORT=4000 \
    TZ=UTC \
    CHECKPOINT_DISABLE=1 \
    PATH=/app/node_modules/.bin:$PATH

WORKDIR /app/apps/api

COPY --from=deps /app/node_modules /app/node_modules

COPY docker-entrypoint.sh /usr/local/bin/entrypoint

RUN chmod +x /usr/local/bin/entrypoint && \
    sed -i 's/\r$//' /usr/local/bin/entrypoint && \
    adduser -D -u 10001 appuser

COPY scripts/com-env.mjs /app/scripts/com-env.mjs
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma
COPY apps/api/scripts ./scripts
COPY apps/api/src ./src

ARG GIT_COMMIT=""
ENV GIT_COMMIT=$GIT_COMMIT
# A versão MAIOR.SEMANA.ENTREGA (src/services/versao.js), que sem o .git não dá
# para calcular aqui: quem constrói passa `--build-arg OMNIMOB_VERSAO=$(npm run -s versao -w apps/api)`.
ARG OMNIMOB_VERSAO=""
ENV OMNIMOB_VERSAO=$OMNIMOB_VERSAO

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint"]
CMD ["node", "src/server.js"]
