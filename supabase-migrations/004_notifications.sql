-- Migration 004: Table app_notifications (in-app)
-- Date: 8 Juin 2026
-- Contexte: Plan de refonte v3.1 — Bloc 3 Notifications In-App
-- Note: renommée app_notifications pour éviter conflit avec l'ancienne table notifications

CREATE TABLE IF NOT EXISTS app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  project_id uuid,
  type text DEFAULT 'info' CHECK (type IN ('alerte', 'rappel', 'info', 'escalade')),
  level text DEFAULT 'info' CHECK (level IN ('critical', 'warning', 'info')),
  title text NOT NULL,
  message text,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user ON app_notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_project ON app_notifications(project_id);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_notifications_user_policy ON app_notifications;
CREATE POLICY app_notifications_user_policy ON app_notifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
