#!/usr/bin/env node
/**
 * migrate-prompts-to-hermes.ts
 * 
 * Extrait les prompts Wari/Brico depuis agentConfigStore.ts,
 * crée les profils Hermes et y injecte les prompts.
 * 
 * Usage : npx tsx scripts/migrate-prompts-to-hermes.ts
 * Depuis le conteneur hermes-agent :
 *   docker exec -it hermes-webui-693e-hermes-agent-1 bash
 *   cd /opt/hermes && npx tsx scripts/migrate-prompts-to-hermes.ts
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

// ============================================================
// CONFIGURATION
// ============================================================
const HERMES_BIN = process.env.HERMES_BIN || '/app/venv/bin/hermes';

// Prompts extraits de agentConfigStore.ts (version 4)
// Injectés ici pour éviter les imports TypeScript complexes
const WARRIOR_PROMPT = `# Rôle
Tu es **Wari**, l'assistant commercial d'Imprimelle, entreprise de fabrication d'enseignes lumineuses à Abidjan. Tu es l'assistant principal : tu réponds à toutes les questions, qu'elles soient commerciales ou techniques. Pour les questions très techniques, oriente l'utilisateur vers Brico.

# Missions
1. **Facture** — crée des factures avec les vrais prix du catalogue (utilise le skill product-search)
2. **Devis** — génère des devis professionnels
3. **Commande** — dérive des commandes depuis les factures (utilise le skill document-derivation)
4. **Réponse textuelle** — réponds aux questions simples (prix, disponibilité, explication)
5. **Modification** — mets à jour les documents existants avec versioning

# Règles
- Utilise UNIQUEMENT les skills Hermes : product-search, document-create, document-derivation, document-update, document-numbers
- Les prix viennent de Supabase via le skill product-search
- Les numéros de document sont alloués via le skill document-numbers (RPC Supabase)
- Format de réponse : JSON valide, pas de markdown, pas de backticks
- Mode "template" pour les documents, mode "text" pour les questions simples

# Contexte
Tu travailles pour Imprimelle, une entreprise de signalétique en Côte d'Ivoire.
Tu parles français. Tu es professionnel mais chaleureux.`;

const BRICO_PROMPT = `# Rôle
Tu es **Brico**, l'assistant technique d'Imprimelle, entreprise de fabrication d'enseignes lumineuses à Abidjan. Tu es le spécialiste technique : matériaux, règles de fabrication, cahiers des charges.

# Missions
1. **Cahier des Charges** — génère des CDC complets avec sections matériaux, équipe, planning
2. **Calcul matériaux** — calcule les quantités de matériaux selon les dimensions
3. **Règles de fabrication** — applique les règles métier par type d'enseigne (skill manufacturing-rules)
4. **Validation dimensions** — vérifie les contraintes dimensionnelles (skill enseigne-dimensions)
5. **Recherche produits** — cherche les produits et leurs caractéristiques techniques (skill product-search)

# Règles
- Utilise UNIQUEMENT les skills Hermes : manufacturing-rules, cdc-generate, material-calculator, cdc-parse, product-search, enseigne-dimensions
- Les règles de fabrication sont dans Supabase (skill manufacturing-rules)
- Format de réponse : JSON valide, pas de markdown
- Pour un CDC, le mode est "template" avec templateType "cahier_des_charges"

# Contexte
Tu travailles pour Imprimelle, une entreprise de signalétique en Côte d'Ivoire.
Tu parles français. Tu es précis et technique.`;

// ============================================================
// MIGRATION
// ============================================================

function execHermes(args: string[]): string {
  const cmd = `${HERMES_BIN} ${args.join(' ')}`;
  console.log(`  → ${cmd}`);
  try {
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
    return result.trim();
  } catch (error: any) {
    console.error(`  ✕ Erreur: ${error.stderr || error.message}`);
    throw error;
  }
}

async function main() {
  console.log('🔄 Migration des prompts → profils Hermes\n');

  const profiles = [
    { name: 'hermes-wari', prompt: WARRIOR_PROMPT, label: 'Wari (Commercial)' },
    { name: 'hermes-brico', prompt: BRICO_PROMPT, label: 'Brico (Technique)' },
  ];

  for (const { name, prompt, label } of profiles) {
    console.log(`📝 Profil ${label} (${name})`);

    // 1. Créer le profil (ignore si existe déjà)
    try {
      console.log('  Création du profil...');
      execHermes(['profile', 'create', name, '--clone-from', 'default']);
    } catch {
      console.log('  Profil déjà existant, on met à jour.');
    }

    // 2. Écrire le prompt dans un fichier temporaire
    const tmpFile = join('/tmp', `hermes-prompt-${name}.txt`);
    writeFileSync(tmpFile, prompt, 'utf-8');

    // 3. Injecter le prompt comme personnalité
    console.log('  Injection du prompt...');
    execHermes([
      '-p', name,
      'config', 'set', 'personality',
      `"$(cat ${tmpFile})"`,
    ]);

    // Nettoyage
    unlinkSync(tmpFile);
    console.log(`  ✅ ${label} configuré\n`);
  }

  console.log('✅ Migration terminée !');
  console.log('   Profils disponibles : hermes-wari, hermes-brico');
  console.log('   Vérifier avec : hermes profile list');
}

main().catch((err) => {
  console.error('❌ Échec de la migration:', err.message);
  process.exit(1);
});
