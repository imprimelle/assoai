-- Migration: Ajout de la colonne billing_rules à la table products
-- Date: 05/07/2026
-- Pattern: miroir de manufacturing_rules (JSONB { description_complete, exemples })

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS billing_rules JSONB DEFAULT '{"description_complete": "", "exemples": ""}';

-- Commentaire sur la colonne
COMMENT ON COLUMN products.billing_rules IS 
'Règles de facturation : formules de prix, marges, main d''œuvre, exemples de factures';
