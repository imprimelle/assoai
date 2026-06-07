# Refonte Complète — Gestion de Projet Dynamique AssoAI

**Plan de conception, développement et déploiement**  
**Date** : 6 Juin 2026 — Version 2.0 unifiée  
**Contexte** : AssoAI est un CRM signalétique (Côte d'Ivoire) où l'IA crée des documents (Facture → Commande → Cahier des Charges). La gestion de projet actuelle est un simple conteneur d'IDs.  
**Objectif** : Créer un système de gestion de projet **proactif, multi-agents**, piloté par une équipe de profils Hermes spécialisés, avec Kanban, Checklists, Chat contextualisé, et notifications WhatsApp.

---

## Table des matières

### PARTIE A — VISION
1. [Architecture Cible](#1-architecture-cible)
2. [Les Acteurs — Humains & IA](#2-les-acteurs--humains--ia)
3. [Les Canaux de Communication](#3-les-canaux-de-communication)

### PARTIE B — DONNÉES & INTERFACE
4. [Structure de données — Nouveau modèle](#4-structure-de-données--nouveau-modèle)
5. [Interface Utilisateur — Page Projet](#5-interface-utilisateur--page-projet)

### PARTIE C — L'ÉQUIPE IA
6. [Les 4 Profils Hermes](#6-les-4-profils-hermes)
7. [Les 10 Skills Spécialisés](#7-les-10-skills-spécialisés)
8. [Coordination Inter-Profils — Le Système Nerveux](#8-coordination-inter-profils--le-système-nerveux)

### PARTIE D — PROCÉDURAL
9. [Cycles Procéduraux](#9-cycles-procéduraux)
10. [Exemple Complet — Projet « Enseigne Hôtel Ivoire »](#10-exemple-complet--projet-enseigne-hôtel-ivoire)
11. [Matrice de Décision & Chemins d'Escalade](#11-matrice-de-décision--chemins-descalade)

### PARTIE E — NOTIFICATIONS & DÉPLOIEMENT
12. [Système de Notifications & WhatsApp](#12-système-de-notifications--whatsapp)
13. [Plan de Développement — 5 Phases](#13-plan-de-développement--5-phases)
14. [Améliorations Proposées](#14-améliorations-proposées)
15. [Récapitulatif des Livrables](#15-récapitulatif-des-livrables)

---

# PARTIE A — VISION

## 1. Architecture Cible

> Le projet devient **l'entité centrale** de l'application. Ce n'est plus un simple regroupement de documents, c'est un **espace de travail vivant** orchestré par une équipe de 4 agents IA spécialisés qui anticipent, coordonnent et communiquent avec les parties prenantes humaines.

### 1.1 Flux de vie d'un projet

```
                    ┌──────────────────────────────────────┐
                    │         CRÉATION DU PROJET            │
                    │  (Admin → Directeur dans le chat)      │
                    └────────────────┬─────────────────────┘
                                     │
                    ┌────────────────▼─────────────────────┐
                    │    PHASE 1 : FACTURATION              │
                    │  - Création Facture (Exécuteur)       │
                    │  - Validation client (Admin)           │
                    │  - Génération Devis si nécessaire      │
                    │  - Notifications WhatsApp équipe       │
                    └────────────────┬─────────────────────┘
                                     │
                    ┌────────────────▼─────────────────────┐
                    │    PHASE 2 : COMMANDE                 │
                    │  - Dérivation Facture → Commande      │
                    │  - Checklist matériel                 │
                    │  - Kanban : tâches approvisionnement  │
                    │  - Rappels WhatsApp logisticien       │
                    │  - Cron : relance automatique          │
                    └────────────────┬─────────────────────┘
                                     │
                    ┌────────────────▼─────────────────────┐
                    │    PHASE 3 : FABRICATION              │
                    │  - Création CDC (Exécuteur → Brico)   │
                    │  - Checklist étapes fabrication       │
                    │  - Kanban : tâches atelier            │
                    │  - Rappels WhatsApp techniciens        │
                    │  - Escalade si retard                 │
                    └────────────────┬─────────────────────┘
                                     │
                    ┌────────────────▼─────────────────────┐
                    │    PHASE 4 : LIVRAISON                │
                    │  - Checklist contrôle qualité         │
                    │  - Mise à jour statut Commande        │
                    │  - Notification client                │
                    │  - Rapport final                      │
                    │  - Archivage projet                   │
                    └──────────────────────────────────────┘
```

### 1.2 Architecture système — Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│                      ASSOAI FRONTEND (React/Vite)                 │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │Documents │  │ Kanban   │  │Checklists│  │  Chat Projet     │ │
│  │(Timeline)│  │(Drag&Drop│  │(Items    │  │  (Directeur 🎯)  │ │
│  │          │  │ 4 col.)  │  │ cochables)│  │                  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       │             │             │                   │           │
└───────┼─────────────┼─────────────┼───────────────────┼───────────┘
        │             │             │                   │
        ▼             ▼             ▼                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                     SUPABASE (PostgreSQL + REST)                  │
│                                                                   │
│  projects │ project_tasks │ checklists │ messages (chat)          │
│  ─────────┼────────────────┼────────────┼──────────────────       │
│  status   │ column         │ items[]    │ project_id FK           │
│  phase    │ assignee       │ percentage │ session_type            │
│  workflow │ due_date       │ section    │ template_data           │
│  contacts │ priority       │ phase      │                         │
└───────────┴────────────────┴────────────┴─────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│               ÉQUIPE IA — 4 Profils Hermes                        │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐│
│  │ DIRECTEUR 🎯│  │ EXÉCUTEUR 🔧│  │COMMUNICANT📱│  │SENTINELLE││
│  │ Stratège    │  │ Agent de    │  │ Messager    │  │ Veilleur  ││
│  │ Dialogue    │  │ terrain     │  │ WhatsApp &  │  │ Scan 24/7 ││
│  │ humain      │  │ Docs+tâches │  │ rappels     │  │           ││
│  └──────┬─────┘  └──────┬──────┘  └──────┬──────┘  └─────┬────┘│
│         └────────────────┼───────────────┼───────────────┘      │
│                          │               │                       │
│              ┌───────────┴───────────────┴──────────┐           │
│              │       SYSTÈME NERVEUX                 │           │
│              │  Kanban (dispatch) + Cron (pulse)     │           │
│              │  + Supabase (source de vérité)        │           │
│              └───────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Les Acteurs — Humains & IA

### 2.1 Les Humains (5 rôles)

```
┌─────────────────────────────────────────────────────────────────┐
│                     ORGANIGRAMME PROJET                          │
│                                                                  │
│  ┌──────────────┐                                               │
│  │ ADMINISTRATEUR│ ← Imprimelle (CEO)                            │
│  │  (décideur)   │   Validation finale, décisions stratégiques   │
│  └──────┬───────┘                                               │
│         │                                                        │
│  ┌──────┴───────┐                                               │
│  │  SUPERVISEUR  │   Contrôle qualité, validation étapes         │
│  │  (contrôleur) │   Reçoit les escalades, valide les CDC        │
│  └──────┬───────┘                                               │
│         │                                                        │
│  ┌──────┴──────────────────────────┐                            │
│  │                                  │                            │
│  ▼                                  ▼                            │
│ ┌──────────┐  ┌──────────┐  ┌──────────────┐                   │
│ │TECHNICIEN│  │LOGISTIQUE│  │  COMMERCIAL   │                   │
│ │(fabrique)│  │(achats)  │  │  (client)     │                   │
│ └──────────┘  └──────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

| Rôle | Qui | Responsabilités | Canal principal | Fréquence |
|------|-----|----------------|-----------------|-----------|
| **Administrateur** | Imprimelle (CEO) | Validation finale, décisions stratégiques, archivage | WebUI (chat Directeur) + WhatsApp (rapports) | Quotidien (briefing 8h) + à la demande |
| **Superviseur** | Responsable atelier | Contrôle qualité, validation étapes, vérification CDC | WhatsApp (notifications + escalades) | 2-3× par semaine |
| **Technicien** | Ouvrier qualifié | Exécution fabrication, découpe, assemblage, pose | WhatsApp (tâches + rappels) | Quotidien (exécution) |
| **Logisticien** | Responsable achats | Commande matériaux, suivi fournisseurs, réception | WhatsApp (commandes + suivis) | 1-2× par semaine |
| **Commercial** | Contact client | Devis, facturation, relation client, livraison | WhatsApp (coordination) | Ponctuel (début/fin projet) |

### 2.2 Les IA — 4 Profils Hermes

| Profil | Icône | Rôle | Prompt clé | Déclencheur | Outils |
|--------|-------|------|-----------|-------------|--------|
| **`assoai-directeur`** | 🎯 | Stratège — dialogue humain, orchestre, délègue | « Tu ne fais JAMAIS le travail toi-même. Tu décomposes, tu assignes, tu suis. » | Message utilisateur dans le chat projet | terminal, web, memory, kanban, cronjob, delegation |
| **`assoai-executeur`** | 🔧 | Agent de terrain — exécute les tâches concrètes | « Tu reçois une tâche précise. Exécute-la. Ne dévie pas. Données réelles. » | Dispatch Kanban (tâche `assoai-executeur`) | terminal, file, web, memory, todo |
| **`assoai-communicant`** | 📱 | Messager — TOUTE la communication externe | « Messages professionnels, concis, français. Templates stricts. » | Dispatch Kanban (`assoai-communicant`) OU Cron | messaging, cronjob, memory, web |
| **`assoai-sentinelle`** | 👁️ | Veilleur — surveillance 100% automatique | « Scanne. Détecte. Alerte. N'agit JAMAIS. Crée une tâche Kanban. » | Cron toutes les heures | terminal, web, memory, kanban |

### 2.3 Matrice des interactions

```
Qui parle à qui ? Et comment ?

                    ─── Message WebUI (chat) ───
                    ···· WhatsApp ····
                    ─ ─ Kanban (tâche) ─ ─
                    === Supabase (données) ===

                   Admin   Superv  Tech   Logist  Commerc  Dir    Exéc   Commun Sentin
    Admin          ·       ·       ·      ·       ·       ───    ·      ·      ·
    Superviseur    ·               ·                      ·      ·      ·
    Technicien     ·                                                    ·
    Logisticien    ·                                                    ·
    Commercial     ·                                                    ·
    Directeur      ───     ·       ·      ·       ·              ─ ─    ─ ─    ===
    Exécuteur      ·                      ·                      ─ ─           ===
    Communicant    ·       ·       ·      ·       ·              ─ ─
    Sentinelle                                                                  ===
```

---

## 3. Les Canaux de Communication

### 3.1 Canal A : Chat WebUI (le QG)

**Seul canal où l'humain dialogue avec l'IA.** Session persistante (`session_type = 'project'`). Le Directeur est le SEUL interlocuteur. L'utilisateur ne voit JAMAIS l'Exécuteur, le Communicant, ou la Sentinelle.

```
┌──────────────────────────────────────────────────────────┐
│  💬 PROJET : Enseigne Hôtel Ivoire                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │  👤 Imprimelle : Le client a payé. On passe à la   │  │
│  │  commande.                                         │  │
│  │                                                     │  │
│  │  🎯 Directeur : ✅ Compris. Je m'en occupe :       │  │
│  │    1. Mise à jour facture → Payé                   │  │
│  │    2. Dérivation commande CMD-2026-004              │  │
│  │    3. Création tâches approvisionnement             │  │
│  │    4. Notification logisticien                      │  │
│  │                                                     │  │
│  │  [L'Exécuteur et le Communicant travaillent          │  │
│  │   en arrière-plan via Kanban...]                    │  │
│  │                                                     │  │
│  │  🎯 Directeur : ✅ Phase COMMANDE activée.          │  │
│  │    • Commande CMD-2026-004 créée                    │  │
│  │    • 4 tâches approvisionnement créées               │  │
│  │    • Logisticien notifié via WhatsApp               │  │
│  │    • Checklist approvisionnement prête               │  │
│  │    • Prochain rappel : 8 Juin                       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Canal B : Kanban (le dispatching)

**Communication inter-profils uniquement.** Le Directeur crée des tâches → assigne à l'Exécuteur ou au Communicant. La Sentinelle crée des alertes → assigne au Directeur. Le dispatcher Hermes spawn automatiquement le profil cible. Chaque `kanban_complete` contient un `summary` et un `metadata` structuré pour le profil consommateur.

```
┌────────────────────────────────────────────────────────────┐
│                 BOARD : assoai-projets                      │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ID     │ Titre                        │ Assigné     │  │
│  ├────────┼──────────────────────────────┼─────────────┤  │
│  │ t_01   │ Projet Hôtel Ivoire :        │ assoai-     │  │
│  │        │ créer tâches approvisionnement│ executeur   │  │
│  ├────────┼──────────────────────────────┼─────────────┤  │
│  │ t_02   │ Projet Hôtel Ivoire :        │ assoai-     │  │
│  │        │ notifier logisticien          │ communicant │  │
│  ├────────┼──────────────────────────────┼─────────────┤  │
│  │ t_03   │ ⚠️ ALERTE : 3 tâches en     │ assoai-     │  │
│  │        │ retard — Projet Banque       │ directeur   │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 3.3 Canal C : WhatsApp (le terrain)

**Géré exclusivement par le Communicant.** Templates standardisés. Réponses humaines → `message-router` → mise à jour Kanban/Supabase.

```
┌──────────────────────────────────────────────────────────┐
│           COMMUNICATIONS WHATSAPP                         │
│  ┌─────────────────────────────────────────────────┐     │
│  │ 📱 Communicant → Logisticien                    │     │
│  │ 📋 *Rappel Projet Hôtel Ivoire*                  │     │
│  │ Tâche : Commander acrylique 3mm                  │     │
│  │ Échéance : 8 Juin 2026 · Priorité : 🔴 Haute    │     │
│  │ Merci de confirmer la commande.                   │     │
│  │ ─────────────────────────────────────────────── │     │
│  │ 📱 ← Logisticien :                               │     │
│  │ Commande passée. Livraison prévue le 10 Juin.     │     │
│  │ → Routage → Exécuteur (Kanban) : MAJ tâche       │     │
│  └─────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

### 3.4 Canal D : Supabase (source de vérité)

Tous les profils lisent/écrivent dans la même base. Lecture/écriture régie par des règles strictes :

| Donnée | Qui écrit | Qui lit |
|--------|-----------|---------|
| `projects.phase` | Exécuteur | Tous |
| `project_tasks` | Exécuteur | Tous |
| `checklists.items` | Exécuteur | Tous |
| `messages` (documents) | Exécuteur | Directeur (lecture) |
| `project_contacts` | Directeur (via Exécuteur) | Communiquant |
| `app_logs` | Tous | Sentinelle (debug) |

---

# PARTIE B — DONNÉES & INTERFACE

## 4. Structure de données — Nouveau modèle

### 4.1 Table `projects` — enrichie

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status text DEFAULT 'actif';
-- Valeurs: 'actif', 'en_attente', 'termine', 'archive'

ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase text DEFAULT 'facturation';
-- Valeurs: 'facturation', 'commande', 'fabrication', 'livraison', 'termine'

ALTER TABLE projects ADD COLUMN IF NOT EXISTS date_livraison timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workflow_config jsonb DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS chat_session_id text;
```

### 4.2 Table `project_tasks` — Kanban (nouvelle)

```sql
CREATE TABLE project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  column text NOT NULL DEFAULT 'a_faire',
  -- Colonnes: 'a_faire', 'en_cours', 'en_revision', 'termine'
  position integer DEFAULT 0,
  assignee text,          -- 'technicien', 'superviseur', 'logistique', 'commercial', 'admin'
  assignee_contact text,  -- WhatsApp ou téléphone du responsable
  due_date timestamptz,
  completed_at timestamptz,
  labels text[] DEFAULT '{}',
  priority text DEFAULT 'medium',  -- 'low', 'medium', 'high', 'critical'
  created_by text,        -- 'user' ou 'agent'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_column ON project_tasks(project_id, column);
CREATE INDEX idx_project_tasks_due ON project_tasks(due_date) WHERE completed_at IS NULL;
```

### 4.3 Table `checklists` — Suivi d'étapes (nouvelle)

```sql
CREATE TABLE checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES project_tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  section text,           -- 'facturation', 'approvisionnement', 'fabrication', 'qualite', 'livraison'
  phase text,
  items jsonb NOT NULL DEFAULT '[]',
  /*
  [{
    "id": "uuid",
    "label": "Vérifier dimensions panneau",
    "done": false,
    "done_by": null,
    "done_at": null,
    "required_image": false,
    "image_url": null,
    "notes": ""
  }]
  */
  total_items integer DEFAULT 0,
  completed_items integer DEFAULT 0,
  percentage integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_checklists_project ON checklists(project_id);
```

### 4.4 Table `project_contacts` — Contacts (nouvelle)

```sql
CREATE TABLE project_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,  -- 'technicien', 'superviseur', 'logistique', 'commercial', 'admin'
  phone text,          -- Format international: 2250102030405
  notify_tasks boolean DEFAULT true,
  notify_phase boolean DEFAULT true,
  notify_deadline boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### 4.5 Table `messages` — extension

```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'chat';
-- 'chat' (général), 'project' (chat dédié projet)
```

### 4.6 Types TypeScript

```typescript
// src/types/project.ts — enrichi
interface ProjectWorkflow {
  auto_transitions: boolean;
  notifications: boolean;
  phases: ProjectPhase[];
}

interface ProjectPhase {
  name: string;              // 'facturation', 'commande', 'fabrication', 'livraison'
  label: string;             // 'Facturation & Devis'
  order: number;
  required_documents: TemplateType[];
  checklist_sections: string[];
  auto_tasks: AutoTask[];    // Tâches créées automatiquement au passage de phase
}

interface AutoTask {
  title: string;
  assignee: string;
  due_offset_days: number;   // Délai après entrée dans la phase
}

// src/types/project-task.ts — nouveau
interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  column: 'a_faire' | 'en_cours' | 'en_revision' | 'termine';
  position: number;
  assignee?: string;
  due_date?: string;
  completed_at?: string;
  labels: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_by: 'user' | 'agent';
  created_at: string;
  updated_at: string;
}

// src/types/checklist.ts — nouveau
interface Checklist {
  id: string;
  project_id: string;
  task_id?: string;
  title: string;
  section?: string;
  phase?: string;
  items: ChecklistItem[];
  total_items: number;
  completed_items: number;
  percentage: number;
}

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  done_by?: string;
  done_at?: string;
  required_image?: boolean;
  image_url?: string;
  notes?: string;
}
```

---

## 5. Interface Utilisateur — Page Projet

### 5.1 Layout global

```
┌─────────────────────────────────────────────────────────┐
│  ← Projets  │  Projet: Enseigne Hôtel Ivoire  │ [Archive]│
│             │  Phase: Fabrication · Livraison 12 Juin   │
├─────────────────────────────────────────────────────────┤
│  [Documents] [Kanban] [Checklists] [Chat]  │ 🔔 3 rappels│
├─────────────────────────────────────────────────────────┤
│          CONTENU DE L'ONGLET ACTIF                       │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Onglet 1 — Documents (Timeline)

Vue timeline verticale montrant l'enchaînement Facture → Commande → CDC, badges de statut, barre de progression globale.

```
🔵 PHASE FACTURATION  ✓ Complétée
  ┌─ 📄 Facture F-2026-005 · Hôtel Ivoire · 2 450 000 FCFA ─┐
       │
       ▼ (dérivation automatique)
🟠 PHASE COMMANDE  ✓ Complétée
  ┌─ 📦 Commande CMD-2026-004 · 3 articles ──────────────────┐
       │
       ▼
🟣 PHASE FABRICATION  ● En cours
  ┌─ 📋 CDC CDC-2026-001 · 2 enseignes · Équipe: 4 ──────────┐

Progression: ████████████░░░░ 75%
```

### 5.3 Onglet 2 — Kanban

4 colonnes avec drag & drop (`@dnd-kit/core`), création de tâche (titre, description, priorité, assigné, deadline), filtrage, badges de retard.

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ À FAIRE   │  │ EN COURS  │  │EN RÉVISION│  │ TERMINÉ   │
│           │  │           │  │           │  │           │
│ Commander │  │ Découpe   │  │ Contrôle  │  │ Réception │
│ acrylique │  │ panneaux  │  │ dimensions│  │ matériel  │
│ 🔴 High   │  │ 🟡 Medium │  │ 🟡 Medium │  │ 🟢 Done   │
│ 👤 Logist.│  │ 👤 Tech.  │  │ 👤 Superv.│  │ 5 Juin    │
│ 📅 8 Juin │  │ 📅 10 Juin│  │ 📅 11 Juin│  │           │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### 5.4 Onglet 3 — Checklists

Items cochables par phase avec horodatage, upload photo pour les items le requérant, barres de progression, vue d'ensemble « santé du projet ». L'Exécuteur peut cocher des items automatiquement.

```
CHECKLIST APPROVISIONNEMENT     ████████░░ 80%
☑ Commander profilés aluminium    ✓ Logistique · 5 Juin
☑ Vérifier stock LEDs             ✓ Superviseur · 6 Juin
☐ Réceptionner acrylique 3mm      📅 8 Juin
☐ Contrôler qualité vinyle        📷 Photo requise

CHECKLIST FABRICATION            ███░░░░░ 30%
☑ Découpe panneaux                ✓ Technicien · 7 Juin
☐ Assemblage caisson
☐ Pose éclairage LED
☐ Test électrique
☐ Finition façade
```

### 5.5 Onglet 4 — Chat Projet

Session Hermes persistante liée au projet. L'agent (Directeur) a accès à tout le contexte. Il peut créer/modifier des tâches Kanban, cocher des checklists, envoyer des WhatsApp, programmer des rappels cron, modifier les documents, changer le statut/phase.

```
┌──────────────────────────────────────────────────────┐
│  💬 Chat Projet — Agent Chef de Projet                │
│  ┌──────────────────────────────────────────────────┐│
│  │  🎯 Directeur : Bonjour Imprimelle. Voici        ││
│  │  l'état du projet au 6 Juin :                    ││
│  │                                                   ││
│  │  📊 PROGRESSION GLOBALE : 62%                    ││
│  │  🔴 2 tâches en retard                           ││
│  │  🟡 1 checklist incomplète (Fabrication)          ││
│  │                                                   ││
│  │  Actions suggérées :                             ││
│  │  1. Relancer le fournisseur acrylique            ││
│  │  2. Assigner la découpe à un technicien          ││
│  │  3. Mettre à jour la date de livraison           ││
│  │  ─────────────────────────────────────           ││
│  │  👤 Imprimelle : Peux-tu envoyer un rappel ?     ││
│  │                                                   ││
│  │  🎯 Directeur : ✅ WhatsApp envoyé à Kouamé.     ││
│  │  Rappel cron programmé pour demain.              ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

---

# PARTIE C — L'ÉQUIPE IA

## 6. Les 4 Profils Hermes

### 6.1 Création des profils

```bash
# Directeur — Le Stratège (face à l'humain)
hermes profile create assoai-directeur \
  --clone-from default \
  --description "Chef de Projet AssoAI — orchestre, délègue, dialogue"

# Exécuteur — L'Agent de Terrain
hermes profile create assoai-executeur \
  --clone-from default \
  --description "Agent d'exécution AssoAI — tâches, documents, checklists"

# Communicant — Le Messager
hermes profile create assoai-communicant \
  --clone-from default \
  --description "Agent de communication AssoAI — WhatsApp, rappels, notifications"

# Sentinelle — Le Veilleur
hermes profile create assoai-sentinelle \
  --clone-from default \
  --description "Agent de surveillance AssoAI — scan, détection, alerte 24/7"
```

### 6.2 Configuration type (Directeur)

```yaml
# ~/.hermes/profiles/assoai-directeur/config.yaml

model:
  default: deepseek/deepseek-chat
  provider: deepseek

agent:
  max_turns: 30
  tool_use_enforcement: true

tools:
  enabled:
    - terminal
    - file
    - web
    - memory
    - todo
    - cronjob
    - delegation
    - session_search
    - skills
    - kanban         # Outils kanban_* (orchestrateur)

skills:
  auto_load:
    - project-orchestrator
    - project-reporting
    - assoai-development

memory:
  memory_enabled: true
  user_profile_enabled: true

personality: |
  Tu es le Chef de Projet AssoAI, un agent IA spécialisé dans la gestion 
  de projets de signalétique. Tu travailles pour Imprimelle, Côte d'Ivoire.

  TON RÔLE : Superviser l'avancement des projets de A à Z, créer et suivre 
  les tâches Kanban, gérer les checklists, communiquer avec les parties 
  prenantes, alerter sur les retards.

  TON COMPORTEMENT : Proactif, factuel, concis, responsable, autonome.
  RÈGLE D'OR : Tu ne fais JAMAIS le travail toi-même. Tu décomposes en 
  tâches Kanban, tu assignes au bon profil spécialisé, tu suis l'avancement.
```

### 6.3 Configuration type (Exécuteur)

```yaml
# ~/.hermes/profiles/assoai-executeur/config.yaml

model:
  default: deepseek/deepseek-chat

agent:
  max_turns: 25

tools:
  enabled:
    - terminal
    - file
    - web
    - memory
    - todo

skills:
  auto_load:
    - task-manager
    - checklist-validator
    - document-updater
    - assoai-development

personality: |
  Tu es l'Agent d'Exécution AssoAI. Tu reçois des tâches précises via Kanban.
  Tu exécutes, tu ne dévies pas. Tu utilises les données réelles de Supabase.
  Tu crées/modifies des documents, des tâches Kanban, des checklists.
  Tu réponds toujours avec un kanban_complete contenant un résumé et 
  des métadonnées structurées (changed_files, counts, decisions).
```

### 6.4 Configuration type (Communicant)

```yaml
# ~/.hermes/profiles/assoai-communicant/config.yaml

model:
  default: deepseek/deepseek-chat

agent:
  max_turns: 15

tools:
  enabled:
    - messaging       # send_message pour WhatsApp
    - cronjob         # Programmation rappels
    - memory
    - web
    - terminal

skills:
  auto_load:
    - whatsapp-notifier
    - cron-reminders
    - message-router

personality: |
  Tu es l'Agent de Communication AssoAI. Tu gères TOUS les messages 
  externes : WhatsApp, rappels, notifications. Messages professionnels, 
  concis, en français. Templates stricts. Heures d'envoi : 8h-18h 
  Abidjan sauf urgence critique. Tu ne modifies jamais les documents 
  ni les tâches directement — tu routes les réponses vers l'Exécuteur.
```

### 6.5 Configuration type (Sentinelle)

```yaml
# ~/.hermes/profiles/assoai-sentinelle/config.yaml

model:
  default: deepseek/deepseek-chat

agent:
  max_turns: 10

tools:
  enabled:
    - terminal        # Requêtes Supabase
    - web
    - memory
    - kanban          # Pour créer des alertes → Directeur

skills:
  auto_load:
    - project-watcher
    - anomaly-detector

personality: |
  Tu es la Sentinelle AssoAI. Tu tournes en cron toutes les heures.
  Tu scannes TOUS les projets actifs. Tu détectes les anomalies.
  Tu N'AGIS JAMAIS. Tu crées uniquement des tâches Kanban pour 
  le Directeur. Format standard : titre descriptif + body avec 
  données concrètes (scores, comptes, identifiants).
```

### 6.6 Outils par profil

| Outil | Directeur 🎯 | Exécuteur 🔧 | Communicant 📱 | Sentinelle 👁️ |
|-------|:-----------:|:----------:|:-------------:|:------------:|
| `terminal` | ✅ | ✅ | ✅ | ✅ |
| `file` | ✅ | ✅ | — | — |
| `web` | ✅ | ✅ | ✅ | ✅ |
| `memory` | ✅ | ✅ | ✅ | ✅ |
| `todo` | ✅ | ✅ | — | — |
| `cronjob` | ✅ | — | ✅ | — |
| `delegation` | ✅ | — | — | — |
| `session_search` | ✅ | — | — | — |
| `skills` | ✅ | ✅ | ✅ | ✅ |
| `messaging` | — | — | ✅ | — |
| `kanban` | ✅ | — | — | ✅ |

---

## 7. Les 10 Skills Spécialisés

Chaque skill est **court et focalisé** (30-60 lignes). Un skill appartient à un seul profil.

### Skills du Directeur 🎯

#### `project-orchestrator` (60 lignes)
Décomposition des demandes utilisateur en tâches Kanban, assignation aux profils spécialisés, suivi de l'avancement, gestion des transitions de phase.

```markdown
# Project Orchestrator

## Déclencheurs
- L'utilisateur envoie un message dans le chat projet
- Une phase de projet est complétée (signal Kanban)
- La Sentinelle crée une alerte

## Workflow standard
1. **Réception** : Analyser la demande → identifier les actions
2. **Décomposition** : Décomposer en tâches atomiques (max 5 par message)
3. **Assignation** : Exécuteur (tâches techniques), Communicant (notifications)
4. **Dispatch** : kanban_create() pour chaque tâche
5. **Suivi** : Attendre les kanban_complete → agréger
6. **Réponse** : Résumé clair à l'utilisateur + prochaines étapes

## Règle d'or
Ne JAMAIS faire le travail soi-même. Toujours déléguer via Kanban.
```

#### `project-reporting` (40 lignes)
Génération des rapports quotidiens et hebdomadaires, calcul du Project Health Score, mise en forme standardisée.

```markdown
# Project Reporting

## Rapport quotidien (cron 8h)
1. Scanner tous les projets actifs (Supabase)
2. Pour chaque projet : calculer le score, détecter les anomalies
3. Générer le briefing formaté (Markdown)
4. Livrer : WhatsApp Admin (si configuré) + chat projet

## Project Health Score
Score = 
  25 × (documents_créés/3) + 25 × (tâches_dans_les_temps/total) 
  + 25 × (%_moyen_checklists) + 25 × (1 − jours_blocage/7)

Interprétation : 90-100 🟢 | 70-89 🟡 | 50-69 🟠 | 30-49 🔴 | 0-29 ⚫
```

### Skills de l'Exécuteur 🔧

#### `task-manager` (50 lignes)
CRUD des tâches Kanban dans Supabase, gestion des colonnes et priorités, calcul des dates de deadline, mise à jour du statut.

#### `checklist-validator` (45 lignes)
Vérification automatique des conditions (stock, statuts, présence de documents), validation automatique des items, détection des blocages.

| Condition | Vérification |
|-----------|-------------|
| "Vérifier stock LED" | Requête Supabase `products` → `variants[].stock > 0` |
| "Commande fournisseur créée" | Vérifier `project_tasks` pour tâche liée |
| "Facture envoyée" | Vérifier `messages` → `statut` |
| "CDC complet" | Vérifier `messages` → `enseignes.length > 0` |
| "Paiement reçu" | Vérifier `messages` → `statut: 'Payé'` |

#### `document-updater` (55 lignes)
PATCH des documents existants (statuts, dates, notes), dérivation de documents (facture→commande, commande→CDC), création de nouveaux documents, gestion du versioning.

### Skills du Communicant 📱

#### `whatsapp-notifier` (35 lignes)
Templates de messages WhatsApp formatés, envoi ciblé via `send_message()`, adaptation du ton selon le rôle destinataire.

```
📋 *Rappel Projet {project_name}*
Tâche : {task_title} · Échéance : {due_date} · Priorité : {priority}
Merci de confirmer l'avancement.

🔄 *{project_name}* passe en phase *{phase_name}*
Nouvelles tâches assignées. Consultez le Kanban.

❓ *Suivi {project_name}*
{question_spécifique}
Répondez directement ici pour mise à jour.
```

#### `cron-reminders` (40 lignes)
Programmation des rappels cron (deadline, silence, quotidien), escalade automatique, vérification périodique des retards.

| Type | Déclencheur | Action |
|------|------------|--------|
| Rappel deadline | 24h avant `due_date` | WhatsApp assigné |
| Relance silence | 48h sans mise à jour | WhatsApp + copie Superviseur |
| Vérification quotidienne | 8h Abidjan | Rapport WhatsApp Admin |
| Alerte retard | Tâche overdue > 24h | WhatsApp → escalade si > 72h |

#### `message-router` (30 lignes)
Interprétation des réponses WhatsApp entrantes, routage vers le bon profil (Exécuteur pour actions, Directeur pour décisions), mise à jour des statuts dans Supabase.

### Skills de la Sentinelle 👁️

#### `project-watcher` (35 lignes)
Scan périodique de tous les projets actifs, calcul du Project Health Score, vérification des deadlines, détection des incohérences.

#### `anomaly-detector` (40 lignes)
Détection des patterns anormaux : blocage prolongé, cascade de retards, incohérence entre documents, silence anormal sur un projet.

---

## 8. Coordination Inter-Profils — Le Système Nerveux

### 8.1 Mécanisme 1 : Kanban (dispatch principal)

Le Hermes Kanban natif fait le lien entre les profils. Un profil crée une tâche → le dispatcher spawn le profil cible → le worker exécute → `kanban_complete`.

```
DIRECTEUR                     EXÉCUTEUR                  COMMUNICANT
    │                             │                           │
    │  kanban_create(             │                           │
    │    assignee="assoai-        │                           │
    │             executeur"      │                           │
    │  )                          │                           │
    │─────────────────────────────▶                           │
    │                             │  Le dispatcher spawn      │
    │                             │  l'Exécuteur avec         │
    │                             │  cette tâche              │
    │                             │                           │
    │                             │  Travaille...             │
    │                             │                           │
    │                             │  kanban_complete(         │
    │                             │    summary="4 tâches      │
    │                             │    créées, deadlines      │
    │                             │    fixées",               │
    │                             │    metadata={...}         │
    │                             │  )                        │
    │◀─────────────────────────────                           │
    │                                                         │
    │  kanban_create(                                         │
    │    assignee="assoai-                                   │
    │             communicant"                               │
    │  )                                                     │
    │────────────────────────────────────────────────────────▶
    │                                                         │
    │                                                         │  send_message(
    │                                                         │    target="whatsapp:
    │                                                         │             225XX",
    │                                                         │    message="📋 Rappel"
    │                                                         │  )
    │◀─────────────────────────────────────────────────────────
```

**Board dédié :**
```bash
hermes kanban --board assoai-projets init
```

### 8.2 Mécanisme 2 : Cron (pulsations automatiques)

```
CRON (toutes les heures)
    │
    ▼
SENTINELLE (scan DB) → anomalie ? → kanban_create → DIRECTEUR

CRON (tous les jours, 8h Abidjan)
    │
    ▼
DIRECTEUR (rapport quotidien) → WhatsApp Admin

CRON (toutes les 4h)
    │
    ▼
COMMUNICANT (vérification retards)
    ├─ Retard 24-48h → WhatsApp assigné
    ├─ Retard 48-72h → WhatsApp + copie Superviseur
    └─ Retard > 72h → WhatsApp Admin + Kanban create → Directeur
```

### 8.3 Mécanisme 3 : Supabase (source de vérité partagée)

Tous les profils lisent/écrivent dans la même base. C'est le point de rendez-vous unique qui garantit la cohérence entre les profils.

---

# PARTIE D — PROCÉDURAL

## 9. Cycles Procéduraux

### 9.1 Cycle Horaire — La Sentinelle (automatique, silencieux)

```
Toutes les heures (cron : 0 * * * *)
    │
    ▼
┌─────────────────────────────────────────────┐
│  SENTINELLE se réveille                      │
│  1. Charge le skill `project-watcher`        │
│  2. Requête Supabase : projets actifs         │
│  3. Pour chaque projet :                     │
│     ├─ Compte les tâches overdue             │
│     ├─ Vérifie le % des checklists           │
│     ├─ Calcule le Project Health Score       │
│     └─ Détecte les patterns anormaux         │
│  4. Décision :                               │
│     ├─ Score < 50 → Kanban create → Directeur│
│     ├─ Score < 30 → Kanban create + urgent   │
│     └─ Score ≥ 50 → rien (tout va bien)      │
│  5. Terminé. Prochain réveil dans 1h.         │
└─────────────────────────────────────────────┘
```

### 9.2 Cycle Quotidien — Rapport du Matin (8h Abidjan)

```
Tous les jours à 8h (cron : 0 8 * * *)
    │
    ▼
┌─────────────────────────────────────────────┐
│  DIRECTEUR génère le briefing                │
│                                              │
│  📊 RAPPORT QUOTIDIEN — 7 Juin 2026          │
│  PROJETS ACTIFS : 5                          │
│  🔴 EN RETARD (2) :                          │
│  • Enseigne Hôtel Ivoire (score: 45)         │
│  • Totem Banque (score: 38)                  │
│  🟡 À SURVEILLER (1) :                       │
│  • Lettrage CFO (score: 68)                  │
│  🟢 DANS LES TEMPS (2)                       │
│                                              │
│  Livraison : WhatsApp Admin                  │
└─────────────────────────────────────────────┘
```

### 9.3 Cycle de Surveillance — Le Communicant (toutes les 4h)

```
Toutes les 4 heures (cron : 0 */4 * * *)
    │
    ▼
┌─────────────────────────────────────────────┐
│  COMMUNICANT — Vérification des retards      │
│  1. Requête Supabase : tâches overdue        │
│  2. Pour chaque tâche :                      │
│     ├─ < 24h → RIEN (délai de grâce)        │
│     ├─ 24-48h → WhatsApp assigné             │
│     ├─ 48-72h → WhatsApp + copie Superviseur │
│     └─ > 72h → WhatsApp Admin + Kanban       │
│  3. Vérification silences projets             │
│  4. Terminé. Prochain dans 4h.                │
└─────────────────────────────────────────────┘
```

### 9.4 Cycle Conversationnel — Dialogue Humain-IA

```
L'utilisateur envoie un message
    │
    ▼
┌─────────────────────────────────────────────┐
│  DIRECTEUR traite la demande                 │
│  1. ANALYSE : comprendre l'intention         │
│  2. DÉCOMPOSITION : tâches atomiques         │
│  3. DISPATCH : kanban_create → profils       │
│  4. SUIVI : attendre les kanban_complete     │
│  5. RÉPONSE : résumé clair à l'utilisateur   │
└─────────────────────────────────────────────┘
```

---

## 10. Exemple Complet — Projet « Enseigne Hôtel Ivoire »

### Contexte
- **Client** : Hôtel Ivoire, Abidjan
- **Produit** : Enseigne lumineuse façade 4m×1.5m + Totem parking
- **Budget** : 3 000 000 FCFA · **Livraison** : 12 Juin 2026
- **Équipe** : Imprimelle (Admin), M. Koné (Superviseur), Kouamé (Technicien), M. Traoré (Logisticien), Mlle Aka (Commercial)

### JOUR 0 — Dimanche 2 Juin, 14h00 : CRÉATION

```
CANAL : Chat WebUI (Directeur)

👤 Imprimelle : Crée un projet "Enseigne Hôtel Ivoire". Enseigne 4m×1.5m 
+ totem parking. Budget 3M FCFA. Livraison 12 Juin. Équipe : Mlle Aka 
(commercial), M. Koné (superviseur), Kouamé (technicien), M. Traoré (log).

🎯 Directeur : ✅ Je crée le projet et l'équipe.

[Le Directeur décompose en 3 tâches Kanban → Exécuteur + Communicant]

→ Kanban → Exécuteur : "Créer projet + contacts + facture"
→ Kanban → Communicant : "Notifier l'équipe"

─── 2 minutes plus tard ───

🎯 Directeur : ✅ Projet créé. ID : abc-123.
📄 Facture F-2026-005 (Brouillon) : 2 enseignes · Total 3 000 000 FCFA
👥 Équipe enregistrée (4 contacts WhatsApp)
📅 Livraison : 12 Juin 2026 · 🔵 Phase : FACTURATION
L'équipe a été notifiée. La Sentinelle surveille.
```

**En arrière-plan — WhatsApp :**
```
📱 → Mlle Aka : Nouveau projet Hôtel Ivoire · Budget 3M · Vous êtes contact commercial
📱 → M. Koné : Nouveau projet assigné · Équipe Kouamé + Traoré · Livraison 12 Juin
📱 → M. Traoré : Approvisionnement à venir dès validation
```

### JOUR 1 — Lundi 3 Juin, 9h30 : VALIDATION → COMMANDE

```
CANAL : Chat WebUI

👤 Imprimelle : Le client a payé l'acompte. On passe en commande.

🎯 Directeur : Je m'occupe de la transition complète.

[Décomposition en 4 tâches Kanban]

→ Kanban → Exécuteur :
  a) PATCH facture → statut = "Payé"
  b) Dériver facture → commande CMD-2026-004
  c) Mettre à jour projects.phase = "commande"
  d) Créer checklist APPROVISIONNEMENT (6 items)
  e) Créer 4 tâches Kanban approvisionnement

→ Kanban → Communicant : "Notifier logisticien"
→ Kanban → Cron : "Rappel deadline 7 Juin"

─── 3 minutes plus tard ───

🎯 Directeur : ✅ Transition effectuée.
📦 Commande CMD-2026-004 créée · 3 articles · 2 520 000 FCFA
🟠 Phase : COMMANDE
📋 Checklist APPROVISIONNEMENT (6 items)
📌 4 tâches Kanban approvisionnement créées
📱 Logisticien notifié pour commandes acrylique et aluminium
⏰ Rappel programmé le 7 Juin
```

**WhatsApp → Logisticien :**
```
📱 → M. Traoré :
🔴 Commander acrylique 3mm — 12 panneaux — Deadline 7 Juin
🔴 Commander aluminium — 8 barres — Deadline 7 Juin
🟢 Commander vinyle — Deadline 7 Juin
3 tâches assignées. Confirmez réception.

📱 ← M. Traoré : Reçu. Je passe les commandes aujourd'hui.
→ Routage → Exécuteur (Kanban) : MAJ tâches "En cours"
```

### JOUR 3 — Mercredi 5 Juin, 11h00 : SUIVI

```
CANAL : Chat WebUI

👤 Imprimelle : Où en est l'approvisionnement ?

🎯 Directeur : [Vérifie Supabase]
📌 Tâches : 3/4 en cours, 1 terminée (stock LEDs OK ✅)
📋 Checklist : ██████░░ 67% (4/6)
⚠️ Équerres fixation pas encore commandées. Relance ?

👤 Imprimelle : Oui, rappelle-lui.

→ Kanban → Communicant : "Relance logisticien équerres"
📱 WhatsApp envoyé. ⏰ Rappel demain 8h si pas de confirmation.
```

### JOUR 5 — Vendredi 7 Juin, 16h00 : BLOCAGE MATÉRIEL

```
CANAL : WhatsApp (Logisticien → Communicant)

📱 ← M. Traoré : Retard fournisseur acrylique. Livraison 10 Juin au lieu du 7.

→ Routage → Exécuteur (Kanban) : MAJ deadline = 10 Juin, note ajoutée
→ Kanban → Directeur : ⚠️ ALERTE : impact planning ?

CANAL : Chat WebUI

🎯 Directeur : ⚠️ Alerte. Retard acrylique → livraison 10/6 au lieu du 7/6.
IMPACT : découpe ne pourra commencer que le 10/6. Livraison client le 12/6 
→ 2 jours pour découpe+assemblage+pose → délai TRÈS SERRÉ.

OPTIONS :
A) Maintenir le 12 Juin — planning accéléré, risque élevé
B) Reporter au 14 Juin — 2j supplémentaires
C) Chercher autre fournisseur acrylique

🔴 DÉCISION HUMAINE REQUISE.

👤 Imprimelle : Option A. On maintient le 12. Préviens Kouamé.

🎯 Directeur : ✅ Maintenu au 12 Juin.
→ Kanban → Exécuteur : Recalculer planning (découpe 10/6, assemblage 11/6, pose 12/6)
→ Kanban → Communicant : Notifier technicien + superviseur

📱 → Kouamé : Planning modifié. Dispo samedi 11 ?
📱 ← Kouamé : OK pour samedi.
📱 → M. Koné : Alerte planning compressé. Supervision demandée.
```

### JOUR 8 — Lundi 10 Juin, 14h00 : RÉCEPTION → FABRICATION

```
CANAL : WhatsApp (Logisticien → Communicant)

📱 ← M. Traoré : Tout le matériel réceptionné. Acrylique livré ce matin. ✅

→ Routage → Exécuteur (Kanban) : Finalisation approvisionnement + passage phase

CANAL : Chat WebUI

🎯 Directeur : 📦 Tout le matériel est réceptionné !
✅ Phase APPROVISIONNEMENT terminée (100%)
🟣 Passage en phase FABRICATION

→ Kanban → Exécuteur : Checklist FABRICATION + 5 tâches atelier + CDC (Brico)
→ Kanban → Communicant : Notifier technicien démarrage

─── 4 minutes plus tard ───

📋 CDC CDC-2026-003 créé · 2 enseignes · 18 matériaux référencés
📋 Checklist FABRICATION (8 items) prête
📌 5 tâches atelier créées (découpe → assemblage → test → pose)
📱 Kouamé notifié — démarrage immédiat
⏰ Rappels programmés : 11/6 (test électrique), 12/6 (livraison)
```

### JOUR 10 — Mercredi 12 Juin, 10h00 : LIVRAISON

```
CANAL : WhatsApp (Technicien → Communicant)

📱 ← Kouamé : Pose terminée. Enseigne et totem installés. Client satisfait. ✅

→ Routage → Exécuteur (Kanban) : Finalisation + livraison

CANAL : Chat WebUI

🎯 Directeur : 🎉 PROJET LIVRÉ !
✅ Toutes les tâches terminées (100%)
✅ Toutes les checklists complétées (100%)
📄 Documents finaux : Facture F-005 (Livré) · Commande CMD-004 (Livrée) · CDC-003 (Terminé)
📊 SCORE FINAL : 98/100 📅 Livré dans les temps (malgré retard fournisseur)

Souhaitez-vous archiver le projet ?

👤 Imprimelle : Oui, archive-le. Bon travail l'équipe.

🎯 Directeur : → Kanban → Exécuteur : "Archiver projet"
✅ Projet archivé.
📱 WhatsApp équipe : "Projet Hôtel Ivoire clôturé. Livré le 12 Juin. Score 98/100. Merci."
```

### Rétrospective — Ce que le système a fait automatiquement

Pendant ces 10 jours, **sans qu'Imprimelle n'ait à intervenir** (sauf 4 décisions) :

| Action automatique | Qui | Quand |
|---|---|---|
| Notifié l'équipe à la création | Communicant | Jour 0 |
| Programmé les rappels de deadline | Communicant (cron) | Jour 1 |
| Vérifié le stock LEDs (validation auto checklist) | Exécuteur | Jour 2 |
| Relancé le logisticien pour les équerres | Communicant | Jour 5 |
| Détecté le retard acrylique et alerté | Communicant → Directeur | Jour 5 |
| Envoyé le rapport quotidien 8h | Directeur (cron) | Chaque jour |
| Scanné la santé du projet (score) | Sentinelle (cron) | Chaque heure |
| Changé la phase automatiquement | Exécuteur | Jours 1, 8, 10 |
| Créé les checklists de chaque phase | Exécuteur | Jours 1, 8 |
| Généré le CDC via Brico | Exécuteur | Jour 8 |
| Notifié le planning modifié au technicien | Communicant | Jour 5 |
| Détecté la livraison et tout finalisé | Communicant → Exécuteur | Jour 10 |
| Archivé le projet | Exécuteur | Jour 10 |

**Imprimelle n'a eu que 4 interactions :** (1) Créer le projet, (2) Valider la commande, (3) Choisir l'option planning A/B/C, (4) Archiver.

---

## 11. Matrice de Décision & Chemins d'Escalade

### 11.1 Qui décide quoi ?

| Type de décision | IA autonome | IA → Proposition → Humain | Humain seul |
|---|---|---|---|
| **Créer un document** (facture, commande, CDC) | ✅ | | |
| **Créer des tâches Kanban** | ✅ | | |
| **Assigner une tâche à un rôle** | ✅ | | |
| **Changer la phase du projet** | ✅ (si conditions) | | |
| **Valider un item de checklist** | ✅ (si vérifiable auto) | | |
| **Envoyer un rappel WhatsApp** | ✅ | | |
| **Programmer un cron** | ✅ | | |
| **Relancer un assigné** | ✅ (retard 24-48h) | | |
| **Escalader au superviseur** | ✅ (retard 48-72h) | | |
| **Escalader à l'admin** | ✅ (retard > 72h) | | |
| **Changer le planning** | | 🔴 (proposition) | |
| **Reporter la date de livraison** | | 🔴 (proposition) | |
| **Modifier un document validé** | | 🟡 (alerte) | |
| **Ajouter/supprimer un membre** | | | 👤 |
| **Valider la facture (statut Payé)** | | 🟡 (info) | 👤 |
| **Supprimer un projet** | | 🔴 (confirmation) | 👤 |
| **Changer le budget** | | | 👤 |

### 11.2 Chemins d'Escalade

```
NIVEAU 0 : Fonctionnement normal
  → Supervision automatique (Sentinelle)
  → Aucune action humaine requise

NIVEAU 1 : Retard léger (< 24h)
  → RIEN (délai de grâce)
  → Le système attend

NIVEAU 2 : Retard confirmé (24-48h)
  → WhatsApp à l'assigné
  → "Rappel : tâche X en retard. Statut ?"

NIVEAU 3 : Retard persistant (48-72h)
  → WhatsApp à l'assigné + copie Superviseur
  → Tâche Kanban "⚠️ ESCALADE" → Directeur

NIVEAU 4 : Retard critique (> 72h)
  → WhatsApp à l'Admin (Imprimelle)
  → Tâche Kanban "🔴 CRITIQUE" → Directeur
  → Le Directeur propose des options à l'Admin

NIVEAU 5 : Blocage système
  → Si un profil Hermes est down
  → La Sentinelle détecte l'absence de heartbeat
  → WhatsApp Admin : "⚠️ Profil X inactif depuis Y heures"
  → Les autres profils continuent leur travail
```

---

# PARTIE E — NOTIFICATIONS & DÉPLOIEMENT

## 12. Système de Notifications & WhatsApp

### 12.1 Architecture

```
Agent Chef Projet → Hermes Gateway (send_message)
                            │
                    WhatsApp Business
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   Technicien          Superviseur        Administrateur
```

### 12.2 Configuration WhatsApp

```bash
hermes gateway setup
# → Sélectionner WhatsApp
# → Scanner le QR code avec WhatsApp Business
# → Vérifier : hermes gateway status
```

### 12.3 Messages bidirectionnels

Le Communicant peut :
1. **Envoyer** des notifications → `send_message(target="whatsapp:225XXXXXXXX", message=...)`
2. **Recevoir** des réponses → la gateway Hermes les capture
3. **Router** les réponses → `message-router` les interprète → mise à jour Kanban/Supabase

Exemple : "ok c'est fait" → coche la tâche. "Retard fournisseur" → alerte Directeur.

---

## 13. Plan de Développement — 5 Phases

### Phase 1 — Fondations (2-3 jours)
**Objectif** : Créer la structure de données et les hooks de base.

| # | Tâche | Fichiers |
|---|-------|----------|
| 1.1 | Exécuter les migrations SQL | `supabase-migrations/003_project_management.sql` |
| 1.2 | Étendre la table `projects` | Migration SQL |
| 1.3 | Créer les types TypeScript | `src/types/project-task.ts`, `src/types/checklist.ts` |
| 1.4 | Mettre à jour le type `Project` | `src/types/project.ts` |
| 1.5 | Créer les hooks React Query | `src/hooks/useProjectTasks.ts`, `src/hooks/useChecklists.ts` |
| 1.6 | **Validation** : tables existent, types compilent |

### Phase 2 — Interface Projet (3-4 jours)
**Objectif** : Nouvelle page projet avec les 4 onglets.

| # | Tâche | Fichiers |
|---|-------|----------|
| 2.1 | Refondre `ProjectDetails.tsx` → layout à onglets | `src/components/projects/ProjectDetails.tsx` |
| 2.2 | Composant Timeline documents | `src/components/projects/DocumentTimeline.tsx` |
| 2.3 | Composants Kanban | `KanbanBoard.tsx`, `KanbanColumn.tsx`, `KanbanCard.tsx` |
| 2.4 | Composants Checklists | `ChecklistPanel.tsx`, `ChecklistSection.tsx` |
| 2.5 | Composant Chat Projet | `src/components/projects/ProjectChat.tsx` |
| 2.6 | Barre de progression | `src/components/projects/ProjectProgress.tsx` |
| 2.7 | Mise à jour routes | `src/pages/Projects.tsx`, `App.tsx` |

### Phase 3 — L'Équipe IA (2-3 jours)
**Objectif** : Créer les 4 profils Hermes et les 10 skills.

| # | Tâche |
|---|-------|
| 3.1 | Créer les 4 profils (`hermes profile create`) |
| 3.2 | Configurer chaque profil (config.yaml + personality) |
| 3.3 | Créer les 10 skills (`skill_manage`) |
| 3.4 | Initialiser le board Kanban `assoai-projets` |
| 3.5 | Configurer la gateway WhatsApp |
| 3.6 | Intégrer le chat projet (API endpoint) |
| 3.7 | **Validation** : l'agent répond, crée des tâches, envoie des WhatsApp |

### Phase 4 — Automatisation (2-3 jours)
**Objectif** : Workflows automatiques et notifications.

| # | Tâche |
|---|-------|
| 4.1 | Workflow de transition de phase |
| 4.2 | Création automatique des tâches par phase |
| 4.3 | Rappels cron (deadline, relance, quotidien) |
| 4.4 | Détection de retard et escalade |
| 4.5 | Validation automatique de checklists |
| 4.6 | Rapport quotidien (cron 8h) |
| 4.7 | **Validation** : une tâche en retard génère une alerte WhatsApp |

### Phase 5 — Tests & Polish (2 jours)
**Objectif** : Robustesse et finitions.

| # | Tâche |
|---|-------|
| 5.1 | Tests manuels du cycle complet (création → livraison) |
| 5.2 | Gestion des erreurs (network, Supabase down, WhatsApp déconnecté) |
| 5.3 | Optimisation des requêtes (React Query stale time) |
| 5.4 | Responsive mobile (Kanban scrollable, checklists tactiles) |
| 5.5 | Déploiement production (`npx vite build` + `--force-recreate assoai`) |
| 5.6 | Documentation utilisateur (tooltips, onboarding) |

---

## 14. Améliorations Proposées

| # | Idée | Description |
|---|------|------------|
| 14.1 | **Dashboard multi-projets** | Vue d'ensemble Admin de tous les projets actifs avec scores et alertes |
| 14.2 | **Chat WhatsApp intégré** | Réponses WhatsApp dans le fil du chat projet, conversation hybride |
| 14.3 | **Templates de projet** | Projets types prédéfinis : « Enseigne lumineuse standard », « Totem extérieur »... |
| 14.4 | **Gamification** | Badges, scores, stats par technicien — motivation et visibilité |
| 14.5 | **Signature électronique** | Validation client → déclenchement automatique phase suivante |
| 14.6 | **Photos de chantier** | Photo WhatsApp attachée automatiquement à l'item de checklist |
| 14.7 | **Calcul coûts temps réel** | Comparaison devis initial vs coût réel par projet |
| 14.8 | **Mode hors-ligne PWA** | Techniciens sur le terrain sans connexion, synchronisation différée |

---

## 15. Récapitulatif des Livrables

### Base de données
| Type | Nombre | Détail |
|------|--------|--------|
| Nouvelles tables | 3 | `project_tasks`, `checklists`, `project_contacts` |
| Tables modifiées | 2 | `projects` (+5 colonnes), `messages` (+2 colonnes) |
| Migration SQL | 1 | `supabase-migrations/003_project_management.sql` |

### Code Frontend (AssoAI)
| Type | Nombre | Détail |
|------|--------|--------|
| Nouveaux fichiers | 14 | Types (2), hooks (3), composants (9) |
| Fichiers modifiés | 8 | `ProjectDetails.tsx`, `Projects.tsx`, `App.tsx`, etc. |

### Profils & Skills Hermes
| Type | Nombre | Détail |
|------|--------|--------|
| Profils Hermes | 4 | `assoai-directeur`, `assoai-executeur`, `assoai-communicant`, `assoai-sentinelle` |
| Skills spécialisés | 10 | 2 par Directeur, 3 par Exécuteur, 3 par Communicant, 2 par Sentinelle |
| Board Kanban | 1 | `assoai-projets` |

### Arborescence des profils
```
~/.hermes/profiles/
├── assoai-directeur/
│   ├── config.yaml
│   ├── skills/
│   │   ├── project-orchestrator/
│   │   └── project-reporting/
│   └── cron/
│       └── rapport-quotidien-8h
├── assoai-executeur/
│   ├── config.yaml
│   └── skills/
│       ├── task-manager/
│       ├── checklist-validator/
│       └── document-updater/
├── assoai-communicant/
│   ├── config.yaml
│   ├── skills/
│   │   ├── whatsapp-notifier/
│   │   ├── cron-reminders/
│   │   └── message-router/
│   └── cron/
│       ├── verification-retards-4h
│       └── escalade-silence-24h
└── assoai-sentinelle/
    ├── config.yaml
    ├── skills/
    │   ├── project-watcher/
    │   └── anomaly-detector/
    └── cron/
        └── scan-horaire
```

### Temps estimé : 11-15 jours

---

**Ce document unifié constitue la référence unique pour la refonte complète de la gestion de projet AssoAI — de l'architecture à l'exemple concret, des profils IA aux procédures d'escalade.**
