// hermes-api.ts — Serveur Express local pour le routage Hermes
// Expose POST /hermes/router et GET /health sur le port 11434
// Lancement: npx tsx server/hermes-api.ts

import express from 'express';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json({ limit: '5mb' }));

const PORT = 11434;
const HERMES_BIN = '/app/venv/bin/hermes';

// ============================================================
// ROUTEUR PRINCIPAL
// ============================================================
app.post('/hermes/router', async (req, res) => {
  try {
    const { message, userId, sessionId, profile, skills, attachedTemplate, attachedQuote } = req.body;

    if (!message || !profile) {
      return res.status(400).json({ success: false, error: 'message and profile required' });
    }

    console.log(`[hermes-api] → ${profile} (skills: ${(skills || []).join(',') || 'none'})`);

    // Construire le prompt enrichi
    let fullPrompt = message;

    // Ajouter le template attaché comme contexte si présent
    if (attachedTemplate) {
      fullPrompt = `--- TEMPLATE EXISTANT ---\n${JSON.stringify(attachedTemplate, null, 2)}\n--- FIN TEMPLATE ---\n\n${message}`;
    }

    // Ajouter le quote comme contexte si présent
    if (attachedQuote) {
      fullPrompt = `--- DOCUMENT CITÉ ---\n${JSON.stringify(attachedQuote, null, 2)}\n--- FIN CITATION ---\n\n${fullPrompt}`;
    }

    // Appeler Hermes avec le profil approprié
    const hermesArgs = [
      '-p', profile,
      'chat',
      '-q', fullPrompt,
      '--quiet',
      '--pass-session-id',
    ];

    // Ajouter les skills
    if (skills && skills.length > 0) {
      for (const skill of skills) {
        hermesArgs.push('-s', skill);
      }
    }

    const result = await spawnHermes(hermesArgs);

    res.json({
      success: true,
      profile,
      response: result.response,
      tokens: result.tokens,
      skillsUsed: skills || [],
    });

  } catch (error: any) {
    console.error('[hermes-api] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', profiles: ['hermes-wari', 'hermes-brico'] });
});

// ============================================================
// SPAWN HERMES
// ============================================================
function spawnHermes(args: string[]): Promise<{
  response: { mode: string; textFallback?: string; templateType?: string; data?: unknown };
  tokens?: number;
}> {
  return new Promise((resolve, reject) => {
    const proc = spawn(HERMES_BIN, args, {
      env: { ...process.env, HOME: '/home/hermeswebui' },
      timeout: 120000, // 2 minutes max
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code: number) => {
      if (code !== 0) {
        console.error(`[hermes-api] Process exited with code ${code}`);
        console.error(`[hermes-api] stderr: ${stderr.slice(0, 500)}`);
      }

      // Essayer de parser la sortie comme JSON
      const cleaned = stdout.trim();
      
      // Essayer de trouver un JSON dans la sortie
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
        } catch {
          // Pas un JSON valide — retourner comme texte
        }
      }

      // Fallback: retourner la sortie comme réponse textuelle
      resolve({
        response: {
          mode: 'text',
          textFallback: cleaned || 'Aucune réponse générée.',
        },
      });
    });

    proc.on('error', (err: Error) => {
      reject(err);
    });
  });
}

// ============================================================
// DÉMARRAGE
// ============================================================
app.listen(PORT, () => {
  console.log(`[hermes-api] Hermes Router → http://localhost:${PORT}`);
  console.log(`[hermes-api] Endpoints:`);
  console.log(`  POST /hermes/router  — Route un message vers le bon profil`);
  console.log(`  GET  /health          — Vérifie l'état du serveur`);
});
