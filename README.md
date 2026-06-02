# AssoAI — Application CRM Signalétique

Application de gestion d'entreprise pour le secteur de la signalétique et des enseignes, avec IA conversationnelle intégrée.

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 22+
- npm 10+
- Un projet [Supabase](https://supabase.com) (gratuit)
- Un serveur [n8n](https://n8n.io) pour les workflows IA et PDF

### 1. Configuration Supabase

1. Créer un compte sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet
3. Dans l'onglet **SQL Editor**, exécuter le fichier `supabase/migrations/001_initial_schema.sql`
4. Dans l'onglet **Storage**, créer les buckets :
   - `images` (public)
   - `videos` (public)
   - `audio` (public)
   - `documents` (public)
   - `other` (public)
5. Copier l'URL du projet et la clé anon (Settings > API)

### 2. Configuration n8n

1. Déployer n8n (Docker recommandé) :
   ```bash
   docker run -d --name n8n -p 5678:5678 \
     -v n8n_data:/home/node/.n8n \
     -e N8N_SECURE_COOKIE=false \
     n8nio/n8n
   ```
2. Accéder à `http://localhost:5678` et créer un compte
3. Importer les workflows décrits dans `docs/N8N_WORKFLOWS_RECONSTRUCTION.md`
4. Configurer une clé API OpenAI / Anthropic / Google dans n8n
5. Configurer Google Cloud Storage (ou Supabase Storage) dans n8n
6. Activer les webhooks et copier les URLs générées

### 3. Configuration de l'Application

```bash
# Installer les dépendances
npm install

# Copier et éditer le fichier .env
cp .env .env.local
# Éditer .env.local avec vos credentials :
#   VITE_SUPABASE_URL=https://votre-projet.supabase.co
#   VITE_SUPABASE_ANON_KEY=eyJhbG...
#   VITE_N8N_CHAT_WEBHOOK=https://votre-n8n.app/webhook/chat
#   VITE_N8N_PDF_WEBHOOK=https://votre-n8n.app/webhook/pdf
```

### 4. Lancer en Développement

```bash
npm run dev
```

Ouvrir `http://localhost:5173` dans le navigateur.

### 5. Build Production

```bash
npm run build
```

Les fichiers statiques sont dans `dist/`. Déployer sur n'importe quel hébergement statique (Netlify, Vercel, GitHub Pages, Nginx...).

## 📁 Structure du Projet

```
src/
├── App.tsx                  # Point d'entrée, routing
├── components/
│   ├── chat/                # Interface de chat IA
│   ├── dashboard/           # Tableau de bord analytics
│   ├── templates/           # Sélecteur et éditeur de templates
│   ├── workflow/            # Graphe de workflow projets
│   └── ui/                  # Composants shadcn/ui
├── contexts/                # État global React
├── hooks/                   # Hooks personnalisés
├── integrations/
│   └── supabase/            # Client Supabase + Realtime
├── pages/                   # Pages de l'application
├── services/                # Logique métier (webhooks, DB, PDF)
├── types/                   # Types TypeScript
└── utils/                   # Utilitaires
```

## 📊 Types de Documents

| Document | Description |
|----------|-------------|
| **Facture** | Facture client avec lignes détaillées |
| **Devis** | Devis avec durée de validité |
| **Commande** | Bon de commande avec suivi de statut |
| **Cahier des Charges** | Spécifications multi-enseignes (le plus complet) |
| **Brief** | Brief créatif |
| **Contact** | Fiche contact client |

## 🔧 Technologies

- **Frontend** : React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend** : Supabase (PostgreSQL, Storage, Realtime)
- **IA** : n8n + OpenAI/Anthropic/Google (webhook proxy)
- **PDF** : n8n + Puppeteer/HTML2PDF
- **Cartes** : Leaflet/React-Leaflet
- **Graphiques** : Recharts

## 🌐 URLs Actuelles

| Service | URL |
|---------|-----|
| Supabase | Configuré via `VITE_SUPABASE_URL` |
| Webhook Chat | Configuré via `VITE_N8N_CHAT_WEBHOOK` |
| Webhook PDF | Configuré via `VITE_N8N_PDF_WEBHOOK` |

## 🔄 Versioning

Chaque document est versionné automatiquement :
- Incrémentation du numéro de version à chaque modification
- Seule la dernière version (`is_latest: true`) est affichée par défaut
- L'historique complet est conservé dans la table `messages`

## 🔐 Sécurité

- Les clés Supabase sont stockées en variables d'environnement
- RLS (Row Level Security) activé sur toutes les tables
- Les webhooks utilisent HTTPS
- Les fichiers uploadés passent par Supabase Storage avec politiques d'accès

## 👥 Pour l'Équipe

### Comptes nécessaires
1. **Supabase** : 1 compte admin pour gérer la DB. Les utilisateurs s'authentifient via l'interface `app_users`.
2. **n8n** : 1 compte admin pour gérer les workflows.
3. **Hébergement** : Compte Netlify/Vercel (gratuit) pour le frontend statique.

### Workflow quotidien
1. Se connecter à l'application
2. Utiliser le chat IA pour créer/modifier des documents
3. Les documents apparaissent dans la bibliothèque (`/library`)
4. Générer des PDF depuis la bibliothèque
5. Suivre l'activité sur le tableau de bord (`/`)

---

**Dernière mise à jour** : Juin 2026
**Version** : 2.0.0 (reconstruction)
