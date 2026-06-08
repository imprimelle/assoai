-- Migration 004: Table notifications (in-app)
-- Date: 8 Juin 2026
-- Remplace le canal WhatsApp par des notifications 100% in-app
-- Contexte: Plan de refonte v3.1 — Bloc 3 Notifications In-App

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  type text DEFAULT 'info' CHECK (type IN ('alerte', 'rappel', 'info', 'escalade')),
  level text DEFAULT 'info' CHECK (level IN ('critical', 'warning', 'info')),
  title text NOT NULL,
  message text,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_project ON notifications(project_id);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Politique : chaque utilisateur voit ses propres notifications
CREATE POLICY notifications_user_policy ON notifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
