-- ============================================================
-- Migration 003 : Gestion de Projet Dynamique AssoAI
-- Tables: project_tasks, checklists, project_contacts
-- Modifications: projects, messages
-- ============================================================
-- Exécuter dans l'ÉDITEUR SQL Supabase :
-- https://supabase.com/dashboard/project/yqioyfuxviiximembver/sql/new
-- ============================================================

-- ============================================================
-- 1. EXTENSION DE LA TABLE projects
-- ============================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS status text DEFAULT 'actif';
COMMENT ON COLUMN projects.status IS 'Statut global: actif, en_attente, termine, archive';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase text DEFAULT 'facturation';
COMMENT ON COLUMN projects.phase IS 'Phase actuelle: facturation, commande, fabrication, livraison, termine';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS date_livraison timestamptz;
COMMENT ON COLUMN projects.date_livraison IS 'Date cible de livraison au client';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS workflow_config jsonb DEFAULT '{}';
COMMENT ON COLUMN projects.workflow_config IS 'Configuration des phases, checklists auto, transitions';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS chat_session_id text;
COMMENT ON COLUMN projects.chat_session_id IS 'Session Hermes persistante pour le chat projet';

-- ============================================================
-- 2. EXTENSION DE LA TABLE messages
-- ============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
COMMENT ON COLUMN messages.project_id IS 'Lien vers le projet (chat projet ou document lié)';

ALTER TABLE messages ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'chat';
COMMENT ON COLUMN messages.session_type IS 'Type de session: chat (général), project (chat dédié projet)';

-- ============================================================
-- 3. TABLE project_tasks — KANBAN
-- ============================================================

CREATE TABLE IF NOT EXISTS project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Contenu
  title text NOT NULL,
  description text,

  -- Kanban
  column text NOT NULL DEFAULT 'a_faire',
  -- Valeurs: 'a_faire', 'en_cours', 'en_revision', 'termine'
  position integer DEFAULT 0,

  -- Assignation
  assignee text,
  -- Rôle: 'technicien', 'superviseur', 'logistique', 'commercial', 'admin'
  assignee_contact text,
  -- Téléphone WhatsApp du responsable

  -- Dates
  due_date timestamptz,
  completed_at timestamptz,

  -- Métadonnées
  labels text[] DEFAULT '{}',
  priority text DEFAULT 'medium',
  -- Valeurs: 'low', 'medium', 'high', 'critical'
  created_by text DEFAULT 'user',
  -- 'user' ou 'agent'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_column ON project_tasks(project_id, column);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due ON project_tasks(due_date) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee ON project_tasks(assignee);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_project_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_tasks_updated_at ON project_tasks;
CREATE TRIGGER trg_project_tasks_updated_at
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION update_project_tasks_updated_at();

-- RLS
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_tasks_all ON project_tasks FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. TABLE checklists — SUIVI D'ÉTAPES
-- ============================================================

CREATE TABLE IF NOT EXISTS checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES project_tasks(id) ON DELETE SET NULL,

  -- Contenu
  title text NOT NULL,
  section text,
  -- 'facturation', 'approvisionnement', 'fabrication', 'qualite', 'livraison'
  phase text,
  -- Aligné avec projects.phase

  -- Items (JSONB pour flexibilité)
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

  -- Progression calculée
  total_items integer DEFAULT 0,
  completed_items integer DEFAULT 0,
  percentage integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checklists_project ON checklists(project_id);
CREATE INDEX IF NOT EXISTS idx_checklists_task ON checklists(task_id);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  -- Recalcul automatique de la progression
  IF NEW.items IS NOT NULL AND jsonb_array_length(NEW.items) > 0 THEN
    NEW.total_items := jsonb_array_length(NEW.items);
    NEW.completed_items := (
      SELECT count(*) FROM jsonb_array_elements(NEW.items) AS item
      WHERE (item->>'done')::boolean = true
    );
    NEW.percentage := CASE
      WHEN NEW.total_items > 0
      THEN (NEW.completed_items * 100 / NEW.total_items)
      ELSE 0
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_checklists_updated_at ON checklists;
CREATE TRIGGER trg_checklists_updated_at
  BEFORE INSERT OR UPDATE ON checklists
  FOR EACH ROW EXECUTE FUNCTION update_checklists_updated_at();

-- RLS
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY checklists_all ON checklists FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. TABLE project_contacts — CONTACTS WHATSAPP
-- ============================================================

CREATE TABLE IF NOT EXISTS project_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  name text NOT NULL,
  role text NOT NULL,
  -- 'technicien', 'superviseur', 'logistique', 'commercial', 'admin'
  phone text,
  -- Format international: 2250102030405

  -- Préférences de notification
  notify_tasks boolean DEFAULT true,
  notify_phase boolean DEFAULT true,
  notify_deadline boolean DEFAULT true,

  created_at timestamptz DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_project_contacts_project ON project_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contacts_role ON project_contacts(role);

-- RLS
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_contacts_all ON project_contacts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. VÉRIFICATION FINALE
-- ============================================================

SELECT
  'projects' AS table_name,
  count(*) AS rows,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'projects') AS columns
FROM projects
UNION ALL
SELECT 'project_tasks', count(*), (SELECT count(*) FROM information_schema.columns WHERE table_name = 'project_tasks') FROM project_tasks
UNION ALL
SELECT 'checklists', count(*), (SELECT count(*) FROM information_schema.columns WHERE table_name = 'checklists') FROM checklists
UNION ALL
SELECT 'project_contacts', count(*), (SELECT count(*) FROM information_schema.columns WHERE table_name = 'project_contacts') FROM project_contacts
UNION ALL
SELECT 'messages', count(*), (SELECT count(*) FROM information_schema.columns WHERE table_name = 'messages') FROM messages;
