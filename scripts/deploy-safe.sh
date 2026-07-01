#!/usr/bin/env bash
# =============================================================================
# deploy-safe.sh — Déploiement AssoAI avec détection de concurrence multi-session
# =============================================================================
# Garantit qu'aucun déploiement d'une autre session n'écrase le vôtre sans alerte.
#
# Usage :
#   ./scripts/deploy-safe.sh                # déploiement standard
#   ./scripts/deploy-safe.sh --force         # ignore l'alerte de concurrence
#   ./scripts/deploy-safe.sh --dry-run       # vérifie seulement, ne déploie pas
#   ./scripts/deploy-safe.sh --skip-build    # saute le build (déploie le dist/ existant)
#
# Fichier de version : /home/hermeswebui/.hermes/assoai-app/.deploy-version
# Ce fichier est dans le volume Docker partagé → visible du VPS et du conteneur WebUI.
# =============================================================================

set -euo pipefail

# ── Couleurs ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Chemins fixes ────────────────────────────────────────────────────────────
WORKSPACE="/workspace/chat-flow-templates-main"
DIST_DIR="${WORKSPACE}/dist"
VOLUME_ASSOAI="/home/hermeswebui/.hermes/assoai-app"
DEPLOY_VERSION_FILE="${VOLUME_ASSOAI}/.deploy-version"
VPS_IP="191.101.81.152"
VPS_USER="root"
VPS_COMPOSE_DIR="/docker/hermes-webui-693e"
NODE_PATH="/home/hermeswebui/.hermes/nodeenv/bin"
export PATH="${NODE_PATH}:${PATH}"

# ── Flags ────────────────────────────────────────────────────────────────────
FORCE=false
DRY_RUN=false
SKIP_BUILD=false

for arg in "$@"; do
    case "$arg" in
        --force)      FORCE=true ;;
        --dry-run)    DRY_RUN=true ;;
        --skip-build) SKIP_BUILD=true ;;
        --help|-h)
            echo "Usage: $0 [--force] [--dry-run] [--skip-build]"
            echo "  --force       Déployer même en cas d'alerte de concurrence"
            echo "  --dry-run     Vérifier l'état sans déployer"
            echo "  --skip-build  Utiliser le dist/ existant sans rebuild"
            exit 0
            ;;
        *)
            echo -e "${RED}Option inconnue : $arg${NC}"
            exit 1
            ;;
    esac
done

