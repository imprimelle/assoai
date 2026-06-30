#!/usr/bin/env node
/**
 * setup-sentinelle.ts
 * 
 * Crée le profil hermes-sentinelle et configure le cron horaire.
 * 
 * Usage : npx tsx scripts/setup-sentinelle.ts
 * Depuis le conteneur hermes-agent :
 *   docker exec -it hermes-webui-693e-hermes-agent-1 bash
 *   cd /opt/hermes && npx tsx scripts/setup-sentinelle.ts
 */

import { execSync } from 'child_process';

const HERMES_BIN = process.env.HERMES_BIN || '/app/venv/bin/hermes';

function execHermes(args: string): string {
  const cmd = `${HERMES_BIN} ${args}`;
  console.log(`  → ${cmd}`);
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (error: any) {
    console.error(`  ✕ Erreur: ${error.stderr || error.message}`);
    throw error;
  }
}

async function main() {
  console.log('🛡️ Configuration du profil Hermes-Sentinelle\n');

  // 1. Créer le profil
  console.log('📝 Création du profil hermes-sentinelle...');
  try {
    execHermes('profile create hermes-sentinelle --clone-from default');
  } catch {
    console.log('  Profil déjà existant, mise à jour.');
  }

  // 2. Configurer la personnalité
  console.log('📝 Configuration de la personnalité...');
  execHermes(`-p hermes-sentinelle config set personality "Tu es **Hermes-Sentinelle**, le veilleur 24/7 d'AssoAI. 

# Rôle
Tu scannes TOUS les projets actifs. Tu détectes les anomalies. Tu alertes. Tu n'agis JAMAIS directement — tu crées des tâches Kanban pour le Directeur et des notifications pour l'Admin.

# Mission horaire (toutes les heures)
1. Scanner tous les projets avec status='actif'
2. Pour chaque projet :
   a. Calculer le Project Health Score (0-100)
   b. Détecter les patterns anormaux (blocage, cascade de retards)
   c. Si score < 50 → créer une tâche Kanban '⚠️ Score bas' assignée au Directeur
   d. Si score < 30 → notification critique + message Admin dans le chat projet
   e. Si blocage > 7 jours → escalade automatique

# Skills disponibles
- project-watcher : Scanner les projets actifs
- anomaly-detector : Détecter les patterns anormaux
- health-scorer : Calculer le Project Health Score
- kanban-manager : Créer des tâches d'alerte
- notification-app : Envoyer des notifications in-app
- escalation-manager : Gérer l'escalade progressive

# Format de réponse
JSON structuré : { summary: string, alerts: [...], scores: {...} }

# Règles
- Ne JAMAIS modifier les données projet directement
- Toujours passer par les skills pour les actions
- Priorité aux alertes critiques
- Rapport concis, factuel, en français"`);

  // 3. Configurer les skills auto-load
  console.log('📝 Configuration des skills...');
  // Les skills sont chargés via le prompt de chaque cron

  // 4. Créer le cron horaire
  console.log('⏰ Création du cron horaire...');
  execHermes(`cronjob create \\
    --name "Sentinelle - Scan horaire" \\
    --schedule "0 * * * *" \\
    --profile hermes-sentinelle \\
    --prompt "Scanne tous les projets actifs. Calcule les Health Scores. Détecte les anomalies. 
Pour chaque projet avec score < 50, crée une tâche Kanban assignée au Directeur.
Pour chaque projet avec score < 30, envoie une notification critique + message Admin.
Rapport concis en français."`);

  console.log('✅ Configuration terminée !');
  console.log('   Profil : hermes-sentinelle');
  console.log('   Cron   : Toutes les heures (0 * * * *)');
  console.log('');
  console.log('📋 Commandes de suivi :');
  console.log('   hermes cronjob list');
  console.log('   hermes -p hermes-sentinelle chat -q "Scan de test"');
}

main().catch((err) => {
  console.error('❌ Échec:', err.message);
  process.exit(1);
});
