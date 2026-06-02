# AssoAI — Workflows n8n à Reconstruire

Ce document décrit les deux workflows n8n nécessaires au fonctionnement de l'application AssoAI.

---

## 🟢 WORKFLOW 1 : Webhook Chat IA

**Type** : Webhook (POST)  
**URL cible** : `/webhook/chat` (à configurer dans n8n)  
**Timeout** : 15 min (standard) / 30 min (sessions projet, sessionId commence par `project_`)

### Étape 1 — Webhook Receiver
- Node : `Webhook` (POST)
- Response Mode : `When Last Node Finishes`
- Méthode : POST
- Path : `chat`

### Étape 2 — Validation
- Node : `Code` (JavaScript)
```javascript
const body = $input.item.json;

// Validation des champs obligatoires
if (!body.userId || !body.sessionId || !body.message) {
  throw new Error("Champs obligatoires manquants: userId, sessionId, message");
}

const msg = body.message;
const type = msg.type;
const content = msg.content || "";
const template = msg.template || null;
const quote = msg.quote || null;
const attachments = msg.attachments || [];
const guidelines = msg.promptGuidelines || null;

// Détection mode projet
const isProject = body.sessionId.startsWith("project_");

return {
  userId: body.userId,
  sessionId: body.sessionId,
  timestamp: body.timestamp,
  type,
  content,
  template,
  quote,
  attachments,
  guidelines,
  isProject,
  hasTemplate: !!template,
  hasQuote: !!quote
};
```

### Étape 3 — Construction du Prompt IA
- Node : `Code` (JavaScript)
```javascript
const item = $input.item.json;
let systemPrompt = `Tu es AssoAI, un assistant spécialisé dans la création de documents d'affaires pour une entreprise de signalétique/enseignes. 

Tu peux créer et modifier les types de documents suivants :
- facture : numéro F-YYYY-NNN, client, détails (description, quantité, prix unitaire), total
- devis : numéro D-YYYY-NNN, client, validité en jours, détails, total
- commande : numéro CMD-..., client, articles, statut
- cahier_des_charges : titre, enseignes (multiples), équipe, matériaux

Réponds TOUJOURS au format JSON suivant :
{
  "mode": "text" ou "template",
  "textFallback": "réponse textuelle",
  "templateType": "facture"|"devis"|"commande"|"cahier_des_charges",
  "data": { ... données du template ... },
  "metadata": {
    "displayName": "Nom affiché",
    "description": "Description",
    "availableActions": ["save", "download", "edit", "pdf"],
    "mode": "editable",
    "source": "chatMessage"
  }
}

Si l'utilisateur demande un document, réponds en mode "template" avec les données complètes.
Sinon, réponds en mode "text" avec une réponse utile.`;

let userPrompt = item.content;

// Ajouter le contexte du template si présent
if (item.hasTemplate) {
  userPrompt += "\n\n--- TEMPLATE EXISTANT ---\n" + JSON.stringify(item.template, null, 2);
  userPrompt += "\n\nModifie ce template selon la demande de l'utilisateur.";
}

// Ajouter le contexte de la citation si présente
if (item.hasQuote) {
  userPrompt += "\n\n--- DOCUMENT CITÉ ---\n" + JSON.stringify(item.quote, null, 2);
}

// Ajouter les guidelines
if (item.guidelines) {
  systemPrompt += "\n\nGUIDELINES: " + item.guidelines.description;
}

return {
  system: systemPrompt,
  user: userPrompt,
  sessionId: item.sessionId,
  userId: item.userId,
  timestamp: item.timestamp
};
```

### Étape 4 — Appel IA (OpenAI / Claude / Gemini)
- Node : `OpenAI Chat Model` (ou `Anthropic Chat Model` ou `Google Gemini Chat Model`)
- Model : GPT-4o / Claude Sonnet 4 / Gemini 2.0 Flash
- Temperature : 0.3
- Max Tokens : 4096
- System Prompt : `{{ $json.system }}`
- Messages : User = `{{ $json.user }}`

