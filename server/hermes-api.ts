// hermes-api.ts — Serveur Express local pour le routage Hermes
// v3: Pré-allocation atomique des numéros de document via RPC Supabase
//     Validation post-IA, chaînage automatique, injection skills

import express from 'express';
import { spawn } from 'child_process';
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, rmdirSync } from 'fs';
import { join } from 'path';

const app = express();
app.use(express.json({ limit: '5mb' }));

const PORT = 11434;
const HERMES_BIN = process.env.HERMES_BIN || '/opt/hermes/.venv/bin/hermes' || '/app/venv/bin/hermes';

// Configuration Supabase
const SUPABASE_URL = 'https://yqioyfuxviiximembver.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KZfNfiGqqAu2sKShjOys9Q_QtJyCKF7';

// Racine des skills AssoAI
const SKILLS_DIR = process.env.HERMES_HOME
  ? join(process.env.HERMES_HOME, 'skills')
  : '/home/hermeswebui/.hermes/skills';

// ============================================================
// TYPES
// ============================================================

type DocType = 'facture' | 'devis' | 'commande' | 'cahier_des_charges';

interface AllocatedNumber {
  numero: string;
  docType: DocType;
  numeroKey: string;  // ex: 'factureNumero'
}

// ============================================================
// PRÉ-ALLOCATION ATOMIQUE DES NUMÉROS (RPC Supabase)
// ============================================================

/**
 * Appelle le RPC Supabase next_document_number() de manière atomique.
 * Garantit qu'aucun numéro n'est jamais dupliqué.
 */
async function allocateDocumentNumber(docType: DocType): Promise<string | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/next_document_number`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_doc_type: docType }),
    });

    if (!response.ok) {
      console.error(`[hermes-api] RPC échec (${response.status})`);
      return null;
    }

    const text = await response.text();
    const numero = text.trim().replace(/^"|"$/g, ''); // Nettoyer les guillemets
    console.log(`[hermes-api] Numéro alloué: ${numero} (${docType})`);
    return numero;
  } catch (error: any) {
    console.error(`[hermes-api] RPC exception: ${error.message}`);
    return null;
  }
}

// ============================================================
// DÉTECTION DU TYPE DE DOCUMENT
// ============================================================

const DOC_TYPE_MAP: Record<string, { docType: DocType; numeroKey: string; prefix: string }> = {
  'document-create': { docType: 'facture', numeroKey: 'factureNumero', prefix: 'F' },
  'document-create-app': { docType: 'facture', numeroKey: 'factureNumero', prefix: 'F' },
  'facture': { docType: 'facture', numeroKey: 'factureNumero', prefix: 'F' },
  'devis': { docType: 'devis', numeroKey: 'devisNumero', prefix: 'D' },
  'commande': { docType: 'commande', numeroKey: 'commandeNumero', prefix: 'CMD' },
  'cdc-generate': { docType: 'cahier_des_charges', numeroKey: 'cdcNumero', prefix: 'CDC' },
  'cahier_des_charges': { docType: 'cahier_des_charges', numeroKey: 'cdcNumero', prefix: 'CDC' },
};

// Dérivation : si un template source est fourni, on détecte le type cible
const DERIVATION_MAP: Record<string, DocType> = {
  'document-derivation': 'commande',  // facture→commande par défaut
};

function detectDocumentType(skills: string[], message: string, attachedTemplate?: any): { docType: DocType; numeroKey: string; isDerivation: boolean; isModification: boolean } | null {
  if (!skills || skills.length === 0) return null;

  const msg = message.toLowerCase();

  // --- Détection de modification : regex assouplie + fallback distance d'édition ---

  // Regex assouplie (lettres optionnelles pour les fautes de frappe courantes)
  const fuzzyRegex = /modi?fie?r?|chan?ge?r?|corr?ige?r?|aj?ou?te?r?|supp?rime?r?|mets? .* jour|met(?:tre)? .* jour|actualise?r?|remplace?r?|édite?r?|rectifie?r?|compl[èe]te?r?|enl[èe]ve?r?|r[ée]vise?r?|update|edit/i;

  // Mots-clés de modification pour la distance d'édition
  const MOD_KEYWORDS = [
    'modifie', 'modifier', 'modifié', 'modifiée',
    'change', 'changer', 'changé', 'changée',
    'corrige', 'corriger', 'corrigé', 'corrigée',
    'ajoute', 'ajouter', 'ajouté', 'ajoutée',
    'supprime', 'supprimer', 'supprimé', 'supprimée',
    'actualise', 'actualiser', 'actualisé',
    'remplace', 'remplacer', 'remplacé',
    'édite', 'éditer', 'édité',
    'rectifie', 'rectifier', 'rectifié',
    'complète', 'compléter', 'complété',
    'enlève', 'enlever', 'enlevé',
    'révise', 'réviser', 'révisé',
    'met à jour', 'mets à jour', 'mettre à jour', 'met', 'mets',
    'update', 'edit',
  ];

  function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({length: m + 1}, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function isFuzzyModification(text: string): boolean {
    const words = text.split(/\s+/);
    return words.some(word =>
      word.length >= 3 && MOD_KEYWORDS.some(kw => levenshtein(word, kw) <= 1)
    );
  }

  const isModificationMsg = fuzzyRegex.test(msg) || isFuzzyModification(msg);

  // 0. MODIFICATION : template attaché MÊME TYPE + message de modification → pas de nouveau numéro
  if (attachedTemplate && isModificationMsg) {
    const sourceType = attachedTemplate.templateType;
    // Même type = modification (pas de nouveau numéro)
    if (sourceType === 'facture') {
      return { docType: 'facture', numeroKey: 'factureNumero', isDerivation: false, isModification: true };
    }
    if (sourceType === 'devis') {
      return { docType: 'devis', numeroKey: 'devisNumero', isDerivation: false, isModification: true };
    }
    if (sourceType === 'commande') {
      return { docType: 'commande', numeroKey: 'commandeNumero', isDerivation: false, isModification: true };
    }
    if (sourceType === 'cahier_des_charges') {
      return { docType: 'cahier_des_charges', numeroKey: 'cdcNumero', isDerivation: false, isModification: true };
    }
  }

  // 1. Dérivation : template source + skill derivation → nouveau type = nouveau numéro
  if (attachedTemplate && skills.some(s => s.includes('document-derivation') || s.includes('derivation'))) {
    const sourceType = attachedTemplate.templateType;
    if (sourceType === 'facture') {
      return { docType: 'commande', numeroKey: 'commandeNumero', isDerivation: true, isModification: false };
    }
    if (sourceType === 'commande') {
      return { docType: 'cahier_des_charges', numeroKey: 'cdcNumero', isDerivation: true, isModification: false };
    }
  }

  // 1.5 Dérivation par mot-clé : template source + message mentionne un type DIFFÉRENT
  if (attachedTemplate) {
    const sourceType = attachedTemplate.templateType;
    if (sourceType === 'facture' && (msg.includes('commande') || msg.includes('cmd'))) {
      return { docType: 'commande', numeroKey: 'commandeNumero', isDerivation: true, isModification: false };
    }
    if (sourceType === 'facture' && (msg.includes('cahier des charges') || msg.includes('cdc'))) {
      return { docType: 'cahier_des_charges', numeroKey: 'cdcNumero', isDerivation: true, isModification: false };
    }
    if (sourceType === 'commande' && (msg.includes('cahier des charges') || msg.includes('cdc'))) {
      return { docType: 'cahier_des_charges', numeroKey: 'cdcNumero', isDerivation: true, isModification: false };
    }
    if (sourceType === 'commande' && msg.includes('facture')) {
      return { docType: 'facture', numeroKey: 'factureNumero', isDerivation: true, isModification: false };
    }
    if (sourceType === 'devis' && msg.includes('facture')) {
      return { docType: 'facture', numeroKey: 'factureNumero', isDerivation: true, isModification: false };
    }
    if (sourceType === 'devis' && (msg.includes('commande') || msg.includes('cmd'))) {
      return { docType: 'commande', numeroKey: 'commandeNumero', isDerivation: true, isModification: false };
    }
  }

  // 2. Création directe : détecter par le skill
  for (const skill of skills) {
    const clean = skill.replace(/^assoai\//, '');
    for (const [key, info] of Object.entries(DOC_TYPE_MAP)) {
      if (clean === key) {
        return { docType: info.docType, numeroKey: info.numeroKey, isDerivation: false, isModification: false };
      }
    }
  }

  // 3. Détection par mots-clés (création ou dérivation implicite)
  if (msg.includes('facture')) return { docType: 'facture', numeroKey: 'factureNumero', isDerivation: false, isModification: false };
  if (msg.includes('devis')) return { docType: 'devis', numeroKey: 'devisNumero', isDerivation: false, isModification: false };
  if (msg.includes('commande')) return { docType: 'commande', numeroKey: 'commandeNumero', isDerivation: false, isModification: false };
  if (msg.includes('cahier des charges') || msg.includes('cdc')) return { docType: 'cahier_des_charges', numeroKey: 'cdcNumero', isDerivation: false, isModification: false };

  return null;
}

// ============================================================
// CONSTRUCTION DU PROMPT AVEC NUMÉRO RÉSERVÉ
// ============================================================

function buildReservedNumberConstraint(allocated: AllocatedNumber, attachedTemplate?: any, isModification?: boolean): string {
  let constraint = '';
  
  if (isModification) {
    // Modification : réutiliser le numéro existant
    constraint = `\n✏️✏️✏️ MODIFICATION DE DOCUMENT ✏️✏️✏️\n`;
    constraint += `Tu modifies le document existant **${allocated.numero}**. Tu DOIS RÉUTILISER ce même numéro dans \`${allocated.numeroKey}\`.\n`;
    constraint += `⚠️ IL EST INTERDIT de changer le numéro ou d'en générer un nouveau.\n`;
    constraint += `⚠️ IL EST INTERDIT d'appeler le RPC next_document_number — le numéro est déjà attribué.\n`;
  } else {
    // Création : utiliser le nouveau numéro alloué
    constraint = `\n⚠️⚠️⚠️ CONTRAINTE ABSOLUE — NUMÉRO RÉSERVÉ ⚠️⚠️⚠️\n`;
    constraint += `Le RPC Supabase next_document_number('${allocated.docType}') a réservé atomiquement le numéro : **${allocated.numero}**\n`;
    constraint += `Tu DOIS utiliser EXACTEMENT ce numéro dans le champ \`${allocated.numeroKey}\` du JSON.\n`;
    constraint += `IL EST STRICTEMENT INTERDIT d'inventer, de modifier, ou de générer un autre numéro.\n`;
    constraint += `Même si le format te semble différent de ce que tu connais, utilise CELUI-CI.\n`;
  }

  // Chaînage automatique
  if (attachedTemplate) {
    const sourceData = attachedTemplate.data || {};
    const sourceType = attachedTemplate.templateType;
    if (sourceType === 'facture' && allocated.docType === 'commande') {
      const factureNum = sourceData.factureNumero;
      if (factureNum) {
        constraint += `\n🔗 CHAÎNAGE AUTOMATIQUE :\n`;
        constraint += `Le champ \`linked_facture_id\` DOIT être égal à "${factureNum}" (la facture source).\n`;
        constraint += `Copie également : client (nom, adresse, telephone), deliveryAddress.\n`;
        constraint += `Convertir details[] → items[] (description → nom). Conserver quantités et prix.\n`;
        if (sourceData.reduction != null && sourceData.reduction > 0) {
          constraint += `⚠️ REMISE : La facture source a une réduction de ${sourceData.reduction} CFA. Copie le champ \`reduction\` dans la commande. Le total doit refléter cette réduction.\n`;
        }
      }
    }
    if (sourceType === 'commande' && allocated.docType === 'cahier_des_charges') {
      const cmdNum = sourceData.commandeNumero;
      if (cmdNum) {
        constraint += `\n🔗 CHAÎNAGE AUTOMATIQUE :\n`;
        constraint += `Le champ \`commande_id\` DOIT être égal à "${cmdNum}" (la commande source).\n`;
        constraint += `Copie : client.nom dans le titre du CDC, deliveryAddress.\n`;
      }
    }

    // Contrainte de versioning (modification)
    const sourceVersion = sourceData.version || 1;
    constraint += `\n📝 VERSIONING : Le document source a version=${sourceVersion}. TA RÉPONSE DOIT avoir version=${sourceVersion + 1}.\n`;
    constraint += `N'utilise JAMAIS la même version que le document source.\n`;
  }

  constraint += `\n⚠️⚠️⚠️ FIN CONTRAINTE ⚠️⚠️⚠️\n\n`;
  return constraint;
}

