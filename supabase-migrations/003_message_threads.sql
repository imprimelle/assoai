-- Migration: message_threads — fils de discussion persistants pour les Builders
-- Permet de sauvegarder les conversations Brico/Wari/PM côté serveur Supabase.
-- Utilisé par le useChatPersistence hook (cache localStorage + source de vérité Supabase).

CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Type de document: 'cdc', 'facture', 'devis', 'commande'
  document_type TEXT NOT NULL,
  -- FK vers messages(id) — NULL pour les documents non encore sauvegardés
  document_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  -- Identité thread pour les documents non sauvegardés (draft UUID ou chatIdentity)
  thread_identity TEXT NOT NULL,
  -- Rôle: 'user' ou 'ai'
  role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  -- Agent optionnel: 'brico', 'wari', 'pm'
  agent TEXT,
  -- Contenu du message (markdown)
  text TEXT NOT NULL DEFAULT '',
  -- Horodatage
  timestamp TIMESTAMPTZ DEFAULT now(),
  -- Session utilisateur
  session_id TEXT
);

-- Index pour charger les messages d'un thread rapidement
CREATE INDEX IF NOT EXISTS idx_message_threads_doc ON message_threads(document_message_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_message_threads_identity ON message_threads(thread_identity, timestamp);
CREATE INDEX IF NOT EXISTS idx_message_threads_type ON message_threads(document_type, thread_identity);

-- RLS: les utilisateurs authentifiés peuvent lire/écrire leurs threads
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: tout utilisateur authentifié peut lire
CREATE POLICY "Users can read message_threads"
  ON message_threads FOR SELECT
  USING (true);

-- Policy INSERT: tout utilisateur authentifié peut insérer
CREATE POLICY "Users can insert message_threads"
  ON message_threads FOR INSERT
  WITH CHECK (true);

-- Policy UPDATE: tout utilisateur authentifié peut mettre à jour
CREATE POLICY "Users can update message_threads"
  ON message_threads FOR UPDATE
  USING (true);