### Étape 5 — Parsing de la réponse
- Node : `Code` (JavaScript)
```javascript
const items = $input.all();
const result = items[0].json;
let parsed;

try {
  // Essayer de parser la réponse JSON
  const content = result.message?.content || result.choices?.[0]?.message?.content || result;
  parsed = JSON.parse(content);
} catch (e) {
  // Si pas du JSON, retourner en mode texte
  parsed = {
    mode: "text",
    textFallback: result.message?.content || result.choices?.[0]?.message?.content || String(result)
  };
}

// Construire le ResponsePayload
const responsePayload = {
  agentId: "assoai-agent",
  sessionId: $input.item.json.sessionId,
  timestamp: new Date().toISOString(),
  response: {
    mode: parsed.mode || "text",
    textFallback: parsed.textFallback || "",
    templateType: parsed.templateType || undefined,
    data: parsed.data || undefined,
    metadata: parsed.metadata || {
      displayName: "Document",
      availableActions: ["save", "download"],
      mode: "editable",
      source: "chatMessage"
    }
  }
};

return responsePayload;
```

### Étape 6 — Réponse
- Node : `Respond to Webhook`
- Format : JSON
- Body : `{{ $json }}`

---

## 🔴 WORKFLOW 2 : Génération PDF/Image

**Type** : Webhook (POST)  
**Timeout** : 15 min

### Étape 1 — Webhook Receiver
- Node : `Webhook` (POST)
- Path : `pdf`

### Étape 2 — Validation
- Node : `Code`
```javascript
const body = $input.item.json;
if (!body.templateType || !body.data) {
  throw new Error("templateType et data requis");
}
return body;
```

### Étape 3 — Construction HTML selon le type
- Node : `Code` (JavaScript)
```javascript
const { templateType, data, generationType } = $input.item.json;

function buildFactureHTML(d) {
  const rows = (d.details || []).map(item => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align:center">${item.quantite}</td>
      <td style="text-align:right">${item.prixUnitaire?.toFixed(2)} €</td>
      <td style="text-align:right">${item.sous_total?.toFixed(2)} €</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1B2A34; }
    .header { display:flex; justify-content:space-between; margin-bottom:30px; }
    .header h1 { color: #FF8139; font-size: 28px; }
    .numero { font-size: 16px; color: #666; }
    .client { margin-bottom: 30px; padding: 15px; background: #FFF3ED; border-radius: 8px; }
    table { width:100%; border-collapse:collapse; margin:20px 0; }
    th { background: #FF8139; color: white; padding:10px; text-align:left; }
    td { padding:10px; border-bottom:1px solid #eee; }
    .total { text-align:right; font-size:20px; font-weight:bold; margin-top:20px; color: #FF8139; }
    .footer { margin-top:40px; font-size:12px; color:#999; text-align:center; }
  </style></head><body>
    <div class="header">
      <div><h1>FACTURE</h1><p>AssoAI — Signalétique</p></div>
      <div class="numero">N° ${d.factureNumero}<br>${d.dateEmission || ''}</div>
    </div>
    <div class="client">
      <strong>Client :</strong> ${d.client?.nom || ''}<br>
      ${d.client?.adresse || ''}<br>
      ${d.client?.telephone ? 'Tél : ' + d.client.telephone : ''}
    </div>
    <table>
      <tr><th>Description</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix U.</th><th style="text-align:right">Sous-total</th></tr>
      ${rows}
    </table>
    <div class="total">Total : ${(d.total || 0).toFixed(2)} €</div>
    ${d.delaiLivraison ? '<p>Délai de livraison : ' + d.delaiLivraison + '</p>' : ''}
    <div class="footer">AssoAI — Document généré automatiquement</div>
  </body></html>`;
}