// ============================================================
// VALIDATION POST-IA
// ============================================================

const FORMAT_REGEX: Record<DocType, RegExp> = {
  'facture': /^F-\d{4}-\d{3}$/,
  'devis': /^D-\d{4}-\d{3}$/,
  'commande': /^CMD-\d{4}-\d{3}$/,
  'cahier_des_charges': /^CDC-\d{4}-\d{3}$/,
};

function validateDocumentResponse(responseData: any, allocated: AllocatedNumber, sourceVersion?: number): { valid: boolean; error?: string } {
  // 1. Vérifier que le numéro est présent et correct
  const actualNumero = responseData?.[allocated.numeroKey];
  if (!actualNumero) {
    return { valid: false, error: `Champ ${allocated.numeroKey} absent de la réponse` };
  }
  if (actualNumero !== allocated.numero) {
    return { valid: false, error: `Numéro incorrect: attendu "${allocated.numero}", reçu "${actualNumero}"` };
  }

  // 2. Vérifier le format
  const regex = FORMAT_REGEX[allocated.docType];
  if (regex && !regex.test(actualNumero)) {
    return { valid: false, error: `Format invalide: "${actualNumero}"` };
  }

  // 3. Vérifier le versioning si modification
  if (sourceVersion !== undefined) {
    const newVersion = responseData?.version;
    if (newVersion === undefined) {
      return { valid: false, error: `Champ version absent (attendu > ${sourceVersion})` };
    }
    if (newVersion <= sourceVersion) {
      return { valid: false, error: `Version non incrémentée: source=${sourceVersion}, reçu=${newVersion}` };
    }
  }

  return { valid: true };
}

// ============================================================
// INJECTION DE SKILLS DANS LE PROMPT
// ============================================================

function loadSkillContent(skillName: string): string | null {
  const paths = [
    join(SKILLS_DIR, 'assoai', skillName, 'SKILL.md'),
    join(SKILLS_DIR, skillName, 'SKILL.md'),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      try { return readFileSync(p, 'utf-8'); } catch { return null; }
    }
  }
  return null;
}

