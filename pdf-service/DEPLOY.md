# Instructions de déploiement — microservice PDF Puppeteer
# À ajouter dans docker-compose.yml sur le VPS Hostinger

services:

  # ─── NOUVEAU : Microservice PDF ──────────────────────
  pdf-service:
    build:
      context: ./pdf-service
      dockerfile: Dockerfile
    restart: unless-stopped
    expose:
      - "3000"
    networks:
      - hermes-network
    environment:
      - NODE_ENV=production
      - PORT=3000
    # Pas de volume — le code est dans l'image
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  # ─── MODIFIÉ : assoai nginx — ajouter le volume pdf.conf ──
  assoai:
    image: nginx:alpine
    restart: unless-stopped
    volumes:
      - hermes-home:/data:ro
      - ./assoai-nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./assoai-pdf.conf:/etc/nginx/conf.d/pdf.conf:ro   # ← AJOUTÉ
    command: sh -c "cp -r /data/assoai-app/* /usr/share/nginx/html/ && chmod -R 755 /usr/share/nginx/html/ && nginx -g 'daemon off;'"
    networks:
      - hermes-network

# ══════════════════════════════════════════════════════════
# DÉPLOIEMENT
# ══════════════════════════════════════════════════════════
#
# 1. Sur le VPS, dans le dossier docker-compose :
#
#    # Copier les fichiers pdf-service/ et assoai-pdf.conf
#    # dans le dossier docker-compose du VPS
#
#    # Builder l'image pdf-service
#    docker compose build pdf-service
#
#    # Recréer les conteneurs (pdf-service nouveau, assoai modifié)
#    docker compose up -d --force-recreate pdf-service assoai
#
#    # Vérifier
#    curl -s http://localhost:3000/health
#    # → {"status":"ok","timestamp":"..."}
#
#    # Tester la génération
#    curl -s -X POST http://localhost:3000/api/pdf \
#      -H "Content-Type: text/html" \
#      -d "<html><body><h1>Test</h1></body></html>" \
#      -o /tmp/test.pdf
#    # → fichier /tmp/test.pdf créé
#
# 2. Déployer le frontend AssoAI :
#
#    cd /workspace/chat-flow-templates-main
#    npx vite build
#    cp -r dist/* /home/hermeswebui/.hermes/assoai-app/
#    chmod -R a+rX /home/hermeswebui/.hermes/assoai-app/
#    docker compose up -d --force-recreate assoai
#
# ⚠️  docker restart assoai NE SUFFIT PAS :
#     le conteneur copie les fichiers UNIQUEMENT au démarrage.
#     Utiliser --force-recreate (ou down && up).
