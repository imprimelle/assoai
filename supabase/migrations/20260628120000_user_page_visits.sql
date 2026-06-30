CREATE TABLE IF NOT EXISTS user_page_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  page TEXT NOT NULL,
  last_visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, page)
);

CREATE INDEX IF NOT EXISTS idx_user_page_visits_user_id ON user_page_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_page_visits_page ON user_page_visits(page);

ALTER TABLE user_page_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_page_visits_all" ON user_page_visits;
CREATE POLICY "user_page_visits_all" ON user_page_visits FOR ALL USING (true);
