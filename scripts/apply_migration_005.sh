#!/bin/bash
# apply_migration_005.sh — Applique la migration billing_rules
# Usage: exécuter dans le SQL Editor de Supabase Dashboard
# ou via psql si l'accès direct est disponible

MIGRATION_FILE="supabase-migrations/005_billing_rules.sql"

echo "📋 Migration à appliquer :"
echo "══════════════════════════════════════════════"
cat "$MIGRATION_FILE"
echo "══════════════════════════════════════════════"
echo ""
echo "⚠️  Action requise : copier le SQL ci-dessus dans le SQL Editor de Supabase :"
echo "   https://supabase.com/dashboard/project/yqioyfuxviiximembver/sql"
echo ""
echo "Ou si psql est disponible :"
echo "   psql \${DATABASE_URL} -f $MIGRATION_FILE"
