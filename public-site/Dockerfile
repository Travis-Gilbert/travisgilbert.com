# Thin public-site image: Next static export served by unprivileged nginx.
# Build context MUST be public-site/ (cd public-site && fly deploy).
# Do not build from the repo root; that pulls in the old studio app.

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN grep -q '"name": "travisgilbert-public-site"' package.json
RUN npm ci

COPY next.config.ts tsconfig.json postcss.config.mjs next-env.d.ts ./
COPY src ./src
COPY content ./content
COPY public ./public
# The portfolio route reads both at build time: the allowlist decides which
# repos get a section, the fixture supplies the field the section describes.
COPY config ./config
COPY fixtures ./fixtures

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 8080
