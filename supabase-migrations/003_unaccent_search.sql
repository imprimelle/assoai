-- Migration 003: Activer l'extension unaccent pour la recherche insensible aux accents
-- + index trigram pour des recherches partielles rapides

-- 1. Activer l'extension unaccent
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Créer une fonction de recherche normalisée
CREATE OR REPLACE FUNCTION search_products(search_term text)
RETURNS SETOF products
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM products
  WHERE unaccent(name) ILIKE unaccent('%' || search_term || '%')
     OR unaccent(description) ILIKE unaccent('%' || search_term || '%')
  ORDER BY
    CASE WHEN unaccent(name) ILIKE unaccent(search_term) THEN 0
         WHEN unaccent(name) ILIKE unaccent('%' || search_term || '%') THEN 1
         ELSE 2
    END,
    created_at DESC
  LIMIT 30;
$$;

-- 3. Permissions
GRANT EXECUTE ON FUNCTION search_products(text) TO anon, authenticated, service_role;
