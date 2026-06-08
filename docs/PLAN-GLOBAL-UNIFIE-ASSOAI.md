# Plan Global Unifié — Refonte Architecture AssoAI

**Architecture Hermes-native · Sidebar unifiée · Gestion de projet pilotée par IA**
**Date** : 8 Juin 2026 — Version 3.1 · Document de référence unique
**Auteur** : Imprimelle (CEO) & Hermes Agent (Architecte)
**Statut** : Blocs 1-2 terminés, Bloc 3 (Notifications In-App) prêt
**Décision 08/06** : WhatsApp retiré du périmètre. Communication 100% via l'application.

---

## Table des matières

### PARTIE A — ARCHITECTURE
1. [Décision architecturale : Unification sous l'API Hermes](#1-décision-architecturale--unification-sous-lapi-hermes)
2. [L'API Router Hermes — Le cerveau de la sidebar](#2-lapi-router-hermes--le-cerveau-de-la-sidebar)
3. [Migration Wari & Brico — De l'injection texte aux profils Hermes](#3-migration-wari--brico--de-linjection-texte-aux-profils-hermes)

### PARTIE B — ÉQUIPE IA
4. [Les 5 Profils Hermes — Équipe complète](#4-les-5-profils-hermes--équipe-complète)
5. [Skills & Outils par profil](#5-skills--outils-par-profil)

### PARTIE C — INTERFACE
6. [La Sidebar Unifiée — Moteur modernisé, interface inchangée](#6-la-sidebar-unifiée--moteur-modernisé-interface-inchangée)
7. [La Nouvelle Page Projet — Interface dédiée](#7-la-nouvelle-page-projet--interface-dédiée)
8. [La Page Configuration — Agents + Logs unifiés](#8-la-page-configuration--agents--logs-unifiés)

### PARTIE D — PROCÉDURAL
9. [Flux de dérivation intelligent — CDC → Kanban](#9-flux-de-dérivation-intelligent--cdc--kanban)
10. [Matrice de routage — Quel agent sur quelle page](#10-matrice-de-routage--quel-agent-sur-quelle-page)

### PARTIE E — DÉPLOIEMENT
| 11. [Plan Walking Skeleton — 4 Blocs](#11-plan-walking-skeleton--4-blocs)
| 12. [Détail par bloc — Tâches, fichiers, validation](#12-détail-par-bloc--tâches-fichiers-validation)
| 12b. [Nouveau Bloc 3 — Notifications & Suivi In-App](#12b-nouveau-bloc-3--notifications--suivi-in-app)
| 13. [Stratégie de transition — Ancien → Nouveau](#13-stratégie-de-transition--ancien--nouveau)
| 14. [Récapitulatif des livrables](#14-récapitulatif-des-livrables)

---

# PARTIE A — ARCHITECTURE

## 1. Décision architecturale : Unification sous l'API Hermes

### 1.1 Le problème actuel

```
┌─────────────────────────────────────────────────────────┐
│              ARCHITECTURE ACTUELLE (Juin 2026)           │
│                                                          │
│  Sidebar ──→ orchestrator.ts (passe-plat)               │
│                └─→ chatService.ts                        │
│                     ├─ getPrompt(agent) ← localStorage  │
│                     ├─ injectProductData() ← Supabase    │
│                     ├─ resolveDocumentContext() ← RPC    │
│                     └─ fetch(DeepSeek API)               │
│                                                          │
│  PROBLÈMES :                                             │
│  ❌ Injection manuelle de texte (catalogue, règles)      │
│  ❌ Pas de vrais outils — l'IA ne peut pas agir          │
│  ❌ Deux moteurs différents (sidebar vs futur projet)    │
│  ❌ Prompts éditables localStorage → fragiles            │
│  ❌ Pas de skills, pas de mémoire persistante            │
└─────────────────────────────────────────────────────────┘
```

### 1.2 La solution : Tout passe par l'API Hermes

```
┌─────────────────────────────────────────────────────────┐
│           NOUVELLE ARCHITECTURE (Cible Bloc 1)           │
│                                                          │
│  Sidebar ──→ hermesRouter.ts (détection contexte)       │
│                │                                         │
│                ├─ Page = /facture, /chat                 │
│                │  └─→ Hermes-Wari (profil Hermes)       │
│                │       ├─ Prompt système (migré)         │
│                │       ├─ Skills : product-search,       │
│                │       │          document-create,       │
│                │       │          facture-derivation     │
│                │       └─ Outils : terminal, web, Supabase│
│                │                                         │
│                ├─ Page = /products, /cdc                 │
│                │  └─→ Hermes-Brico (profil Hermes)       │
│                │       ├─ Prompt système (migré)         │
│                │       ├─ Skills : manufacturing-rules,  │
│                │       │          cdc-generate,          │
│                │       │          material-calculator    │
│                │       └─ Outils : terminal, web, Supabase│
│                │                                         │
│                └─ Page = /projects/:id                   │
│                   └─→ Hermes-PM (profil Hermes)          │
│                        ├─ Skills : project-orchestrator, │
│                        │          kanban-manager,        │
│                        │          checklist-validator    │
│                        └─ Outils : terminal, cronjob,    │
│                                   messaging, kanban      │
│                                                          │
│  AVANTAGES :                                             │
│  ✅ Un seul point d'entrée (API Hermes)                  │
│  ✅ Vrais outils → l'IA peut agir (créer, modifier,      │
│     notifier)                                             │
│  ✅ Skills spécialisés → réutilisables, évolutifs        │
│  ✅ Mémoire persistante → l'IA se souvient               │
│  ✅ Ajout futur de profils trivial (Comptable, Livreur)  │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Principe clé : l'interface ne change pas, le moteur si

```
               AVANT                                   APRÈS

┌──────────────────────┐                 ┌──────────────────────┐
│   SlidingChatPanel    │                 │   SlidingChatPanel    │
│   (UI inchangée)      │                 │   (UI inchangée)      │
│                       │                 │                       │
│   MessageInput        │                 │   MessageInput        │
│   Sélecteur Wari/Brico│                 │   Sélecteur Wari/Brico│
│   ChatMessage         │                 │   ChatMessage         │
│   TemplateQuoteCard   │                 │   TemplateQuoteCard   │
└──────────┬───────────┘                 └──────────┬───────────┘
           │                                        │
           ▼                                        ▼
┌──────────────────────┐                 ┌──────────────────────┐
│  chatService.ts       │                 │  hermesRouter.ts      │
│  → DeepSeek direct    │                 │  → API Hermes locale  │
│  → Injection texte    │    REMPLACÉ    │  → Routage contexte   │
│  → Pas d'outils       │    =======>    │  → Profils + skills   │
│  → Pas de mémoire     │                 │  → Mémoire persistante│
└──────────────────────┘                 └──────────────────────┘
```

---

## 2. L'API Router Hermes — Le cerveau de la sidebar

### 2.1 Fonctionnement

Le routeur est un **endpoint HTTP local** qui reçoit le message utilisateur + le contexte de la page, et le route vers le bon profil Hermes.

```typescript
// Nouveau fichier : src/services/hermesRouter.ts

interface HermesRouteRequest {
  message: string;            // Le message de l'utilisateur
  userId: string;
  sessionId: string;          // Session persistante
  pageContext: PageContext;   // Détecté automatiquement
  attachedTemplate?: {        // Si un document est cité/référencé
    templateType: TemplateType;
    data: TemplateData;
  };
  attachedQuote?: QuoteData;  // Si un document est cité en contexte
}

interface PageContext {
  route: string;              // ex: '/chat', '/projects/abc-123', '/products'
  pageType: 'general' | 'facture' | 'commande' | 'cdc' | 'products' | 'project' | 'agent-config';
  projectId?: string;         // Si sur une page projet
  documentType?: TemplateType; // Si sur une page document
}

// Routage :
// pageType = 'general' | 'facture' | 'commande' | undefined → Hermes-Wari
// pageType = 'cdc' | 'products'                            → Hermes-Brico  
// pageType = 'project'                                      → Hermes-PM
// pageType = 'agent-config'                                 → Hermes-Wari (configuration)
```

### 2.2 Détection automatique du contexte

```typescript
// src/services/pageContextDetector.ts

export function detectPageContext(): PageContext {
  const path = window.location.pathname;
  
  // Projet dédié
  const projectMatch = path.match(/^\/projects\/(.+)$/);
  if (projectMatch) {
    return {
      route: path,
      pageType: 'project',
      projectId: projectMatch[1]
    };
  }
  
  // Page Catalogue Produits
  if (path.startsWith('/products')) {
    return { route: path, pageType: 'products' };
  }
  
  // Page Configuration Agents
  if (path.startsWith('/agent-config')) {
    return { route: path, pageType: 'agent-config' };
  }
  
  // CRM Templates (lecture seule)
  if (path.startsWith('/templates')) {
    return { route: path, pageType: 'general' };
  }
  
  // Page Chat ou Dashboard — détection intelligente
  // Si un template de CDC est ouvert → Brico
  // Si un template de Facture/Commande est ouvert → Wari
  // Sinon → Wari (défaut)
  return { route: path, pageType: 'general' };
}
```

### 2.3 API Hermes locale

L'application frontend appelle un endpoint HTTP local exposé par le serveur Hermes :

```
POST http://localhost:11434/hermes/router
Content-Type: application/json

{
  "message": "Crée une facture pour Panneau LED 2m",
  "userId": "abc-123",
  "sessionId": "session_xyz",
  "pageContext": { "route": "/chat", "pageType": "general" },
  "attachedTemplate": null
}

→ RÉPONSE :
{
  "mode": "template",
  "templateType": "facture",
  "data": {
    "factureNumero": "F-2026-015",
    "client": { "nom": "Client", ... },
    "details": [...],
    "total": 240000
  },
  "metadata": {
    "agent": "Hermes-Wari",
    "skills_used": ["product-search", "document-create"],
    "tokens": 1240
  }
}
```

### 2.4 Le serveur Hermes local

Un petit serveur Express/Fastify dans le conteneur `hermes-webui` qui expose l'API :

```typescript
// Nouveau : /workspace/chat-flow-templates-main/server/hermes-api.ts

import express from 'express';
import { spawn } from 'child_process';

const app = express();
app.use(express.json());

app.post('/hermes/router', async (req, res) => {
  const { message, userId, sessionId, pageContext } = req.body;
  
  // Déterminer le profil cible
  const profile = routeToProfile(pageContext);
  
  // Appeler Hermes avec le bon profil
  const result = await spawnHermes({
    profile,
    prompt: message,
    sessionId,
    userId,
    skills: getSkillsForProfile(profile),
    tools: getToolsForPage(pageContext)
  });
  
  res.json(result);
});

app.listen(11434, () => {
  console.log('Hermes API Router → http://localhost:11434');
});
```

---

## 3. Migration Wari & Brico — De l'injection texte aux profils Hermes

### 3.1 Ce qui est migré

| Élément | Emplacement actuel | Destination |
|---------|-------------------|-------------|
| **Prompt Wari** | `agentConfigStore.ts` → localStorage | `~/.hermes/profiles/hermes-wari/personality` |
| **Prompt Brico** | `agentConfigStore.ts` → localStorage | `~/.hermes/profiles/hermes-brico/personality` |
| **Catalogue produits** | `dataInjector.ts` → injection texte | **Skill** `product-search` → Supabase direct |
| **Règles fabrication** | `dataInjector.ts` → injection texte | **Skill** `manufacturing-rules` → Supabase direct |
| **Numéros documents** | `resolveDocumentContext()` → RPC | **Skill** `document-numbers` → RPC Supabase |
| **Dérivation** | Règles dans le prompt | **Skill** `document-derivation` |
| **Sélecteur agent** | `MessageInput.tsx` | **Inchangé** visuellement, mais route vers le profil Hermes |

### 3.2 Comparaison : avant vs après

```
AVANT (injection texte) :
┌────────────────────────────────────────────┐
│ 1. ChatContainer.handleSendMessage()       │
│ 2. orchestrateRequest(payload, "wari")     │
│ 3. sendChatRequest()                       │
│    ├─ getPrompt("wari") ← localStorage     │
│    ├─ prompt.replace("{INJECTED_PRODUCTS}",│
│    │    dataInjector.formatForWari(...))   │
│    ├─ prompt.replace("{DOCUMENT_NUMBER}",  │
│    │    resolveDocumentContext(...))        │
│    └─ fetch("https://api.deepseek.com/...")│
│ 4. parseAIResponse() → JSON → UI           │
│                                            │
│ Tokens gaspillés : 2000+ tokens de         │
│ catalogue injectés à CHAQUE message        │
└────────────────────────────────────────────┘

APRÈS (API Hermes) :
┌────────────────────────────────────────────┐
│ 1. ChatContainer.handleSendMessage()       │
│ 2. hermesRouter.send({                     │
│      message, pageContext, template        │
│    })                                      │
│ 3. API Hermes route → Hermes-Wari         │
│    ├─ Prompt système (préchargé, pas       │
│    │   injecté à chaque appel)             │
│    ├─ Skill product-search → Supabase      │
│    │   (appelé SEULEMENT si nécessaire)    │
│    ├─ Skill document-numbers → RPC         │
│    └─ DeepSeek via Hermes (tools natifs)   │
│ 4. Réponse JSON → UI                       │
│                                            │
│ Tokens économisés : ~2000 tokens/message   │
│ Outils réels : l'IA agit, ne se contente   │
│ pas de suggérer                            │
└────────────────────────────────────────────┘
```

### 3.3 Plan de migration des prompts

Les prompts actuels (`agentConfigStore.ts`, 382 lignes) sont **préservés** — ils sont simplement déplacés dans les profils Hermes. L'utilisateur pourra toujours les modifier via la page Configuration.

```bash
# Création du profil Wari
hermes profile create hermes-wari --clone-from default

# Injection du prompt Wari actuel
# (lu depuis agentConfigStore.ts → DEFAULT_PROMPTS.wari)
hermes config set personality "$(cat /tmp/wari-prompt.txt)" --profile hermes-wari

# Création du profil Brico  
hermes profile create hermes-brico --clone-from default

# Injection du prompt Brico actuel
hermes config set personality "$(cat /tmp/brico-prompt.txt)" --profile hermes-brico
```

---

# PARTIE B — ÉQUIPE IA

## 4. Les 5 Profils Hermes — Équipe complète

```
┌─────────────────────────────────────────────────────────────────┐
│                    ÉQUIPE HERMES ASSOAI                          │
│                                                                  │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ HERMES-WARI 💼│  │HERMES-BRICO🔧│  │   HERMES-PM 🎯        │ │
│  │ Commercial    │  │ Technique    │  │   Chef de projet      │ │
│  │ Factures,     │  │ CDC, règles  │  │   Kanban, checklists  │ │
│  │ Devis,        │  │ fabrication, │  │   Coordination équipe │ │
│  │ Commandes     │  │ matériaux    │  │   Notifications app   │ │
│  └───────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
│          │                 │                       │              │
│  ┌───────┴─────────────────┴───────────────────────┴───────────┐ │
│  │              HERMES-NOTIFICATEUR 🔔                           │ │
│  │              Notifications in-app, rappels, escalade          │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
│                             │                                     │
│  ┌──────────────────────────┴───────────────────────────────────┐ │
│  │              HERMES-SENTINELLE 👁️                              │ │
│  │              Surveillance 24/7, scores, alertes               │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

| Profil | Icône | Rôle | Interagit avec | Pages actives |
|--------|-------|------|---------------|---------------|
| **Hermes-Wari** | 💼 | Commercial : Factures, Devis, Commandes, questions générales | Utilisateur (sidebar) | `/chat`, `/facture`, `/devis`, `/commande`, `/templates` |
| **Hermes-Brico** | 🔧 | Technique : CDC, règles fabrication, matériaux | Utilisateur (sidebar) | `/products`, `/cdc` |
| **Hermes-PM** | 🎯 | Chef de projet : Kanban, checklists, coordination | Utilisateur (chat projet) | `/projects/:id` |
| **Hermes-Notificateur** | 🔔 | Notificateur : Rappels, alertes, escalades in-app | Admin + Équipe (app) | Background (Cron/Kanban) | Communication, Cron |
| `hermes-sentinelle` | 👁️ | Veilleur : Surveillance 24/7, scores, alertes | Personne (autonome) | Background (Cron/Kanban) | Scan, Alerte, Notification |

---

## 5. Skills & Outils par profil

### 5.1 Hermes-Wari 💼

```yaml
# ~/.hermes/profiles/hermes-wari/config.yaml
skills:
  auto_load:
    - product-search        # Chercher produits/prix dans Supabase
    - document-create       # Créer facture, devis, commande
    - document-derivation   # Dériver facture→commande
    - document-update       # Modifier document existant
    - client-suggestions    # Suggérer clients depuis l'historique
    - document-numbers      # Allouer numéros via RPC Supabase

tools:
  enabled:
    - terminal       # Requêtes Supabase
    - web            # Recherche informations
    - memory         # Préférences utilisateur
    - file           # Lecture config
    - todo           # Planification
```

### 5.2 Hermes-Brico 🔧

```yaml
# ~/.hermes/profiles/hermes-brico/config.yaml
skills:
  auto_load:
    - manufacturing-rules   # Règles de fabrication par type d'enseigne
    - cdc-generate          # Générer cahier des charges
    - material-calculator   # Calculer matériaux, coûts
    - cdc-parse             # Parser CDC → extraire sections, matériaux
    - product-search        # Chercher produits (règles techniques)
    - enseigne-dimensions   # Valider dimensions, contraintes

tools:
  enabled:
    - terminal       # Requêtes Supabase
    - web            # Recherche techniques
    - memory         # Règles apprises
    - file           # Lecture config
```

### 5.3 Hermes-PM 🎯

```yaml
# ~/.hermes/profiles/hermes-pm/config.yaml
skills:
  auto_load:
    - project-orchestrator  # Orchestrer tâches, phases
    - kanban-manager        # CRUD tâches Kanban
    - checklist-validator   # Valider items automatiquement
    - project-reporting     # Rapports quotidiens
    - team-coordinator      # Coordonner équipe terrain

tools:
  enabled:
    - terminal       # Requêtes Supabase
    - web            # Recherche
    - memory         # Contexte projet
    - cronjob        # Rappels programmés
    - delegation     # Sous-traiter à Wari/Brico
```

### 5.4 Hermes-Notificateur 🔔

> **Décision 08/06/2026** : WhatsApp retiré du périmètre. Toute la communication passe par l'application.

```yaml
# ~/.hermes/profiles/hermes-notificateur/config.yaml
skills:
  auto_load:
    - notification-app      # Envoyer notifications in-app (centre notif, toast, badge)
    - cron-reminders        # Programmation rappels
    - notification-router   # Router les alertes (qui, quoi, comment)
    - escalation-manager    # Escalade progressive

tools:
  enabled:
    - cronjob        # Rappels programmés
    - memory         # Historique notifications
    - web            # Vérification statut
    - kanban         # Créer alertes → Directeur
```

**Mode de livraison** : Les notifications sont stockées dans la table `notifications` et affichées dans :
- Le **centre de notifications** (cloche 🔔 dans la TopBar avec badge compteur)
- Les **toasts** (popups temporaires pour les alertes)
- Le **chat projet** (message du Directeur pour les escalades critiques)
- Le **badge** sur l'icône du projet concerné

### 5.5 Hermes-Sentinelle 👁️

```yaml
# ~/.hermes/profiles/hermes-sentinelle/config.yaml
skills:
  auto_load:
    - project-watcher       # Scanner projets actifs
    - anomaly-detector      # Détecter patterns anormaux
    - health-scorer         # Calculer Project Health Score

tools:
  enabled:
    - terminal       # Requêtes Supabase
    - web            # Vérification
    - memory         # Seuils, historique
```

---

# PARTIE C — INTERFACE

## 6. La Sidebar Unifiée — Moteur modernisé, interface inchangée

### 6.1 Principe

La sidebar **ne change pas d'aspect visuel** pour l'utilisateur. Le `SlidingChatPanel`, le `MessageInput`, le `ChatMessage`, les `TemplateQuoteCard` — tout reste identique.

**Ce qui change :** le code qui traite l'envoi du message.

```
AVANT (ChatContainer.tsx handleSendMessage) :
  orchestrateRequest(payload, activeAgent)
    → sendChatRequest(payload, agent)
      → fetch("https://api.deepseek.com/...")

APRÈS :
  hermesRouter.send({
    message: payload.message.content,
    userId: user.id,
    sessionId: sessionId.current,
    pageContext: detectPageContext(),
    attachedTemplate: payload.message.template,
    attachedQuote: payload.message.quote
  })
    → POST http://localhost:11434/hermes/router
      → spawn Hermes avec le bon profil
```

### 6.2 Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/services/orchestrator.ts` | **Réécrit** — remplace `sendChatRequest` par appel API Hermes |
| `src/services/hermesRouter.ts` | **Nouveau** — client HTTP pour l'API Hermes |
| `src/services/pageContextDetector.ts` | **Nouveau** — détection de la page courante |
| `src/components/chat/ChatContainer.tsx` | **Modifié** — `handleSendMessage` utilise `hermesRouter` |
| `src/components/chat/MessageInput.tsx` | **Inchangé** — le sélecteur Wari/Brico persiste |
| `src/components/chat/SlidingChatPanel.tsx` | **Inchangé** — UI préservée |

### 6.3 Le sélecteur d'agent — conservé, rôle clarifié

Le sélecteur Wari/Brico dans `MessageInput` est **conservé** visuellement. Son nouveau rôle :

- L'utilisateur peut **forcer** un agent (ex: poser une question technique à Brico depuis la page Facture)
- Si aucun agent n'est forcé → le routeur choisit automatiquement selon la page
- L'agent forcé est passé dans `pageContext.forcedAgent`

```typescript
// MessageInput.tsx — inchangé visuellement
<AgentSelector
  activeAgent={activeAgent}
  onAgentChange={setActiveAgent}
/>

// hermesRouter.ts — nouvelle logique
function routeToProfile(pageContext, forcedAgent?) {
  if (forcedAgent === 'brico') return 'hermes-brico';
  if (forcedAgent === 'wari') return 'hermes-wari';
  
  // Routage automatique selon la page
  switch (pageContext.pageType) {
    case 'products':
    case 'cdc':
      return 'hermes-brico';
    case 'project':
      return 'hermes-pm';
    default:
      return 'hermes-wari';
  }
}
```

---

## 7. La Nouvelle Page Projet — Interface dédiée

### 7.1 Remplacement de l'ancien système

> **Directive :** L'ancien module projet (ProjectDetails.tsx, ProjectList.tsx, ProjectCard.tsx) est **obsolète et entièrement remplacé** par la nouvelle interface.

### 7.2 Layout de la nouvelle page

```
┌──────────────────────────────────────────────────────────────┐
│  ← Projets  │  [🔍 Rechercher un projet...]  │  [+ Nouveau] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 🟠 PROJET : Enseigne Hôtel Ivoire          [▶]     │     │
│  │ Phase : Fabrication · Livraison 12 Juin · Score 72  │     │
│  │                                                       │     │
│  │  ┌─ 📄 Facture F-2026-005 ──── [Voir] [PDF] ──────┐ │     │
│  │  │  Client : Hôtel Ivoire · 2 450 000 FCFA         │ │     │
│  │  └─────────────────────────────────────────────────┘ │     │
│  │         │ (dérivation)                                │     │
│  │  ┌─ 📦 Commande CMD-2026-004 ── [Voir] [PDF] ─────┐ │     │
│  │  │  3 articles · 2 200 000 FCFA                     │ │     │
│  │  └─────────────────────────────────────────────────┘ │     │
│  │         │ (dérivation)                                │     │
│  │  ┌─ 📋 CDC CDC-2026-001 ──── [Voir] [PDF] ────────┐ │     │
│  │  │  2 enseignes · 18 matériaux                       │ │     │
│  │  └─────────────────────────────────────────────────┘ │     │
│  │         │                                             │     │
│  │  ┌─ 📊 Devis D-2026-002 ──── [Voir] [PDF] ────────┐ │     │
│  │  │  3 000 000 FCFA                                   │ │     │
│  │  └─────────────────────────────────────────────────┘ │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 🟢 PROJET : Totem Banque Atlantique        [▶]     │     │
│  │ Phase : Commande · Score 88                          │     │
│  │  ┌─ 📄 Facture · ┌─ 📦 Commande ──────────────────┐ │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ [+ Créer un nouveau projet]                          │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Fonctionnalités de la liste des projets

| Fonctionnalité | Description |
|---------------|-------------|
| **Recherche avec suggestions** | Widget de recherche par nom de projet, client, numéro de facture |
| **Cartes en accordéon** | Chaque projet est une carte cliquable qui se déplie pour montrer ses documents |
| **Sections documents en accordéon** | Facture(1), Commande(1), CDC(1), Devis(≥1) — chaque section listant les documents |
| **Bouton flottant +** | Créer un nouveau projet (recherche facture existante OU nouvelle facture) |
| **Badge de phase** | Code couleur : 🔵 Facturation, 🟠 Commande, 🟣 Fabrication, 🟢 Livré |
| **Score de santé** | Affiché sur chaque carte (couleur selon score) |
| **Clic sur [▶]** | Ouvre la page détail du projet |

### 7.4 Création d'un projet

```
┌──────────────────────────────────────────────────────┐
│  NOUVEAU PROJET                                       │
│                                                       │
│  🔍 Rechercher une facture existante...              │
│  ┌──────────────────────────────────────────────┐    │
│  │ F-2026-005 — Hôtel Ivoire — 2 450 000 FCFA   │    │
│  │ F-2026-008 — Banque Atlantique — 1 800 000   │    │
│  │ ...                                           │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ── OU ──                                            │
│                                                       │
│  ✨ Créer une nouvelle facture                        │
│  (ouvre Wari dans la sidebar)                        │
│                                                       │
│  ── Puis ──                                          │
│                                                       │
│  Nom du projet : [________________]                   │
│  Date livraison : [12/06/2026]                        │
│  Équipe : [+ Ajouter un contact]                      │
│                                                       │
│  [Créer le projet]                                    │
└──────────────────────────────────────────────────────┘
```

### 7.5 Page détail — `/projects/:id`

```
┌─────────────────────────────────────────────────────────┐
│  ← Projets  │  Projet: Hôtel Ivoire  │ Phase: Fabrication│
├─────────────────────────────────────────────────────────┤
│  [Documents] [Kanban] [Checklists] [Chat Projet]        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ONGLET KANBAN :                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ À FAIRE   │ │ EN COURS  │ │EN RÉVISION│ │ TERMINÉ   │   │
│  │           │ │           │ │           │ │           │   │
│  │ Commander │ │ Découpe   │ │ Contrôle  │ │ Réception │   │
│  │ acrylique │ │ panneaux  │ │ dimensions│ │ matériel  │   │
│  │ 🔴 High   │ │ 🟡 Medium │ │ 🟡 Medium │ │ 🟢 Done   │   │
│  │ 👤 Logist.│ │ 👤 Tech.  │ │ 👤 Superv.│ │ 5 Juin    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  [+ Ajouter une tâche]                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 8. La Page Configuration — Agents + Logs unifiés

### 8.1 Évolution de `/agent-config`

La page actuelle `/agent-config` devient une **page de configuration unifiée** avec 3 onglets :

```
┌──────────────────────────────────────────────────────────┐
│  ⚙️ Configuration                                         │
│  [Agents] [Logs] [Projets]                               │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ONGLET AGENTS :                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │ 💼 Wari (Commercial)                    [Éditer] │     │
│  │ 🔧 Brico (Technique)                    [Éditer] │     │
│  │ 🎯 Chef de Projet                       [Éditer] │     │
│  │ 🔔 Notificateur                         [Éditer] │     │
│  │ 👁️ Sentinelle                           [Éditer] │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  ONGLET LOGS :                                            │
│  ┌─────────────────────────────────────────────────┐     │
│  │ [chat] [tool] [error] [warn] [info]  [🔍 Filtrer]│     │
│  │                                                    │     │
│  │ 12:45:32 [chat] Wari → Réponse facture F-2026-015 │     │
│  │ 12:44:18 [tool] Brico → skill:manufacturing-rules │     │
│  │ 12:43:01 [chat] PM → Rapport quotidien généré     │     │
│  │ 11:00:00 [cron] Sentinelle → Scan OK (score 85)   │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  ONGLET PROJETS (futur) :                                 │
│  ┌─────────────────────────────────────────────────┐     │
│  │ Templates de projet, workflows, phases par défaut│     │
│  └─────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

---

# PARTIE D — PROCÉDURAL

## 9. Flux de dérivation intelligent — CDC → Kanban

### 9.1 La séquence complète

C'est le **flux clé** qui différencie le nouveau système de l'ancien. Quand un CDC est créé (par Brico), le système parse automatiquement son contenu pour créer les tâches Kanban et les checklists.

```
ÉTAPE 1 : L'UTILISATEUR CRÉE LE CDC
  User → Sidebar → Hermes-PM → Hermes-Brico (délégation)
  Brico génère le CDC avec :
    - enseignes[].materiauxSections.{Découpe, Éclairage, Structure...}
    - equipe[] (techniciens assignés)

ÉTAPE 2 : HERMES-PM PARSE LE CDC (skill: cdc-parse)
  Pour chaque enseigne :
    1. Extrait les sections de matériaux
    2. Pour chaque section, crée une checklist :
       - Découpe → Checklist "Découpe — Enseigne X"
       - Éclairage → Checklist "Éclairage — Enseigne X"
    3. Pour chaque matériau dans la section, crée un item de checklist

ÉTAPE 3 : CRÉATION DES TÂCHES KANBAN (skill: kanban-manager)
  Pour chaque section de matériaux :
    1. Crée une tâche "Préparer {section} — {enseigne}"
    2. Assigne au technicien (via equipe[])
    3. Définit la deadline (calculée depuis projects.date_livraison)
    4. Lie la tâche à la checklist correspondante

ÉTAPE 4 : CRÉATION DES TÂCHES D'APPROVISIONNEMENT
  Pour chaque matériau unique (dédupliqué) :
    1. Crée une tâche "Commander {matériau}"
    2. Assigne au logisticien
    3. Priorité selon dépendances

ÉTAPE 5 : NOTIFICATION (Hermes-Notificateur)
  🔔 Notification → Logisticien : liste des matériaux à commander
  🔔 Notification → Technicien : planning des tâches
```

### 9.2 Exemple concret

```
CDC généré par Brico :
{
  enseignes: [
    {
      nom: "Enseigne façade 4m×1.5m",
      materiauxSections: {
        "Découpe": [
          { nom: "Acrylique 3mm", quantite: 12, unite: "panneau" },
          { nom: "Aluminium profilé", quantite: 8, unite: "barre" }
        ],
        "Éclairage": [
          { nom: "LED 12V blanche", quantite: 200, unite: "unité" },
          { nom: "Transformateur 200W", quantite: 2, unite: "unité" }
        ]
      }
    },
    {
      nom: "Totem parking",
      materiauxSections: {
        "Structure": [
          { nom: "Acier galvanisé", quantite: 3, unite: "poteau" },
          { nom: "Dibond 3mm", quantite: 4, unite: "panneau" }
        ]
      }
    }
  ],
  equipe: [
    { nom: "Kouamé", role: "Technicien" },
    { nom: "M. Koné", role: "Superviseur" }
  ]
}

↓ cdc-parse + kanban-manager ↓

CHECKLISTS CRÉÉES :
  ✅ Checklist Découpe — Enseigne façade (2 items)
  ✅ Checklist Éclairage — Enseigne façade (2 items)
  ✅ Checklist Structure — Totem parking (2 items)

TÂCHES KANBAN CRÉÉES :
  📌 Préparer Découpe — Enseigne façade · 👤 Kouamé · 📅 10 Juin
  📌 Préparer Éclairage — Enseigne façade · 👤 Kouamé · 📅 11 Juin
  📌 Préparer Structure — Totem parking · 👤 Kouamé · 📅 10 Juin
  📌 Commander Acrylique 3mm · 👤 Logisticien · 📅 7 Juin  🔴
  📌 Commander Aluminium profilé · 👤 Logisticien · 📅 7 Juin  🔴
  📌 Commander LED 12V · 👤 Logisticien · 📅 7 Juin  🟡
  📌 Commander Acier galvanisé · 👤 Logisticien · 📅 7 Juin  🔴
```

---

## 10. Matrice de routage — Quel agent sur quelle page

| URL / Contexte | Agent par défaut | Agent alternatif (si forcé) | Skills actifs |
|---|---|---|---|
| `/chat` (général) | Hermes-Wari | Brico | product-search, document-create |
| `/templates` (CRM) | Hermes-Wari | Brico | document-update, document-view |
| `/products` | Hermes-Brico | Wari | manufacturing-rules, product-search |
| `/projects` (liste) | Hermes-Wari | — | document-search |
| `/projects/:id` → Onglet Documents | Hermes-PM | Wari, Brico | project-orchestrator, document-view |
| `/projects/:id` → Onglet Kanban | Hermes-PM | — | kanban-manager |
| `/projects/:id` → Onglet Checklists | Hermes-PM | — | checklist-validator |
| `/projects/:id` → Onglet Chat | Hermes-PM | — | Tous skills PM |
| `/agent-config` | Hermes-Wari | — | agent-config |
| `/logs` | Hermes-Wari | — | log-viewer |
| **Création document** (sidebar contextuelle) | Selon type : Facture→Wari, CDC→Brico | — | document-create, cdc-generate |
| **Modification document** (template ouvert) | Selon type du document | — | document-update |
| **Dérivation** (template A → type B) | Agent du type B | — | document-derivation |

---

# PARTIE E — DÉPLOIEMENT

## 11. Plan Walking Skeleton — 4 Blocs

> **Principe Walking Skeleton :** Chaque bloc produit un système **fonctionnel et utilisable**. On ne construit pas tout puis on allume — on allume à chaque étape.

```
SEMAINE 1          SEMAINE 2          SEMAINE 3          SEMAINE 4+
─────┼─────────────────┼─────────────────┼─────────────────┼─────
     │                  │                  │                  │
 BLOC 1 (J1-3)     BLOC 2 (J4-7)     BLOC 3 (J8-11)    BLOC 4 (J12+)
     │                  │                  │                  │
     ▼                  ▼                  ▼                  ▼
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│Sidebar  │      │Outils   │      │Notif.   │      │Sentinelle│
│unifiée  │  →   │actifs   │  →   │terrain  │  →   │24/7     │
│+ Noyau  │      │+ Dériv. │      │+ Photos │      │+ Scores │
│projet   │      │CDC→Kanb.│      │+ Vocaux │      │+ Escal. │
└─────────┘      └─────────┘      └─────────┘      └─────────┘
     │                  │                  │                  │
     ▼                  ▼                  ▼                  ▼
 100% fonct.       L'IA agit        L'atelier         Zéro oubli
 Sidebar OK        sur les docs     connecté          garanti
 Projets OK        et le Kanban     via app
```

| Bloc | Jours | Objectif | Livrable clé | Fonctionnel après ? |
|------|-------|----------|-------------|-------------------|
| **1** | J1-3 | Unifier sidebar + noyau projet | Sidebar route via API Hermes. Nouvelle page `/projects/:id` avec accordéons + Kanban | ✅ OUI — sidebar 100% fonctionnelle, projets visibles |
| **2** | J4-7 | Activer outils + dérivation | Skills Wari/Brico actifs. CDC→Kanban automatique. Checklists | ✅ OUI — l'IA crée/modifie documents et tâches |
| **3** | J8-10 | Notifications In-App | Notificateur envoie rappels/alertes via centre de notifications. Cron 8h/4h → app | ✅ OUI — l'Admin et l'équipe sont notifiés |
| **4** | J12+ | Surveillance autonome | Sentinelle scanne 24/7. Scores. Escalade automatique | ✅ OUI — le système est autonome |

---

## 12. Détail par bloc — Tâches, fichiers, validation

### BLOC 1 — Unification Sidebar & Noyau Projet (Jours 1-3)

**Objectif :** La sidebar passe par l'API Hermes. La nouvelle page projet remplace l'ancienne.

#### Tâches Backend (Hermes)

| # | Tâche | Détail |
|---|-------|--------|
| 1.1 | Créer les profils `hermes-wari` et `hermes-brico` | `hermes profile create` + copie des prompts depuis `agentConfigStore.ts` |
| 1.2 | Créer les skills de base | `product-search`, `document-create`, `manufacturing-rules` |
| 1.3 | Déployer le serveur API Hermes local | `server/hermes-api.ts` — Express sur port 11434 |
| 1.4 | Coder le routeur de contexte | `hermesRouter.ts` + `pageContextDetector.ts` |
| 1.5 | Migrer les appels `sendChatRequest` → `hermesRouter.send` | Modifier `ChatContainer.tsx` |

#### Tâches Frontend (AssoAI)

| # | Tâche | Fichiers |
|---|-------|----------|
| 1.6 | Créer la migration SQL (tables `project_tasks`, `checklists`, `project_contacts`) | `supabase-migrations/003_project_management.sql` |
| 1.7 | Étendre `projects` (status, phase, date_livraison, workflow_config) | Migration SQL + `src/types/project.ts` |
| 1.8 | Créer les types TypeScript | `src/types/project-task.ts`, `src/types/checklist.ts` |
| 1.9 | Créer les hooks React Query | `src/hooks/useProjectTasks.ts`, `src/hooks/useChecklists.ts` |
| 1.10 | Nouvelle page `Projects.tsx` — liste en accordéon + recherche | `src/pages/Projects.tsx` (refonte) |
| 1.11 | Composant `ProjectAccordionCard` | `src/components/projects/ProjectAccordionCard.tsx` |
| 1.12 | Composant `ProjectSearchWidget` (recherche avec suggestions) | `src/components/projects/ProjectSearchWidget.tsx` |
| 1.13 | Composant `KanbanBoard` + `KanbanColumn` + `KanbanCard` | `src/components/projects/KanbanBoard.tsx` |
| 1.14 | Composant `ChecklistPanel` + `ChecklistSection` | `src/components/projects/ChecklistPanel.tsx` |
| 1.15 | Mise à jour `App.tsx` — routes | `App.tsx` |

#### Fichiers supprimés (obsolètes)

```
✕ src/components/projects/ProjectDetails.tsx   # Remplacé par Projects.tsx refondu
✕ src/components/projects/ProjectList.tsx      # Fusionné dans Projects.tsx
✕ src/components/projects/ProjectCard.tsx      # Remplacé par ProjectAccordionCard
✕ src/components/projects/ProjectModal.tsx     # Remplacé par modal inline
✕ src/components/projects/AddToProjectModal.tsx # Plus nécessaire
✕ src/components/projects/SearchTemplatesModal.tsx # Remplacé par ProjectSearchWidget
✕ src/components/projects/ProjectWorkflow.tsx   # Remplacé par KanbanBoard
✕ src/services/orchestrator.ts                # Remplacé par hermesRouter
✕ src/services/dataInjector.ts                # Remplacé par skills Hermes
```

#### Validation Bloc 1

```
✅ Sidebar ouverte sur /chat → Wari répond (via Hermes)
✅ Sidebar ouverte sur /products → Brico répond (via Hermes)
✅ Sidebar ouverte sur /projects/:id → PM répond (via Hermes)
✅ Page /projects : liste en accordéon avec recherche
✅ Page /projects/:id : onglets Documents, Kanban, Checklists, Chat
✅ Création projet : recherche facture existante OU nouvelle facture
✅ Kanban : création, édition, drag & drop entre colonnes
✅ Checklists : items cochables, barres de progression
```

---

### BLOC 2 — Activation des Outils & Dérivation (Jours 4-7)

**Objectif :** Wari et Brico utilisent leurs vrais outils. Le flux CDC→Kanban est actif.

#### Tâches

| # | Tâche | Détail |
|---|-------|--------|
| 2.1 | Activer les skills Wari | `product-search`, `document-derivation`, `document-update`, `document-numbers` |
| 2.2 | Activer les skills Brico | `cdc-generate`, `material-calculator`, `cdc-parse`, `enseigne-dimensions` |
| 2.3 | Créer le skill `cdc-parse` | Parse le JSON du CDC → extrait sections, matériaux, équipe |
| 2.4 | Créer le skill `kanban-manager` | CRUD project_tasks, création depuis CDC |
| 2.5 | Créer le skill `checklist-validator` | Validation auto, création depuis CDC |
| 2.6 | Implémenter le flux CDC→Kanban | Quand CDC créé → auto-parse → tâches + checklists |
| 2.7 | Activer la dérivation dans Wari | Facture→Commande avec `linked_facture_id` automatique |
| 2.8 | Créer le profil `hermes-pm` | + skills : `project-orchestrator`, `kanban-manager`, `checklist-validator`, `project-reporting` |
| 2.9 | Intégrer le chat projet (session Hermes persistante) | `session_type = 'project'` dans messages |
| 2.10 | Page Configuration → Onglet Logs | Lecture des logs depuis Supabase `app_logs` |

#### Validation Bloc 2

```
✅ Wari crée une facture → utilise les vrais prix du catalogue (skill product-search)
✅ Brico génère un CDC → les sections et matériaux sont extraits
✅ CDC créé → 8 tâches Kanban + 3 checklists auto-générées
✅ Dérivation facture→commande → linked_facture_id automatique
✅ Chat projet → PM répond avec le contexte du projet
✅ Page Configuration → Logs visibles et filtrables
```

---

### BLOC 3 — Notifications & Suivi In-App (Jours 8-10)

> **Décision 08/06/2026** : WhatsApp retiré du périmètre. Toute la communication terrain passe par l'application.

**Objectif :** L'équipe terrain et l'Admin reçoivent rappels, alertes et escalades directement dans l'application via le centre de notifications et le chat projet.

#### Architecture de notification

```
┌─────────────────────────────────────────────────────────────┐
│                  SYSTÈME DE NOTIFICATION IN-APP              │
│                                                              │
│  Cron (8h, 4h) ──→ Hermes-Notificateur ──→ Supabase         │
│                                            notifications    │
│                                                  │          │
│                    ┌─────────────────────────────┤          │
│                    ▼                             ▼          │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │ 🔔 Centre Notifications│    │ 💬 Chat Projet           │  │
│  │  • Badge compteur     │    │  • Message Directeur     │  │
│  │  • Liste alerts/rappels│   │  • Escalade Admin        │  │
│  │  • Marquer comme lu   │    │  • Contexte projet       │  │
│  └──────────────────────┘    └──────────────────────────┘  │
│                                                              │
│  Toasts (popups) pour alertes temps réel                     │
└─────────────────────────────────────────────────────────────┘
```

#### Tâches

| # | Tâche | Détail |
|---|-------|--------|
| 3.1 | Créer le profil `hermes-notificateur` | + skills : `notification-app`, `cron-reminders`, `notification-router`, `escalation-manager` |
| 3.2 | Créer la table `notifications` | Supabase : colonnes `id, user_id, project_id, type, level, title, message, read, created_at` |
| 3.3 | Créer le composant `NotificationBell` | Icône cloche 🔔 dans la TopBar avec badge compteur |
| 3.4 | Créer le composant `NotificationCenter` | Panel dropdown listant les notifications, filtre par projet, marquer comme lu |
| 3.5 | Créer le hook `useNotifications` | React Query : fetch, mark read, compteur non-lu |
| 3.6 | Programmer les crons | Vérification retards (4h), rapport quotidien (8h) → insertion dans `notifications` |
| 3.7 | Activer l'escalade progressive | Retard > 24h → notification + toast, > 48h → notification + message chat superviseur, > 72h → notification critique + message Admin |
| 3.8 | Intégrer les toasts | Alertes critiques en popup temporaire (3s) + notification persistante |

#### Validation Bloc 3

```
✅ 8h : Admin voit le rapport quotidien dans le centre de notifications
✅ Retard > 24h : Badge 🔔 s'incrémente, notification visible dans le panneau
✅ Retard > 48h : Message automatique du Directeur dans le chat projet
✅ Retard > 72h : Toast critique + notification urgence + message Admin
✅ Clic sur une notification → ouvre le projet concerné
✅ Notification marquée comme lue → badge décrémenté
```

---

### BLOC 4 — Surveillance Autonome (Jours 12+)

**Objectif :** La Sentinelle scanne 24/7. Scores, alertes, escalade automatique.

#### Tâches

| # | Tâche | Détail |
|---|-------|--------|
| 4.1 | Créer le profil `hermes-sentinelle` | + skills : `project-watcher`, `anomaly-detector`, `health-scorer` |
| 4.2 | Déployer le cron horaire | `0 * * * *` → Sentinelle scanne tous les projets |
| 4.3 | Implémenter le Project Health Score | Formule : 25×(docs/3) + 25×(tâches_ok/total) + 25×(%checklists) + 25×(1−blocage/7) |
| 4.4 | Détecter les patterns anormaux | Blocage prolongé, cascade de retards, incohérence documents |
| 4.5 | Activer l'escalade automatique | Score < 50 → Kanban Directeur, < 30 → Notification critique + message Admin dans le chat projet |
| 4.6 | Dashboard santé (optionnel) | Widget dans `/projects` montrant les scores |

#### Validation Bloc 4

```
✅ Toutes les heures : Sentinelle scanne et calcule les scores
✅ Score < 50 : Alerte Kanban créée pour le Directeur
✅ Score < 30 : Notification critique + message Admin dans le chat projet
✅ Blocage > 7j : Escalade automatique
✅ Dashboard : scores visibles sur la liste des projets
```

---

## 13. Stratégie de transition — Ancien → Nouveau

### 13.1 Ce qui est supprimé (après Bloc 1)

| Élément supprimé | Raison | Impact |
|-----------------|--------|--------|
| `orchestrator.ts` | Remplacé par `hermesRouter.ts` | Aucun — le nouveau routeur fait mieux |
| `dataInjector.ts` | Remplacé par les skills Hermes | Aucun — les skills sont plus performants |
| `chatService.ts` (appel DeepSeek direct) | Remplacé par l'API Hermes | Aucun — Hermes gère l'appel |
| `agentConfigStore.ts` (injection localStorage) | Prompts migrés dans les profils Hermes | **Les prompts sont migrés** avant suppression |
| `tools.ts` (déjà inutilisé) | Déjà mort — suppression propre | Aucun |
| Anciens composants projet (7 fichiers) | Remplacés par la nouvelle interface | La nouvelle interface est plus riche |

### 13.2 Ce qui est préservé

| Élément préservé | Pourquoi |
|-----------------|----------|
| `SlidingChatPanel.tsx` | UI inchangée |
| `MessageInput.tsx` (sélecteur Wari/Brico) | Conservé visuellement, logique adaptée |
| `ChatMessage.tsx`, `QuoteMessage.tsx` | Affichage des messages inchangé |
| `TemplateQuoteCard.tsx` | Affichage des documents cités inchangé |
| `TemplateRenderer.tsx`, tous les templates | Rendu des documents inchangé |
| `ProductSuggestions.tsx` | Sélection produit dans les formulaires inchangée |
| `database.ts` (saveMessage, repairIsLatest) | Logique de persistance préservée |
| Tous les types (`template-data.ts`, etc.) | Structures de données inchangées |
| Page `/agent-config` → devenue page Configuration | Évolution, pas suppression |

### 13.3 Ordre de migration — Zéro interruption

```
1. Créer les nouveaux fichiers (hermesRouter, pageContextDetector, etc.)
2. Créer les profils Hermes (wari, brico, pm) AVEC les prompts migrés
3. Déployer le serveur API Hermes local
4. Modifier ChatContainer.handleSendMessage → hermesRouter.send
5. TESTER : la sidebar fonctionne toujours
6. Déployer les nouvelles tables Supabase
7. Déployer la nouvelle page /projects
8. SUPPRIMER les fichiers obsolètes
9. Commiter, builder, déployer

→ L'utilisateur ne voit aucune interruption.
→ La sidebar fonctionne à l'étape 5 (avant même le nouveau projet).
→ Les anciens projets sont toujours visibles (les données sont dans Supabase).
```

---

## 14. Récapitulatif des livrables

### Base de données
| Type | Nombre | Détail |
|------|--------|--------|
| Nouvelles tables | 3 | `project_tasks`, `checklists`, `project_contacts` |
| Tables modifiées | 2 | `projects` (+5 colonnes), `messages` (+2 colonnes) |
| Migration SQL | 1 | `supabase-migrations/003_project_management.sql` |

### Code Frontend (AssoAI)
| Type | Nombre | Détail |
|------|--------|--------|
| Nouveaux fichiers | 18 | `hermesRouter.ts`, `pageContextDetector.ts`, serveur API, types (2), hooks (3), composants projet (9), Kanban (3) |
| Fichiers modifiés | 6 | `ChatContainer.tsx`, `Projects.tsx`, `App.tsx`, `TopBar.tsx`, `agent-config.tsx` → Configuration, `types/project.ts` |
| Fichiers supprimés | 10 | `orchestrator.ts`, `dataInjector.ts`, 7 composants projet obsolètes, `tools.ts` |

### Profils & Skills Hermes
| Type | Nombre | Détail |
|------|--------|--------|
| Profils Hermes | 5 | `hermes-wari`, `hermes-brico`, `hermes-pm`, `hermes-notificateur`, `hermes-sentinelle` |
| Skills | 21 | 6 (Wari) + 5 (Brico) + 5 (PM) + 3 (Notificateur) + 3 (Sentinelle) = 22 (dont 2 partagés) |
| Serveur API | 1 | `server/hermes-api.ts` (Express, port 11434) |
| Cron jobs | 3 | Scan horaire (Sentinelle), rapport quotidien 8h, vérification retards 4h (Notificateur) |

### Arborescence finale

```
/workspace/chat-flow-templates-main/
├── src/
│   ├── services/
│   │   ├── hermesRouter.ts          ← NOUVEAU (remplace orchestrator.ts)
│   │   ├── pageContextDetector.ts   ← NOUVEAU
│   │   ├── chatService.ts           ← MODIFIÉ (appelle Hermes, pas DeepSeek direct)
│   │   ├── database.ts              ← PRÉSERVÉ
│   │   └── ...
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatContainer.tsx    ← MODIFIÉ (handleSendMessage)
│   │   │   ├── MessageInput.tsx     ← PRÉSERVÉ (UI) + adapté (logique)
│   │   │   ├── SlidingChatPanel.tsx ← PRÉSERVÉ
│   │   │   └── ...
│   │   └── projects/
│   │       ├── ProjectAccordionCard.tsx  ← NOUVEAU
│   │       ├── ProjectSearchWidget.tsx   ← NOUVEAU
│   │       ├── KanbanBoard.tsx           ← NOUVEAU
│   │       ├── KanbanColumn.tsx          ← NOUVEAU
│   │       ├── KanbanCard.tsx            ← NOUVEAU
│   │       ├── ChecklistPanel.tsx        ← NOUVEAU
│   │       ├── ChecklistSection.tsx      ← NOUVEAU
│   │       ├── ProjectChat.tsx           ← NOUVEAU
│   │       └── ProjectProgress.tsx       ← NOUVEAU
│   ├── pages/
│   │   ├── Projects.tsx             ← REFONTE COMPLÈTE
│   │   ├── AgentConfig.tsx          ← ÉVOLUTION → Configuration (3 onglets)
│   │   └── ...
│   ├── types/
│   │   ├── project-task.ts          ← NOUVEAU
│   │   ├── checklist.ts             ← NOUVEAU
│   │   └── project.ts               ← MODIFIÉ (+status, +phase, etc.)
│   └── hooks/
│       ├── useProjectTasks.ts       ← NOUVEAU
│       ├── useChecklists.ts         ← NOUVEAU
│       └── useProjects.ts           ← MODIFIÉ
├── server/
│   └── hermes-api.ts                ← NOUVEAU (serveur Express)
└── supabase-migrations/
    └── 003_project_management.sql   ← NOUVEAU

~/.hermes/profiles/
├── hermes-wari/          ← NOUVEAU (prompt Wari migré)
├── hermes-brico/         ← NOUVEAU (prompt Brico migré)
├── hermes-pm/            ← NOUVEAU
├── hermes-notificateur/  ← NOUVEAU
├── hermes-sentinelle/    ← NOUVEAU

~/.hermes/skills/
├── product-search/       ← NOUVEAU (Wari + Brico)
├── document-create/      ← NOUVEAU (Wari)
├── document-derivation/  ← NOUVEAU (Wari)
├── document-update/      ← NOUVEAU (Wari)
├── document-numbers/     ← NOUVEAU (Wari)
├── client-suggestions/   ← NOUVEAU (Wari)
├── manufacturing-rules/  ← NOUVEAU (Brico)
├── cdc-generate/         ← NOUVEAU (Brico)
├── cdc-parse/            ← NOUVEAU (Brico)
├── material-calculator/  ← NOUVEAU (Brico)
├── enseigne-dimensions/  ← NOUVEAU (Brico)
├── project-orchestrator/ ← NOUVEAU (PM)
├── kanban-manager/       ← NOUVEAU (PM)
├── checklist-validator/  ← NOUVEAU (PM)
├── project-reporting/    ← NOUVEAU (PM)
├── team-coordinator/     ← NOUVEAU (PM)
├── notification-app/     ← NOUVEAU (Notificateur)
├── cron-reminders/       ← NOUVEAU (Notificateur)
├── notification-router/  ← NOUVEAU (Notificateur)
├── escalation-manager/   ← NOUVEAU (Notificateur)
├── project-watcher/      ← NOUVEAU (Sentinelle)
├── anomaly-detector/     ← NOUVEAU (Sentinelle)
└── health-scorer/        ← NOUVEAU (Sentinelle)
```

### Temps estimé : 12-15 jours (4 blocs)

---

## Prochaine action immédiate

**Démarrage Bloc 1 — Jour 1 :**
1. Créer les profils `hermes-wari` et `hermes-brico` avec les prompts migrés
2. Déployer les tables Supabase (migration SQL)
3. Créer les types TypeScript
4. Coder `hermesRouter.ts` + `pageContextDetector.ts`
5. Modifier `ChatContainer.handleSendMessage`

→ La sidebar reste 100% fonctionnelle, mais son moteur est modernisé.