function injectSkillsIntoPrompt(message: string, skills: string[]): string {
  if (!skills || skills.length === 0) return message;
  const loaded: string[] = [];
  for (const skill of skills) {
    const cleanName = skill.replace(/^assoai\//, '');
    const content = loadSkillContent(cleanName);
    if (content) {
      loaded.push(content);
      console.log(`[hermes-api] Skill injecté: ${cleanName}`);
    }
  }
  if (loaded.length === 0) return message;
  const skillsBlock = loaded.map((s, i) =>
    `\n--- SKILL: ${skills[i].replace(/^assoai\//, '')} ---\n${s}\n--- FIN SKILL ---\n`
  ).join('');
  return `${skillsBlock}\n--- MESSAGE UTILISATEUR ---\n${message}`;
}

// ============================================================
// CONSTRUCTION DU CONTEXTE PROJET (injecté dans le prompt)
// ============================================================

async function buildProjectContext(projectId: string): Promise<string | null> {
  try {
    // 1. Infos du projet
    const pRes = await fetch(
      `${SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}&select=name,status,phase,date_livraison`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!pRes.ok) return null;
    const projects = await pRes.json() as any[];
    if (!projects || projects.length === 0) return null;
    const proj = projects[0];

    // 2. Documents liés (messages avec project_id ET template_type)
    const mRes = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?project_id=eq.${projectId}&template_type=not.is.null&order=timestamp.desc&limit=20&select=id,template_type,template_data,timestamp`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const messages = mRes.ok ? (await mRes.json() as any[]) : [];

    // 3. Tâches Kanban
    const tRes = await fetch(
      `${SUPABASE_URL}/rest/v1/project_tasks?project_id=eq.${projectId}&order=created_at.desc&limit=20&select=title,kanban_column,assignee,priority,due_date`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const tasks = tRes.ok ? (await tRes.json() as any[]) : [];

    // Construire le bloc contexte
    let ctx = `\n══════════════════════════════════════\n`;
    ctx += `📁 CONTEXTE PROJET — ${proj.name}\n`;
    ctx += `══════════════════════════════════════\n`;
    ctx += `- Statut : ${proj.status || 'actif'}\n`;
    ctx += `- Phase  : ${proj.phase || 'facturation'}\n`;
    if (proj.date_livraison) ctx += `- Livraison prévue : ${proj.date_livraison}\n`;

    // Documents
    ctx += `\n📄 DOCUMENTS LIÉS (${messages.length}) :\n`;
    if (messages.length === 0) {
      ctx += `  (aucun document lié à ce projet)\n`;
    } else {
      for (const msg of messages) {
        const td = msg.template_data?.data || {};
        const type = msg.template_type;
        const emoji = type === 'facture' ? '🔵' : type === 'commande' ? '🟠' : type === 'cahier_des_charges' ? '🟣' : type === 'devis' ? '🟢' : '📄';
        const num = td.factureNumero || td.devisNumero || td.commandeNumero || td.cdcNumero || '?';
        const client = td.client?.nom || td.titre || '';
        const total = td.total ? ` — ${td.total.toLocaleString()} FCFA` : '';
        const version = td.version ? ` v${td.version}` : '';
        ctx += `  ${emoji} ${num} — ${client}${total}${version}\n`;
        // Pour les CDC, détailler les sections matériaux
        if (type === 'cahier_des_charges') {
          const ens = td.enseignes || [];
          if (ens.length > 0) {
            ctx += `     📐 ${ens.length} enseigne(s)\n`;
            for (const e of ens) {
              const mat = e.materiauxSections || {};
              const sectionKeys = Object.keys(mat);
              if (sectionKeys.length > 0) {
                ctx += `     🏗️ ${e.nom || 'Enseigne'}: `;
                ctx += sectionKeys.map(k => {
                  const items = mat[k] || [];
                  return `${k}(${items.length})`;
                }).join(', ');
                ctx += `\n`;
              }
            }
          }
        }
      }
    }

    // Tâches
    if (tasks.length > 0) {
      ctx += `\n📌 TÂCHES KANBAN (${tasks.length}) :\n`;
      for (const t of tasks) {
        const col = { a_faire: 'À faire', en_cours: 'En cours', en_revision: 'Révision', termine: 'Terminé' }[t.kanban_column] || t.kanban_column;
        ctx += `  [${col}] ${t.title}${t.assignee ? ` → ${t.assignee}` : ''}${t.priority ? ` (${t.priority})` : ''}\n`;
      }
    }

    ctx += `══════════════════════════════════════\n\n`;
    ctx += `ℹ️ Tu es dans le contexte du projet « ${proj.name} ». `;
    ctx += `L'utilisateur peut te poser des questions sur ce projet, ses documents, ses tâches, ou son avancement.\n`;
    ctx += `Tu peux consulter les détails des documents listés ci-dessus en interrogeant la table messages.\n\n`;

    return ctx;
  } catch (err) {
    console.error('[hermes-api] buildProjectContext error:', err);
    return null;
  }
}

// ============================================================
// ROUTEUR PRINCIPAL (v4 — Wari/Brico autonomes sur les numéros)
// ============================================================
app.post('/router', async (req, res) => {
  try {
    const { message, userId, sessionId, profile, skills, attachedTemplate, attachedQuote, projectId } = req.body;

    if (!message || !profile) {
      return res.status(400).json({ success: false, error: 'message and profile required' });
    }

    console.log(`[hermes-api] → ${profile} (skills: ${(skills || []).join(',') || 'none'})${projectId ? ' [projet:' + projectId.slice(0,8) + ']' : ''}`);

    // --- Construire le prompt enrichi ---
    let fullPrompt = '';

    // 🆕 CONTEXTE PROJET : injecter infos projet + documents liés
    if (projectId) {
      try {
        const projectCtx = await buildProjectContext(projectId);
        if (projectCtx) {
          fullPrompt += projectCtx;
          console.log(`[hermes-api] Contexte projet injecté (${projectCtx.length} chars)`);
        }
      } catch (err) {
        console.log(`[hermes-api] Impossible de charger le contexte projet: ${err}`);
      }
    }

    // Contexte : template existant = modification ou dérivation
    if (attachedTemplate) {
      const src = attachedTemplate.data || {};
      const tpl = attachedTemplate.templateType;
      let contexte = `\n--- TEMPLATE EXISTANT ---\n${JSON.stringify(attachedTemplate, null, 2)}\n--- FIN TEMPLATE ---\n\n`;
      
      // Ajouter des instructions claires SELON le template fourni
      contexte += `📋 CE DOCUMENT T'EST FOURNI EN CONTEXTE.\n`;
      contexte += `C'est un(e) **${tpl}** existant(e).\n`;
      
      // Lister les infos clés pour aider l'agent
      if (tpl === 'facture') {
        contexte += `- Son numéro : **${src.factureNumero || '?'}**\n`;
        contexte += `- Sa version : **${src.version || 1}**\n`;
        contexte += `- Son client : **${src.client?.nom || '?'}**\n`;
      } else if (tpl === 'commande') {
        contexte += `- Son numéro : **${src.commandeNumero || '?'}**\n`;
        contexte += `- Sa version : **${src.version || 1}**\n`;
        contexte += `- Si liée à une facture : linked_facture_id = **${src.linked_facture_id || 'non'}**\n`;
      } else if (tpl === 'devis') {
        contexte += `- Son numéro : **${src.devisNumero || '?'}**\n`;
        contexte += `- Sa version : **${src.version || 1}**\n`;
      } else if (tpl === 'cahier_des_charges') {
        contexte += `- Son numéro : **${src.cdcNumero || src.titre || '?'}**\n`;
        contexte += `- Sa version : **${src.version || 1}**\n`;
      }

      contexte += `\n⚠️ RÈGLE : Si l'utilisateur demande une MODIFICATION de CE document → réutilise son numéro, incrémente sa version.\n`;
      contexte += `⚠️ RÈGLE : Si l'utilisateur demande un NOUVEAU document d'un type DIFFÉRENT → appelle le RPC next_document_number.\n`;

      // 🔗 Contraintes de chaînage (dérivation)
      if (tpl === 'facture') {
        contexte += `\n🔗 CHAÎNAGE AUTOMATIQUE (Facture → Commande) :\n`;
        contexte += `- Le champ \`linked_facture_id\` DOIT être égal à "${src.factureNumero || '?'}" (la facture source).\n`;
        contexte += `- Copie INTÉGRALEMENT le client : nom, adresse, telephone.\n`;
        contexte += `- Copie deliveryAddress (format { label, lat, lng }).\n`;
        contexte += `- Convertir details[] → items[] (description → nom).\n`;
        contexte += `- Conserver quantités et prix de chaque ligne.\n`;
        if (src.reduction != null && src.reduction > 0) {
          contexte += `- ⚠️ REMISE : La facture source a une réduction de ${src.reduction} CFA. Copie le champ \`reduction\` dans la commande.\n`;
          contexte += `- ⚠️ CALCUL DU TOTAL : \`total = somme(items[i].sous_total) - ${src.reduction}\`. La réduction doit être SOUSTRAITE du total, pas ignorée.\n`;
        }
      } else if (tpl === 'commande') {
        contexte += `\n🔗 CHAÎNAGE AUTOMATIQUE (Commande → CDC) :\n`;
        contexte += `- Le champ \`commande_id\` DOIT être égal à "${src.commandeNumero || '?'}" (la commande source).\n`;
        contexte += `- Pour CHAQUE item[] de la commande → crée une enseigne dans le tableau enseignes[] du CDC.\n`;
        contexte += `- Chaque enseigne : nom = item.nom, image_url = item.image_url.\n`;
        contexte += `- Utilise "Cahier des Charges — " + client.nom comme titre du CDC.\n`;
        contexte += '- Copie deliveryAddress intégralement (label, lat, lng).\n';
        contexte += '- Génère les materiauxSections (Découpe, Éclairage, Outillage, Métal, Vinyl) pour chaque enseigne en utilisant les skills manufacturing-rules et material-calculator.\n';
        contexte += '- Les items[] de la commande sont les produits à fabriquer : TOUS doivent apparaître comme enseignes[].\n';
      }

      contexte += `\n`;
      fullPrompt = contexte + fullPrompt;
    }

    if (attachedQuote) {
      fullPrompt = `--- DOCUMENT CITÉ ---\n${JSON.stringify(attachedQuote, null, 2)}\n--- FIN CITATION ---\n\n${fullPrompt}`;
    }

    // 🆕 Injecter les skills filesystem (non-bundled) en texte dans le prompt
    // Le CLI --skills ne reconnaît que les skills du manifest bundle
    const allSkills = (skills || []).map(s => s.replace(/^assoai\//, ''));
    const MANIFEST_SKILLS = ['assoai-development'];
    const filesystemSkills = allSkills.filter(s => !MANIFEST_SKILLS.includes(s));
    if (filesystemSkills.length > 0) {
      const injected = injectSkillsIntoPrompt('', filesystemSkills);
      fullPrompt = injected + fullPrompt;
    }

    // Message utilisateur APRÈS le contexte projet et les skills injectés
    fullPrompt = fullPrompt + '\n--- MESSAGE UTILISATEUR ---\n' + message;

    // --- Appeler Hermes ---
    // Pattern : --skills pour les skills bundled (assoai-development uniquement),
    // les skills filesystem (document-create-app, product-search, etc.) sont injectés en texte
    const hermesArgs = ['-p', profile, 'chat', '-q', fullPrompt, '--quiet'];
    
    const cliSafeSkills = allSkills.filter(s => MANIFEST_SKILLS.includes(s));
    for (const skill of cliSafeSkills) {
      hermesArgs.push('--skills', skill);
    }
    // Toujours ajouter assoai-development pour le contexte Supabase
    if (!allSkills.includes('assoai-development')) {
      hermesArgs.push('--skills', 'assoai-development');
    }

    const result = await spawnHermes(hermesArgs, profile);

    // --- Validation post-IA (soft : log + format check, pas de rejet) ---
    if (result.response.mode === 'template' && result.response.data) {
      const d = result.response.data;
      const tpl = result.response.templateType;
      const num = d.factureNumero || d.devisNumero || d.commandeNumero || d.cdcNumero;
      if (num) {
        // Vérification format (soft — on log juste)
        const expected = tpl === 'cahier_des_charges' ? 'CDC-YYYY-NNN' :
                         tpl === 'commande' ? 'CMD-YYYY-NNN' :
                         tpl === 'devis' ? 'D-YYYY-NNN' : 'F-YYYY-NNN';
        const regex = /^[A-Z]+-\d{4}-\d{3}$/;
        if (!regex.test(num)) {
          console.log(`[hermes-api] ⚠️ Format suspect: ${num} (attendu: ${expected})`);
        }
        // Vérification cohérence modification (si template fourni)
        if (attachedTemplate) {
          const srcNum = attachedTemplate.data?.factureNumero || attachedTemplate.data?.devisNumero ||
                        attachedTemplate.data?.commandeNumero || attachedTemplate.data?.cdcNumero;
          const srcVer = attachedTemplate.data?.version || 1;
          if (num === srcNum && (d.version || 1) <= srcVer) {
            console.log(`[hermes-api] ⚠️ Version non incrémentée: ${srcVer}→${d.version} pour ${num}`);
          }
        }
      }
    }
    // ── Ne PAS persister — le frontend s'en charge via database.ts ──
    // (sinon double entrée avec sender 'system' + sender 'ai')

    console.log(`[hermes-api] ✅ ${result.response.mode === 'template' ? 'Template généré' : 'Réponse texte'} (${profile})`);
    res.json({
      success: true,
      profile,
      response: result.response,
      tokens: result.tokens,
      skillsUsed: skills || [],
    });

  } catch (error: any) {
    console.error('[hermes-api] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// ROUTEUR STREAMING (SSE)
// ============================================================
app.post('/router/stream', async (req, res) => {
  try {
    const { message, userId, sessionId, profile, skills, attachedTemplate, attachedQuote } = req.body;
    if (!message || !profile) {
      return res.status(400).json({ success: false, error: 'message and profile required' });
    }

    console.log(`[hermes-api:stream] → ${profile}`);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Détection + allocation
    const docInfo = detectDocumentType(skills || [], message, attachedTemplate);
    let allocatedNumber: AllocatedNumber | null = null;
    if (docInfo && !docInfo.isModification) {
      const numero = await allocateDocumentNumber(docInfo.docType);
      if (numero) {
        allocatedNumber = { numero, docType: docInfo.docType, numeroKey: docInfo.numeroKey };
      }
    } else if (docInfo && docInfo.isModification) {
      const sourceData = attachedTemplate?.data || {};
      const existingNumero = sourceData[docInfo.numeroKey];
      if (existingNumero) {
        allocatedNumber = { numero: existingNumero, docType: docInfo.docType, numeroKey: docInfo.numeroKey };
      }
    }

    let fullPrompt = '--- MESSAGE UTILISATEUR ---\n' + message;
    if (attachedTemplate) {
      fullPrompt = `--- TEMPLATE EXISTANT ---\n${JSON.stringify(attachedTemplate, null, 2)}\n--- FIN TEMPLATE ---\n\n${fullPrompt}`;
    }
    if (attachedQuote) {
      fullPrompt = `--- DOCUMENT CITÉ ---\n${JSON.stringify(attachedQuote, null, 2)}\n--- FIN CITATION ---\n\n${fullPrompt}`;
    }
    if (allocatedNumber) {
      fullPrompt = buildReservedNumberConstraint(allocatedNumber, attachedTemplate, docInfo?.isModification) + fullPrompt;
    }

    // Pattern PM : passer tous les skills via --skills (répétable)
    const hermesArgs = ['-p', profile, 'chat', '-q', fullPrompt, '--quiet'];
    const allSkills = (skills || []).map(s => s.replace(/^assoai\//, ''));
    const BLOCKED_FROM_CLI = ['product-search', 'document-derivation', 'document-numbers'];
    const cliSafeSkills = allSkills.filter(s => !BLOCKED_FROM_CLI.includes(s));
    for (const skill of cliSafeSkills) {
      hermesArgs.push('--skills', skill);
    }
    if (!allSkills.includes('assoai-development')) {
      hermesArgs.push('--skills', 'assoai-development');
    }

    const proc = spawn(HERMES_BIN, hermesArgs, {
      env: { ...process.env, HOME: '/home/hermeswebui' },
      timeout: 300000,
    });

    let stdout = '';
    proc.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });
    proc.stderr.on('data', (data: Buffer) => {
      console.error(`[hermes-api:stream] stderr: ${data.toString().slice(0, 200)}`);
    });
    proc.on('close', (code: number) => {
      const cleaned = stdout.trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      let result: any = { mode: 'text', textFallback: cleaned || 'Aucune réponse.' };
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          result = {
            mode: parsed.mode || 'text',
            textFallback: parsed.textFallback || cleaned,
            templateType: parsed.templateType,
            data: parsed.data,
          };
        } catch {}
      }
      // Validation
      if (allocatedNumber && result.mode === 'template' && result.data) {
        const sourceVersion = attachedTemplate?.data?.version;
        const validation = validateDocumentResponse(result.data, allocatedNumber, sourceVersion);
        if (!validation.valid) {
          result = { mode: 'text', textFallback: `❌ Document rejeté: ${validation.error}` };
        }
      }
      // ── Persister la réponse dans Supabase ──
      try {
        const insertPayload: any = {
          session_id: sessionId || `stream-${Date.now()}`,
          user_id: userId || 'anonymous',
          sender: result.mode === 'template' ? 'system' : 'assistant',
          session_type: 'chat',
        };
        if (result.mode === 'template' && result.data) {
          insertPayload.template_type = result.templateType;
          insertPayload.template_data = { data: result.data };
          const num = result.data.factureNumero || result.data.devisNumero ||
                      result.data.commandeNumero || result.data.cdcNumero;
          insertPayload.content = `${result.templateType} ${num}`;
        } else {
          insertPayload.content = result.textFallback || '';
        }
        const supabaseUrl = `https://${SUPABASE_URL.replace('https://', '')}`;
        fetch(`${supabaseUrl}/rest/v1/messages`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(insertPayload),
        }).catch(() => {});
      } catch {}
      res.write(`data: ${JSON.stringify({ done: true, code, response: result, profile, allocatedNumber: allocatedNumber?.numero })}\n\n`);
      res.end();
    });
    proc.on('error', (err: Error) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
    req.on('close', () => {
      if (!proc.killed) proc.kill();
    });
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (_req, res) => {
  // Health check dynamique — scan s6 pour les profils UP
  try {
    const { readdirSync } = require('fs');
    const { execSync } = require('child_process');
    const S6_SVSTAT = '/package/admin/s6-2.15.0.0/command/s6-svstat';
    const SERVICE_DIR = '/run/service';
    
    const services = readdirSync(SERVICE_DIR)
      .filter(d => d.startsWith('gateway-') && d !== 'gateway-default');
    
    const profiles = services
      .map(s => s.replace('gateway-', ''))
      .filter(p => {
        try {
          const out = execSync(`${S6_SVSTAT} ${SERVICE_DIR}/gateway-${p}`, { timeout: 2000 });
          return out.toString().startsWith('up');
        } catch { return false; }
      });
    
    res.json({ status: 'ok', profiles: profiles.length ? profiles : ['hermes-pm', 'hermes-wari', 'hermes-brico'] });
  } catch {
    // Fallback si s6 inaccessible (ex: Windows dev)
    res.json({ status: 'ok', profiles: ['hermes-pm', 'hermes-wari', 'hermes-brico'] });
  }
});

// ============================================================
// SOUL.MD — Lecture/écriture des prompts des agents
// ============================================================
const PROFILES_DIR = process.env.HERMES_HOME
  ? join(process.env.HERMES_HOME, 'profiles')
  : '/home/hermeswebui/.hermes/profiles';

const VALID_PROFILES = ['hermes-wari', 'hermes-brico', 'hermes-pm', 'hermes-pia', 'hermes-sentinelle', 'hermes-notificateur', 'hermes-communicateur'];

const COMMUNICATOR_SOUL_DIR = '/mnt/whatsapp-home/.hermes/profiles/default';

// GET /soul/:profile — lire le SOUL.md d'un profil
app.get('/soul/:profile', (req, res) => {
  const { profile } = req.params;
  if (!VALID_PROFILES.includes(profile)) {
    return res.status(400).json({ success: false, error: `Profil inconnu: ${profile}` });
  }
  // Communicateur → instance #2 via volume monté
  if (profile === 'hermes-communicateur') {
    const soulPath = join(COMMUNICATOR_SOUL_DIR, 'SOUL.md');
    if (!existsSync(soulPath)) {
      return res.status(404).json({ success: false, error: 'SOUL.md Communicateur introuvable. Vérifier le montage /mnt/whatsapp-home' });
    }
    try {
      const content = readFileSync(soulPath, 'utf-8');
      return res.json({ success: true, profile, content });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  const soulPath = join(PROFILES_DIR, profile, 'SOUL.md');
  if (!existsSync(soulPath)) {
    return res.status(404).json({ success: false, error: 'SOUL.md introuvable' });
  }
  try {
    const content = readFileSync(soulPath, 'utf-8');
    res.json({ success: true, profile, content });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /soul/:profile — sauvegarder le SOUL.md d'un profil
app.put('/soul/:profile', (req, res) => {
  const { profile } = req.params;
  const { content } = req.body;
  if (!VALID_PROFILES.includes(profile)) {
    return res.status(400).json({ success: false, error: `Profil inconnu: ${profile}` });
  }
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, error: 'content requis (string non vide)' });
  }
  // Communicateur → instance #2 via volume monté
  if (profile === 'hermes-communicateur') {
    const soulPath = join(COMMUNICATOR_SOUL_DIR, 'SOUL.md');
    try {
      writeFileSync(soulPath, content, 'utf-8');
      console.log(`[hermes-api] SOUL.md Communicateur sauvegardé (${content.length} chars)`);
      return res.json({ success: true, profile, size: content.length });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  const soulPath = join(PROFILES_DIR, profile, 'SOUL.md');
  try {
    writeFileSync(soulPath, content, 'utf-8');
    console.log(`[hermes-api] SOUL.md sauvegardé: ${profile} (${content.length} chars)`);
    res.json({ success: true, profile, size: content.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// CONFIG — GET/PUT /config/:profile (model + provider)
// ============================================================

const COMMUNICATOR_MGMT_URL = 'http://whatsapp-agent:11435';

// GET /config/:profile
app.get('/config/:profile', async (req, res) => {
  const { profile } = req.params;
  if (!VALID_PROFILES.includes(profile)) {
    return res.status(400).json({ success: false, error: `Profil inconnu: ${profile}` });
  }

  // Communicateur → proxy vers management-api
  if (profile === 'hermes-communicateur') {
    try {
      const r = await fetch(`${COMMUNICATOR_MGMT_URL}/config`);
      const data = await r.json();
      return res.json({ ...data, profile });
    } catch (err: any) {
      return res.status(502).json({ success: false, error: `Proxy communicateur: ${err.message}` });
    }
  }

  // Profils instance #1 → lecture config.yaml local
  try {
    const configPath = join(PROFILES_DIR, profile, 'config.yaml');
    if (!existsSync(configPath)) {
      return res.status(404).json({ success: false, error: 'config.yaml introuvable' });
    }
    const text = readFileSync(configPath, 'utf-8');
    // Extraire model.default, model.provider et agent.reasoning_effort
    let model = '', provider = '', reasoningEffort = '';
    let inModel = false, inAgent = false;
    for (const line of text.split('\n')) {
      const dl = line.trim();
      // Détecter les sections
      if (dl === 'model:' && !line.startsWith(' ')) { inModel = true; inAgent = false; continue; }
      if (dl === 'agent:' || dl.startsWith('agent:')) { inAgent = true; inModel = false; continue; }
      if (dl === 'providers:' || dl === 'fallback_providers:' || dl === 'credential_pool_strategies:' || dl === 'toolsets:') { inModel = false; inAgent = false; continue; }
      if (dl === 'delegation:' || dl === 'display:' || dl === 'terminal:' || dl === 'security:' || dl === 'approvals:') { inAgent = false; continue; }
      // Extraire les valeurs
      if (inModel) {
        if (dl.startsWith('default:')) model = dl.split(':', 2)[1]?.trim().replace(/['"]/g, '') || '';
        if (dl.startsWith('provider:')) { 
          provider = dl.split(':', 2)[1]?.trim().replace(/['"]/g, '') || '';
        }
        if (model && provider) { inModel = false; continue; }
      }
      if (inAgent) {
        if (dl.startsWith('reasoning_effort:')) {
          reasoningEffort = dl.split(':', 2)[1]?.trim().replace(/['"]/g, '') || '';
          inAgent = false;
        }
      }
    }
    res.json({ success: true, profile, model, provider, reasoning_effort: reasoningEffort });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /config/:profile
app.put('/config/:profile', async (req, res) => {
  const { profile } = req.params;
  const { model, provider, reasoning_effort: reasoningEffort } = req.body;
  if (!VALID_PROFILES.includes(profile)) {
    return res.status(400).json({ success: false, error: `Profil inconnu: ${profile}` });
  }
  if (!model || !provider) {
    return res.status(400).json({ success: false, error: 'model et provider requis' });
  }

  // Communicateur → proxy vers management-api
  if (profile === 'hermes-communicateur') {
    try {
      const r = await fetch(`${COMMUNICATOR_MGMT_URL}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, provider, reasoning_effort: reasoningEffort }),
      });
      const data = await r.json();
      return res.json({ ...data, profile });
    } catch (err: any) {
      return res.status(502).json({ success: false, error: `Proxy communicateur: ${err.message}` });
    }
  }

  // Profils instance #1 → merge dans config.yaml
  try {
    const configPath = join(PROFILES_DIR, profile, 'config.yaml');
    if (!existsSync(configPath)) {
      return res.status(404).json({ success: false, error: 'config.yaml introuvable' });
    }
    let text = readFileSync(configPath, 'utf-8');
    let inModel = false;
    let inAgent = false;
    const lines = text.split('\n');
    const newLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'model:' && !line.startsWith(' ')) { inModel = true; inAgent = false; newLines.push(line); continue; }
      if (trimmed.startsWith('agent:')) { inAgent = true; inModel = false; newLines.push(line); continue; }
      if (inModel) {
        if (trimmed.startsWith('default:')) { newLines.push(`  default: ${model}`); continue; }
        if (trimmed.startsWith('default :')) { newLines.push(`  default : ${model}`); continue; }
        if (trimmed.startsWith('provider:')) { newLines.push(`  provider: ${provider}`); continue; }
        if (trimmed.startsWith('provider :')) { newLines.push(`  provider : ${provider}`); continue; }
        if (/^\s{2,}\w/.test(line)) continue;
        inModel = false;
      }
      if (inAgent && reasoningEffort !== undefined && reasoningEffort !== null) {
        if (trimmed.startsWith('reasoning_effort:')) { newLines.push(`  reasoning_effort: ${reasoningEffort}`); continue; }
        if (trimmed.startsWith('reasoning_effort :')) { newLines.push(`  reasoning_effort : ${reasoningEffort}`); continue; }
      }
      if (!inModel && !line.startsWith('  ') && inAgent && !trimmed.startsWith(('  ', 'agent:'))) inAgent = false;
      newLines.push(line);
    }
    writeFileSync(configPath, newLines.join('\n'), 'utf-8');
    console.log(`[hermes-api] Config sauvegardée: ${profile} → ${model} (@${provider}) reasoning=${reasoningEffort || 'inchangé'}`);
    res.json({ success: true, profile, model, provider });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// SKILLS — GET /skills/:profile  +  GET/PUT /skill/:profile/:name
// ============================================================

// GET /skills/:profile — liste des skills assoai/
app.get('/skills/:profile', async (req, res) => {
  const { profile } = req.params;
  if (!VALID_PROFILES.includes(profile)) {
    return res.status(400).json({ success: false, error: `Profil inconnu: ${profile}` });
  }

  if (profile === 'hermes-communicateur') {
    try {
      const r = await fetch(`${COMMUNICATOR_MGMT_URL}/skills`);
      const data = await r.json();
      return res.json({ ...data, profile });
    } catch (err: any) {
      return res.status(502).json({ success: false, error: `Proxy communicateur: ${err.message}` });
    }
  }

  try {
    const skillsDir = join(SKILLS_DIR, 'assoai');
    const skills: { name: string; size: number }[] = [];
    if (existsSync(skillsDir)) {
      for (const d of readdirSync(skillsDir, { withFileTypes: true })) {
        if (d.isDirectory()) {
          const md = join(skillsDir, d.name, 'SKILL.md');
          if (existsSync(md)) skills.push({ name: d.name, size: statSync(md).size });
        }
      }
    }
    skills.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ success: true, profile, skills });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /skill/:profile/:name — lire un skill
app.get('/skill/:profile/:name', async (req, res) => {
  const { profile, name } = req.params;
  if (!VALID_PROFILES.includes(profile)) {
    return res.status(400).json({ success: false, error: `Profil inconnu: ${profile}` });
  }

  if (profile === 'hermes-communicateur') {
    try {
      const r = await fetch(`${COMMUNICATOR_MGMT_URL}/skill/${name}`);
      const data = await r.json();
      return res.json(data);
    } catch (err: any) {
      return res.status(502).json({ success: false, error: `Proxy communicateur: ${err.message}` });
    }
  }

  try {
    const skillPath = join(SKILLS_DIR, 'assoai', name, 'SKILL.md');
    if (!existsSync(skillPath)) {
      return res.status(404).json({ success: false, error: `Skill introuvable: ${name}` });
    }
    const content = readFileSync(skillPath, 'utf-8');
    res.json({ success: true, name, content, size: content.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /skill/:profile/:name — sauvegarder un skill modifié
app.put('/skill/:profile/:name', async (req, res) => {
  const { profile, name } = req.params;
  const { content, _delete } = req.body;

  // Support suppression via _delete flag
  if (_delete === true) {
    if (profile === 'hermes-communicateur') {
      try {
        const r = await fetch(`${COMMUNICATOR_MGMT_URL}/skill/${name}`, { method: 'DELETE' });
        const data = await r.json();
        return res.json(data);
      } catch (err: any) {
        return res.status(502).json({ success: false, error: `Proxy communicateur: ${err.message}` });
      }
    }
    try {
      const skillDir = join(SKILLS_DIR, 'assoai', name);
      const skillPath = join(skillDir, 'SKILL.md');
      if (existsSync(skillPath)) {
        rmSync(skillPath);
        // Remove dir if empty
        try { rmdirSync(skillDir); } catch {}
        console.log(`[hermes-api] Skill supprimé: ${profile}/${name}`);
        return res.json({ success: true, name, deleted: true });
      }
      return res.status(404).json({ success: false, error: `Skill introuvable: ${name}` });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (!VALID_PROFILES.includes(profile)) {
    return res.status(400).json({ success: false, error: `Profil inconnu: ${profile}` });
  }
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, error: 'content requis' });
  }

  if (profile === 'hermes-communicateur') {
    try {
      const r = await fetch(`${COMMUNICATOR_MGMT_URL}/skill/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await r.json();
      return res.json(data);
    } catch (err: any) {
      return res.status(502).json({ success: false, error: `Proxy communicateur: ${err.message}` });
    }
  }

  try {
    const skillDir = join(SKILLS_DIR, 'assoai', name);
    if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });
    const skillPath = join(skillDir, 'SKILL.md');
    writeFileSync(skillPath, content, 'utf-8');
    console.log(`[hermes-api] Skill sauvegardé: ${profile}/${name} (${content.length} chars)`);
    res.json({ success: true, name, size: content.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// SYNC WHATSAPP ALLOWLIST — synchronise human_contacts → instance #2
// ============================================================
app.post('/sync-whatsapp-allowlist', async (req, res) => {
  try {
    // 1. Lire tous les contacts actifs depuis Supabase (phone + whatsapp_jid)
    const contactsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/human_contacts?is_active=eq.true&select=phone,whatsapp_jid`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const contacts = contactsRes.ok ? (await contactsRes.json() as any[]) : [];
    
    // Extraire les phones (nettoyés) + les JID WhatsApp (LID, etc.)
    const phones = contacts
      .map((c: any) => c.phone.replace(/^\+/, '').replace(/[^0-9]/g, ''))
      .filter(Boolean);
    const jids = contacts
      .map((c: any) => c.whatsapp_jid)
      .filter((j: any) => j && typeof j === 'string' && j.includes('@'));
    
    // 2. Ajouter les numéros fixes (bot lui-même + LID du bot)
    const staticNumbers = ['22541947134'];
    const allPhones = [...new Set([...staticNumbers, ...phones, ...jids])].join(',');
    
    // 3. Écrire dans le .env de l'instance #2 via le volume partagé
    const envPath = '/mnt/whatsapp-home/.env';
    let envContent = '';
    try {
      envContent = readFileSync(envPath, 'utf-8');
    } catch { /* fichier absent, sera créé */ }
    
    // Remplacer ou ajouter WHATSAPP_ALLOWED_USERS
    if (/^WHATSAPP_ALLOWED_USERS=/m.test(envContent)) {
      envContent = envContent.replace(/^WHATSAPP_ALLOWED_USERS=.*/m, `WHATSAPP_ALLOWED_USERS=${allPhones}`);
    } else {
      envContent += `\nWHATSAPP_ALLOWED_USERS=${allPhones}\n`;
    }
    writeFileSync(envPath, envContent, 'utf-8');
    
    // 4. Signaler au cron Communicateur de redémarrer le bridge
    try {
      writeFileSync('/mnt/whatsapp-home/.hermes/reload_allowlist', new Date().toISOString(), 'utf-8');
    } catch { /* volume non monté ? ignorer */ }
    
    console.log(`[hermes-api] WhatsApp allowlist sync: ${contacts.length} contacts → ${allPhones.split(',').length} numbers`);
    res.json({ success: true, count: contacts.length, phones: allPhones });
  } catch (err: any) {
    console.error('[hermes-api] sync-whatsapp-allowlist error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// UTILITAIRE SUPABASE
// ============================================================

async function fetchSupabase(path: string): Promise<any[]> {
  const url = `https://${SUPABASE_URL.replace('https://', '')}/rest/v1/${path}`;
  const resp = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!resp.ok) {
    console.warn(`[hermes-api] Supabase ${resp.status} sur ${path}`);
    return [];
  }
  return resp.json();
}

// ============================================================
// BUILD OG PAGE (HTML minimal pour crawlers sociaux)
// ============================================================

function buildOGPage(title: string, description: string, imageUrl: string, pageUrl: string): string {
  const imageTag = imageUrl
    ? `<meta property="og:image" content="${imageUrl}" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
${imageTag}
<meta property="og:url" content="${pageUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="AssoAI" />
<meta name="twitter:card" content="summary_large_image" />
<meta http-equiv="refresh" content="0;url=${pageUrl}" />
</head>
<body>
<p>${title}</p>
<p>${description}</p>
</body>
</html>`;
}

// ============================================================
// SPAWN HERMES
// ============================================================
function spawnHermes(args: string[], profile?: string): Promise<{
  response: { mode: string; textFallback?: string; templateType?: string; data?: unknown };
  tokens?: number;
}> {
  return new Promise((resolve, reject) => {
    // Définir HERMES_HOME pour que les skills soient résolus depuis le profil
    const env = { ...process.env, HOME: '/home/hermeswebui' };
    if (profile) {
      const profileDir = join(PROFILES_DIR, profile);
      env.HERMES_HOME = profileDir;
    }
    const proc = spawn(HERMES_BIN, args, {
      env,
      timeout: 300000,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    proc.on('close', (code: number) => {
      if (code !== 0) {
        console.error(`[hermes-api] Process exited with code ${code}`);
        console.error(`[hermes-api] stderr: ${stderr.slice(0, 500)}`);
      }
      const cleaned = stdout.trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return resolve({
            response: {
              mode: parsed.mode || 'text',
              textFallback: parsed.textFallback || cleaned,
              templateType: parsed.templateType,
              data: parsed.data,
            },
          });
        } catch {}
      }
      resolve({ response: { mode: 'text', textFallback: cleaned || 'Aucune réponse générée.' } });
    });
    proc.on('error', (err: Error) => reject(err));
  });
}

// ============================================================
// OPEN GRAPH — Pages publiques pour crawlers sociaux
// ============================================================

const BASE_URL_OG = 'https://assoai.srv1720118.hstgr.cloud';

// Helper : extraire la première image d'un tableau d'items
function findFirstImage(items: any[], imagePath: string): string {
  if (!Array.isArray(items)) return '';
  for (const item of items) {
    const img = imagePath.split('.').reduce((o, k) => o?.[k], item);
    if (img && typeof img === 'string') return img;
  }
  return '';
}

// Helper : normaliser un UUID (corrige les homoglyphes Unicode → ASCII)
function normalizeUUID(id: string): string {
  // Remplacer les confusables Unicode par leurs équivalents ASCII
  return id
    .normalize('NFKC')                    // Décomposer + recomposer en formes compatibles
    .replace(/[\uFF10-\uFF19]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48)) // ０-９ → 0-9
    .replace(/[\uFF21-\uFF3A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF21 + 65)) // Ａ-Ｚ → A-Z
    .replace(/[\uFF41-\uFF5A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF41 + 97)) // ａ-ｚ → a-z
    .replace(/[\u2160-\u216B]/g, c => String.fromCharCode(0x49 + c.charCodeAt(0) - 0x2160)) // Ⅰ-Ⅻ → I-XII
    .replace(/[\uFF0D\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-'); // tirets Unicode → -
}

// GET /og/checklist/:id
app.get('/og/checklist/:id', async (req, res) => {
  try {
    // Nettoyer et normaliser l'ID (homoglyphes Unicode → ASCII)
    const rawId = (req.params.id || '').split('?')[0];
    const id = normalizeUUID(rawId);
    console.log(`[hermes-api:og] GET /og/checklist/${id.slice(0, 8)}...`);

    const checklist = await fetchSupabase(
      `checklists?id=eq.${id}&select=title,items,task_id,project_id`
    );

    // Fallback: PostgREST peut échouer sur certains UUID (bug connu)
    // → réessayer en récupérant toutes les checklists et en filtrant côté serveur
    if (!checklist.length) {
      console.log(`[hermes-api:og] eq failed for ${id.slice(0,8)}, trying full scan...`);
      const allChecklists = await fetchSupabase(
        `checklists?select=id,title,items,task_id,project_id&limit=200`
      );
      const found = allChecklists.find((c: any) => String(c.id) === id);
      if (found) {
        console.log(`[hermes-api:og] Found via full scan: ${found.title}`);
        // Continuer avec 'found' comme si c'était le résultat normal
        const c = found;
        const items = Array.isArray(c.items) ? c.items : [];
        const done = items.filter((i: any) => i.done).length;
        const total = items.length;
        // ... (le reste du code continue ci-dessous)
        const [projectRes, taskRes, cdcRes, cmdRes] = await Promise.all([
          c.project_id ? fetchSupabase(`projects?id=eq.${c.project_id}&select=name`) : Promise.resolve([] as any[]),
          c.task_id ? fetchSupabase(`project_tasks?id=eq.${c.task_id}&select=assignee,due_date`) : Promise.resolve([] as any[]),
          c.project_id ? fetchSupabase(`messages?project_id=eq.${c.project_id}&template_type=eq.cahier_des_charges&order=created_at.desc&limit=1&select=template_data`) : Promise.resolve([] as any[]),
          c.project_id ? fetchSupabase(`messages?project_id=eq.${c.project_id}&template_type=eq.commande&order=created_at.desc&limit=1&select=template_data`) : Promise.resolve([] as any[]),
        ]);
        const projectName = projectRes[0]?.name || 'Projet';
        const assignee = taskRes[0]?.assignee || '';
        let imageUrl = '';
        if (cdcRes.length) imageUrl = findFirstImage(cdcRes[0]?.template_data?.data?.enseignes || [], 'details.image_url');
        if (!imageUrl && cmdRes.length) imageUrl = findFirstImage(cmdRes[0]?.template_data?.data?.items || [], 'image_url');
        const title = `Checklist — ${projectName}`;
        const desc = `${done}/${total} items complétés${assignee ? ` · ${assignee}` : ''}`;
        const url = `${BASE_URL_OG}/public/checklist/${id}`;
        console.log(`[hermes-api:og] ✅ Checklist "${title}" ${imageUrl ? 'avec image' : 'sans image'}`);
        return res.type('html').send(buildOGPage(title, desc, imageUrl, url));
      }
      console.log(`[hermes-api:og] Checklist ${id.slice(0, 8)} non trouvée`);
      return res.status(404).type('html').send(buildOGPage(
        'Checklist introuvable', 'Ce lien ne correspond à aucune checklist.', '', BASE_URL_OG
      ));
    }

    const c = checklist[0];
    const items = Array.isArray(c.items) ? c.items : [];
    const done = items.filter((i: any) => i.done).length;
    const total = items.length;

    // Lancer toutes les requêtes en parallèle
    const [projectRes, taskRes, cdcRes, cmdRes] = await Promise.all([
      c.project_id
        ? fetchSupabase(`projects?id=eq.${c.project_id}&select=name`)
        : Promise.resolve([] as any[]),
      c.task_id
        ? fetchSupabase(`project_tasks?id=eq.${c.task_id}&select=assignee,due_date`)
        : Promise.resolve([] as any[]),
      c.project_id
        ? fetchSupabase(
            `messages?project_id=eq.${c.project_id}&template_type=eq.cahier_des_charges&order=created_at.desc&limit=1&select=template_data`
          )
        : Promise.resolve([] as any[]),
      c.project_id
        ? fetchSupabase(
            `messages?project_id=eq.${c.project_id}&template_type=eq.commande&order=created_at.desc&limit=1&select=template_data`
          )
        : Promise.resolve([] as any[]),
    ]);

    const projectName = projectRes[0]?.name || 'Projet';
    const assignee = taskRes[0]?.assignee || '';

    // Chercher la première image (CDC prioritaire, commande en fallback)
    let imageUrl = '';
    if (cdcRes.length) {
      imageUrl = findFirstImage(cdcRes[0]?.template_data?.data?.enseignes || [], 'details.image_url');
    }
    if (!imageUrl && cmdRes.length) {
      imageUrl = findFirstImage(cmdRes[0]?.template_data?.data?.items || [], 'image_url');
    }

    const title = `Checklist — ${projectName}`;
    const desc = `${done}/${total} items complétés${assignee ? ` · ${assignee}` : ''}`;
    const url = `${BASE_URL_OG}/public/checklist/${id}`;

    console.log(`[hermes-api:og] ✅ Checklist "${title}" ${imageUrl ? 'avec image' : 'sans image'}`);
    res.type('html').send(buildOGPage(title, desc, imageUrl, url));
  } catch (err: any) {
    console.error(`[hermes-api:og] Erreur checklist:`, err.message);
    res.status(500).type('html').send(buildOGPage(
      'Erreur', 'Une erreur est survenue.', '', BASE_URL_OG
    ));
  }
});

// GET /og/doc/:id
app.get('/og/doc/:id', async (req, res) => {
  try {
    // Nettoyer et normaliser l'ID (homoglyphes Unicode → ASCII)
    const rawId = (req.params.id || '').split('?')[0];
    const id = normalizeUUID(rawId);
    console.log(`[hermes-api:og] GET /og/doc/${id.slice(0, 8)}...`);

    const msg = await fetchSupabase(
      `messages?id=eq.${id}&select=template_type,template_data,project_id`
    );
    if (!msg.length) {
      console.log(`[hermes-api:og] Document ${id.slice(0, 8)} non trouvé`);
      return res.status(404).type('html').send(buildOGPage(
        'Document introuvable', 'Ce lien ne correspond à aucun document.', '', BASE_URL_OG
      ));
    }

    const m = msg[0];
    const tpl = m.template_type;
    const data = m.template_data?.data || {};

    // Requête projet en parallèle
    const projRes = m.project_id
      ? await fetchSupabase(`projects?id=eq.${m.project_id}&select=name`)
      : [];

    const typeLabels: Record<string, string> = {
      facture: 'Facture', devis: 'Devis', commande: 'Commande', cahier_des_charges: 'CDC',
    };
    const typeLabel = typeLabels[tpl] || 'Document';

    let title = 'Document AssoAI';
    let desc = '';
    let imageUrl = '';

    const numKey: Record<string, string> = {
      facture: 'factureNumero', devis: 'devisNumero', commande: 'commandeNumero', cahier_des_charges: 'cdcNumero',
    };
    const num = data[numKey[tpl]] || '';
    const client = data.client?.nom || data.titre || '';

    if (tpl === 'cahier_des_charges') {
      title = `CDC ${num} — ${client}`;
      desc = (data.enseignes || []).map((e: any) => e.nom).join(', ');
      imageUrl = findFirstImage(data.enseignes || [], 'details.image_url');
    } else {
      title = `${typeLabel} ${num} — ${client}`;
      desc = (data.items || data.details || []).map((i: any) => i.nom || i.description).join(', ');
      imageUrl = findFirstImage(data.items || data.details || [], 'image_url');
    }

    const url = `${BASE_URL_OG}/public/doc/${id}`;

    console.log(`[hermes-api:og] ✅ ${typeLabel} "${title}" ${imageUrl ? 'avec image' : 'sans image'}`);
    res.type('html').send(buildOGPage(title, desc, imageUrl, url));
  } catch (err: any) {
    console.error(`[hermes-api:og] Erreur document:`, err.message);
    res.status(500).type('html').send(buildOGPage(
      'Erreur', 'Une erreur est survenue.', '', BASE_URL_OG
    ));
  }
});

// ============================================================
// DÉMARRAGE
// ============================================================
app.listen(PORT, () => {
  console.log(`[hermes-api] v3 — Pré-allocation atomique ACTIVE`);
  console.log(`[hermes-api] Hermes Router → http://localhost:${PORT}`);
  console.log(`[hermes-api] Supabase RPC → ${SUPABASE_URL}/rest/v1/rpc/next_document_number`);
});
