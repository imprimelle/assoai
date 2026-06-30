#!/usr/bin/env node
/**
 * apply-migrations.ts
 * 
 * Applique les migrations SQL 003 et 004 sur Supabase.
 * Nécessite la CLI Supabase ou l'accès SQL Editor.
 * 
 * Méthode 1 (recommandée) : via le SQL Editor Supabase
 *   → Ouvrir https://supabase.com/dashboard/project/yqioyfuxviiximembver/sql/new
 *   → Copier-coller le contenu des fichiers .sql
 * 
 * Méthode 2 (CLI Supabase) :
 *   npx supabase db push
 * 
 * Méthode 3 (ce script, si le service_role key est dispo) :
 *   npx tsx scripts/apply-migrations.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yqioyfuxviiximembver.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase-migrations');
const MIGRATIONS = [
  '003_project_management.sql',
  '004_notifications.sql',
];

async function main() {
  console.log('🔄 Application des migrations Supabase\n');
  console.log(`   URL : ${SUPABASE_URL}`);
  console.log(`   Fichiers : ${MIGRATIONS.join(', ')}\n`);

  if (!SERVICE_KEY) {
    console.log('⚠️  Pas de SUPABASE_SERVICE_KEY — mode prévisualisation.\n');
    
    for (const file of MIGRATIONS) {
      const path = join(MIGRATIONS_DIR, file);
      console.log(`📄 ${file} (${readFileSync(path, 'utf-8').length} octets)`);
      console.log('─'.repeat(60));
      console.log(readFileSync(path, 'utf-8').slice(0, 500));
      if (readFileSync(path, 'utf-8').length > 500) console.log('  ... (tronqué)');
      console.log('─'.repeat(60) + '\n');
    }

    console.log('📋 Instructions :');
    console.log('   1. Aller sur https://supabase.com/dashboard/project/yqioyfuxviiximembver/sql/new');
    console.log('   2. Copier-coller chaque fichier .sql');
    console.log('   3. Exécuter');
    console.log('');
    console.log('   OU utiliser la CLI Supabase :');
    console.log('   npx supabase link --project-ref yqioyfuxviiximembver');
    console.log('   npx supabase db push');
    return;
  }

  // Application via REST API
  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`\n📤 Application de ${file}...`);
    
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error(`  ✕ Erreur (${response.status}): ${err.slice(0, 200)}`);
      } else {
        console.log(`  ✅ ${file} appliqué avec succès`);
      }
    } catch (error: any) {
      console.error(`  ✕ Exception: ${error.message}`);
    }
  }

  console.log('\n✅ Terminé.');
}

main().catch(console.error);