# ── Décorateur de step ──────────────────────────────────────────────────────
step()  { echo -e "\n${CYAN}${BOLD}▸ $1${NC}"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail()  { echo -e "  ${RED}✗${NC}  $1"; }
info()  { echo -e "  ${CYAN}ℹ${NC}  $1"; }

# ── Nettoyage en cas d'erreur ────────────────────────────────────────────────
cleanup() {
    if [ $? -ne 0 ] && [ "${DRY_RUN}" = false ]; then
        echo -e "\n${RED}${BOLD}▸ DÉPLOIEMENT INTERROMPU — cleanup...${NC}"
    fi
}
trap cleanup EXIT

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — Vérifications préalables
# ══════════════════════════════════════════════════════════════════════════════

step "Phase 1/6 — Vérifications préalables"

# 1a. Répertoire workspace
if [ ! -d "${WORKSPACE}/.git" ]; then
    fail "Pas un dépôt Git : ${WORKSPACE}"
    exit 1
fi
ok "Workspace Git OK"

cd "${WORKSPACE}"

# 1b. Vérifier que Git est propre (sauf si --force, qui permet de forcer)
if [ "${FORCE}" = false ]; then
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo ""
        warn "MODIFICATIONS NON COMMITÉES détectées :"
        git status --short
        echo ""
        fail "Commit ou stash requis avant déploiement."
        echo "  Utilisez --force pour ignorer (dangereux en multi-session)."
        exit 1
    fi
    ok "Git working tree clean"
else
    warn "--force : Git dirty ignoré"
fi

# 1c. Vérifier SSH vers le VPS
if ssh -o ConnectTimeout=5 -o BatchMode=yes ${VPS_USER}@${VPS_IP} "echo ok" &>/dev/null; then
    ok "SSH VPS OK"
else
    fail "SSH vers ${VPS_IP} échoue — déploiement impossible"
    exit 1
fi

# 1d. Vérifier que le volume assoai-app est accessible
if [ ! -d "${VOLUME_ASSOAI}" ] || [ ! -w "${VOLUME_ASSOAI}" ]; then
    fail "Volume assoai-app inaccessible : ${VOLUME_ASSOAI}"
    exit 1
fi
ok "Volume assoai-app accessible"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — Synchronisation Git
# ══════════════════════════════════════════════════════════════════════════════

step "Phase 2/6 — Synchronisation Git"

# Récupérer les commits des autres sessions
info "git fetch origin..."
git fetch origin 2>&1 | tail -1 || true

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

info "SHA local  : ${LOCAL_SHA:0:12}"
info "SHA remote : ${REMOTE_SHA:0:12}"

# Vérifier si on est en retard
if [ "${LOCAL_SHA}" != "${REMOTE_SHA}" ]; then
    if git merge-base --is-ancestor "${LOCAL_SHA}" "${REMOTE_SHA}" 2>/dev/null; then
        info "origin/main a avancé (autre session) → git pull --rebase..."
        if ! git pull --rebase origin main 2>&1; then
            fail "git pull --rebase a échoué — résoudre les conflits manuellement"
            exit 1
        fi
        LOCAL_SHA=$(git rev-parse HEAD)
        ok "Rebase OK → nouveau SHA: ${LOCAL_SHA:0:12}"
    else
        warn "HEAD et origin/main ont divergé — merge manuel nécessaire"
        info "HEAD     : ${LOCAL_SHA:0:12}"
        info "origin/main: ${REMOTE_SHA:0:12}"
        exit 1
    fi
else
    ok "HEAD == origin/main (à jour)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — Détection de concurrence
# ══════════════════════════════════════════════════════════════════════════════

step "Phase 3/6 — Détection de concurrence"

DEPLOYED_SHA=""
DEPLOYED_TS=""
PREVIOUS_SHA=""

if [ -f "${DEPLOY_VERSION_FILE}" ]; then
    DEPLOYED_SHA=$(grep -oP '^COMMIT_SHA=\K.*' "${DEPLOY_VERSION_FILE}" 2>/dev/null || echo "")
    DEPLOYED_TS=$(grep -oP '^TIMESTAMP=\K.*' "${DEPLOY_VERSION_FILE}" 2>/dev/null || echo "")
    PREVIOUS_SHA=$(grep -oP '^PREVIOUS_SHA=\K.*' "${DEPLOY_VERSION_FILE}" 2>/dev/null || echo "")
fi

if [ -z "${DEPLOYED_SHA}" ]; then
    info "Premier déploiement (aucun .deploy-version trouvé)"
elif [ "${DEPLOYED_SHA}" = "${LOCAL_SHA}" ]; then
    ok "SHA ${LOCAL_SHA:0:12} déjà déployé — rien à faire"
    echo ""
    echo -e "  ${GREEN}${BOLD}✓ DÉJÀ DÉPLOYÉ${NC} — le commit ${LOCAL_SHA:0:12} est en production."
    echo "  Déployé le : ${DEPLOYED_TS:-inconnu}"
    exit 0
elif git merge-base --is-ancestor "${DEPLOYED_SHA}" "${LOCAL_SHA}" 2>/dev/null; then
    ok "SHA déployé (${DEPLOYED_SHA:0:12}) est ancêtre de HEAD → déploiement linéaire OK"
    info "Dernier déploiement : ${DEPLOYED_TS:-inconnu}"
else
    # Le SHA déployé n'est pas dans notre historique → déploiement concurrent divergent
    echo ""
    echo -e "  ${RED}${BOLD}⚠️  ALERTE CONCURRENCE — DÉPLOIEMENT DIVERGENT${NC}"
    echo ""
    echo -e "  SHA actuellement en production : ${YELLOW}${DEPLOYED_SHA:0:12}${NC}"
    echo -e "  SHA que vous voulez déployer   : ${YELLOW}${LOCAL_SHA:0:12}${NC}"
    echo ""
    echo -e "  ${RED}Ces deux historiques ne sont PAS linéaires.${NC}"
    echo "  Une autre session a déployé un commit qui n'est pas dans votre historique."
    echo ""

    if [ "${FORCE}" = true ]; then
        warn "--force : déploiement forcé malgré la divergence"
        warn "Le déploiement précédent (${DEPLOYED_SHA:0:12}) sera ÉCRASÉ."
    else
        echo "  Actions recommandées :"
        echo "    1. git fetch && git log --oneline origin/main...HEAD"
        echo "    2. Identifier ce qui a changé de l'autre côté"
        echo "    3. git pull --rebase (peut causer des conflits)"
        echo "    4. Relancer le déploiement après résolution"
        echo ""
        echo "  Ou utiliser --force pour écraser (vos modifications seront en production,"
        echo "  mais celles du déploiement ${DEPLOYED_SHA:0:12} seront perdues)."
        echo ""
        exit 1
    fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — Build
# ══════════════════════════════════════════════════════════════════════════════

if [ "${SKIP_BUILD}" = true ]; then
    step "Phase 4/6 — Build (SKIPPED via --skip-build)"
    if [ ! -d "${DIST_DIR}" ]; then
        fail "dist/ introuvable — impossible de skipper le build"
        exit 1
    fi
    ok "dist/ existant utilisé"
else
    step "Phase 4/6 — Build Vite"

    info "npm run build..."
    BUILD_START=$(date +%s)

    if ! npm run build 2>&1; then
        fail "BUILD ÉCHOUÉ — voir les erreurs ci-dessus"
        exit 1
    fi

    BUILD_END=$(date +%s)
    BUILD_DURATION=$((BUILD_END - BUILD_START))
    ok "Build terminé en ${BUILD_DURATION}s"

    # Vérifier que dist/ contient bien les fichiers attendus
    if [ ! -f "${DIST_DIR}/index.html" ]; then
        fail "dist/index.html introuvable après build"
        exit 1
    fi
    JS_COUNT=$(find "${DIST_DIR}/assets" -name "index-*.js" 2>/dev/null | wc -l)
    if [ "${JS_COUNT}" -eq 0 ]; then
        fail "Aucun bundle JS trouvé dans dist/assets/"
        exit 1
    fi
    ok "Bundle JS détecté (${JS_COUNT} fichier(s))"
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — Déploiement
# ══════════════════════════════════════════════════════════════════════════════

if [ "${DRY_RUN}" = true ]; then
    step "Phase 5/6 — Déploiement (DRY RUN — aucune copie effectuée)"
    echo ""
    echo -e "  ${GREEN}${BOLD}✓ DRY RUN OK${NC} — Le commit ${LOCAL_SHA:0:12} est prêt à déployer."
    echo ""
    echo "  Pour déployer : $0"
    exit 0
fi

step "Phase 5/6 — Déploiement VPS"

# 5a. Copier dist/ dans le volume partagé
info "Copie de dist/ → volume assoai-app..."
rm -rf "${VOLUME_ASSOAI:?}"/*
cp -r "${DIST_DIR}"/* "${VOLUME_ASSOAI}/"
chmod -R 755 "${VOLUME_ASSOAI}/"
ok "dist/ copié dans le volume partagé"

# 5b. Écrire le fichier de version (ATOMIQUE — d'abord dans un tmp, puis mv)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SESSION_ID="${HERMES_SESSION_ID:-webui-$(date +%s)}"
VERSION_TMP="${VOLUME_ASSOAI}/.deploy-version.tmp"

cat > "${VERSION_TMP}" <<EOF
COMMIT_SHA=${LOCAL_SHA}
TIMESTAMP=${TIMESTAMP}
BUILD_HOST=webui
SESSION=${SESSION_ID}
PREVIOUS_SHA=${DEPLOYED_SHA:-none}
EOF

mv "${VERSION_TMP}" "${DEPLOY_VERSION_FILE}"
ok "Fichier .deploy-version écrit (SHA: ${LOCAL_SHA:0:12})"

# 5c. Forcer la recréation du conteneur nginx
info "docker compose up -d --force-recreate assoai..."
if ! ssh ${VPS_USER}@${VPS_IP} \
    "cd ${VPS_COMPOSE_DIR} && docker compose up -d --force-recreate assoai" 2>&1; then
    fail "docker compose a échoué"
    exit 1
fi
ok "Conteneur assoai recréé"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — Vérification post-déploiement
# ══════════════════════════════════════════════════════════════════════════════

step "Phase 6/6 — Vérification post-déploiement"

# 6a. Attendre que le conteneur soit prêt
sleep 3

# 6b. Vérifier que l'app répond
HTTP_CODE=$(ssh ${VPS_USER}@${VPS_IP} \
    "curl -sI --max-time 10 https://assoai.srv1720118.hstgr.cloud 2>/dev/null | head -1" 2>/dev/null || echo "")

if echo "${HTTP_CODE}" | grep -q "200"; then
    ok "AssoAI répond HTTP 200"
else
    warn "Vérification HTTP : ${HTTP_CODE:-pas de réponse} — le conteneur démarre peut-être encore"
fi

# 6c. Confirmer le fichier de version (volume partagé, lecture locale suffit)
if grep -q "${LOCAL_SHA}" "${DEPLOY_VERSION_FILE}" 2>/dev/null; then
    ok ".deploy-version confirmé : ${LOCAL_SHA:0:12}"
else
    warn ".deploy-version non confirmé localement"
fi

# ══════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ══════════════════════════════════════════════════════════════════════════════

COMMIT_MSG=$(git log -1 --format='%s' 2>/dev/null || echo "?")
COMMIT_DATE=$(git log -1 --format='%ci' 2>/dev/null || echo "?")

echo ""
echo -e "  ${GREEN}${BOLD}══════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}${BOLD}  ✓  DÉPLOIEMENT RÉUSSI${NC}"
echo -e "  ${GREEN}${BOLD}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Commit     : ${CYAN}${LOCAL_SHA:0:12}${NC}  ${COMMIT_MSG}"
echo -e "  Date       : ${COMMIT_DATE}"
echo -e "  Déployé le : ${TIMESTAMP}"
echo -e "  Précedent  : ${DEPLOYED_SHA:0:12}"
echo -e "  URL        : ${CYAN}https://assoai.srv1720118.hstgr.cloud${NC}"
echo ""
echo -e "  ${YELLOW}⚠  Pensez à faire Ctrl+Shift+R (hard refresh) pour vider le cache PWA.${NC}"
echo ""