function buildDevisHTML(d) {
  const rows = (d.details || []).map(item => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align:center">${item.quantite}</td>
      <td style="text-align:right">${item.prixUnitaire?.toFixed(2)} €</td>
      <td style="text-align:right">${item.sous_total?.toFixed(2)} €</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1B2A34; }
    .header { display:flex; justify-content:space-between; margin-bottom:30px; }
    .header h1 { color: #FF8139; font-size: 28px; }
    .validite { font-size:14px; color:#666; margin-top:5px; }
    .client { margin-bottom: 30px; padding: 15px; background: #FFF3ED; border-radius: 8px; }
    table { width:100%; border-collapse:collapse; margin:20px 0; }
    th { background: #FF8139; color: white; padding:10px; text-align:left; }
    td { padding:10px; border-bottom:1px solid #eee; }
    .total { text-align:right; font-size:20px; font-weight:bold; margin-top:20px; color: #FF8139; }
    .footer { margin-top:40px; font-size:12px; color:#999; text-align:center; }
  </style></head><body>
    <div class="header">
      <div><h1>DEVIS</h1><p>AssoAI — Signalétique</p></div>
      <div>N° ${d.devisNumero}<br>${d.dateEmission || ''}</div>
    </div>
    <div class="validite">Valable ${d.validiteJours || 30} jours</div>
    <div class="client">
      <strong>Client :</strong> ${d.client?.nom || ''}<br>
      ${d.client?.adresse || ''}<br>
      ${d.client?.telephone ? 'Tél : ' + d.client.telephone : ''}
    </div>
    <table>
      <tr><th>Description</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix U.</th><th style="text-align:right">Sous-total</th></tr>
      ${rows}
    </table>
    <div class="total">Total : ${(d.total || 0).toFixed(2)} €</div>
    <div class="footer">AssoAI — Document généré automatiquement</div>
  </body></html>`;
}

function buildCommandeHTML(d) {
  const rows = (d.items || []).map(item => `
    <tr>
      <td>${item.nom}</td>
      <td style="text-align:center">${item.quantite}</td>
      <td style="text-align:right">${item.prixUnitaire?.toFixed(2)} €</td>
      <td style="text-align:right">${item.sous_total?.toFixed(2)} €</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1B2A34; }
    .header { display:flex; justify-content:space-between; margin-bottom:30px; }
    .header h1 { color: #FF8139; font-size: 28px; }
    .statut { display:inline-block; padding:5px 15px; background:#FF8139; color:white; border-radius:20px; font-size:14px; }
    .client { margin-bottom: 30px; padding: 15px; background: #FFF3ED; border-radius: 8px; }
    table { width:100%; border-collapse:collapse; margin:20px 0; }
    th { background: #FF8139; color: white; padding:10px; text-align:left; }
    td { padding:10px; border-bottom:1px solid #eee; }
    .total { text-align:right; font-size:20px; font-weight:bold; margin-top:20px; color: #FF8139; }
    .footer { margin-top:40px; font-size:12px; color:#999; text-align:center; }
  </style></head><body>
    <div class="header">
      <div><h1>COMMANDE</h1><p>AssoAI — Signalétique</p></div>
      <div>N° ${d.commandeNumero}<br>${d.dateCommande || ''}</div>
    </div>
    <div class="statut">${d.statut || 'En cours'}</div>
    <div class="client">
      <strong>Client :</strong> ${d.client?.nom || ''}<br>
      ${d.client?.adresse || ''}<br>
      ${d.client?.telephone ? 'Tél : ' + d.client.telephone : ''}
    </div>
    <table>
      <tr><th>Article</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix U.</th><th style="text-align:right">Sous-total</th></tr>
      ${rows}
    </table>
    <div class="total">Total : ${(d.total || 0).toFixed(2)} €</div>
    ${d.dateLivraison ? '<p>Livraison prévue : ' + d.dateLivraison + '</p>' : ''}
    <div class="footer">AssoAI — Document généré automatiquement</div>
  </body></html>`;
}

function buildCahierHTML(d) {
  const enseignesHTML = (d.enseignes || []).map(e => `
    <div style="border:2px solid #FF8139; border-radius:8px; padding:15px; margin:10px 0;">
      <h3>🏗️ ${e.nom}</h3>
      <p><strong>Dimensions :</strong> ${e.details?.dimensions?.largeur || '-'} × ${e.details?.dimensions?.hauteur || '-'} cm</p>
      <p><strong>Structure :</strong> ${e.details?.technique?.type_structure || '-'}</p>
      <p><strong>Fabrication :</strong> ${e.details?.technique?.method_fabrication || '-'}</p>
      ${e.produits?.length ? '<p><strong>Produits :</strong> ' + e.produits.map(p => p.nom).join(', ') + '</p>' : ''}
    </div>
  `).join('');

  const equipeHTML = (d.equipe || []).map(m => `
    <tr><td>${m.name}</td><td>${m.role}</td><td>${m.email || ''}</td></tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1B2A34; }
    h1 { color: #FF8139; font-size: 28px; }
    h2 { color: #1B2A34; border-bottom: 2px solid #FF8139; padding-bottom:5px; margin-top:30px; }
    table { width:100%; border-collapse:collapse; margin:20px 0; }
    th { background: #FF8139; color: white; padding:10px; text-align:left; }
    td { padding:10px; border-bottom:1px solid #eee; }
    .footer { margin-top:40px; font-size:12px; color:#999; text-align:center; }
  </style></head><body>
    <h1>CAHIER DES CHARGES</h1>
    <p style="font-size:18px; color:#666;">${d.titre || 'Projet'}</p>
    
    <h2>Enseignes (${(d.enseignes || []).length})</h2>
    ${enseignesHTML}
    
    <h2>Équipe</h2>
    <table>
      <tr><th>Nom</th><th>Rôle</th><th>Email</th></tr>
      ${equipeHTML}
    </table>
    
    <div class="footer">AssoAI — Document généré automatiquement</div>
  </body></html>`;
}

let html;
switch(templateType) {
  case "facture": html = buildFactureHTML(data); break;
  case "devis": html = buildDevisHTML(data); break;
  case "commande": html = buildCommandeHTML(data); break;
  case "cahier_des_charges": html = buildCahierHTML(data); break;
  default: throw new Error("Type de template non supporté: " + templateType);
}

return { html, templateType, generationType: generationType || "pdf" };
```

### Étape 4 — Génération du document
- Si `generationType = "pdf"` :
  - Node : `HTML to PDF` (Puppeteer)
  - Format : A4
  - Landscape : false
  
- Si `generationType = "image"` :
  - Node : `HTML to Image` (ou `HTML Extract` + `Convert to Image`)
  - Format : PNG
  - Full Page : true

### Étape 5 — Upload vers stockage
- Node : `Google Cloud Storage` (ou `Supabase Storage`)
- Bucket : `documents`
- Path : `pdfs/${templateType}_${Date.now()}.pdf`
- Make Public : true

### Étape 6 — Construction de la réponse
- Node : `Code`
```javascript
const item = $input.item.json;
const fileUrl = item.url || item.publicUrl || '';

return {
  success: true,
  status: "ok",
  url: fileUrl,
  pdfUrl: fileUrl,
  downloadUrl: fileUrl,
  filename: item.filename || `document_${Date.now()}.pdf`,
  templateType: $input.item.json.templateType,
  documentNumber: item.documentNumber || ''
};
```

### Étape 7 — Réponse
- Node : `Respond to Webhook`
- Format : JSON

---

## 🚀 DÉPLOIEMENT N8N

Options :
1. **n8n Cloud** (n8n.io) — payant, géré
2. **Self-hosted** via Docker — recommandé :
   ```bash
   docker run -d --name n8n -p 5678:5678 \
     -v n8n_data:/home/node/.n8n \
     -e N8N_SECURE_COOKIE=false \
     n8nio/n8n
   ```
3. **Elestio / Railway / Render** — déploiement one-click

Une fois déployé, importer les workflows via l'interface n8n ou copier le JSON.
