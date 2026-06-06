# pdf-service — Dockerfile
# Image Node.js Alpine + Chromium pour Puppeteer
FROM node:22-alpine

# Installer Chromium et ses dépendances
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Puppeteer doit savoir où trouver Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

# Installer les dépendances (couche séparée pour le cache)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copier le code compilé (ou le tsx en dev)
COPY dist/ ./dist/

EXPOSE 3000

# Non-root pour la sécurité
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["node", "dist/server.js"]
