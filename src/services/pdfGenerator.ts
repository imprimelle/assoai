// pdfGenerator.ts — Génération PDF côté client + microservice Puppeteer
// Style Imprimelle Côte d'Ivoire — Juin 2026
import type { TemplateType, FactureData, DevisData, CommandeData, CahierDesChargesData } from "@/types";
import { appLogger } from "@/utils/logger";
import { formatCFA } from "@/utils/format";

import { LOGO_BASE64 } from "./logo-base64";

// ──────────────────────────────────────────────
// Constantes marque Imprimelle
// ──────────────────────────────────────────────
const LOGO_URL = LOGO_BASE64; // logo embarqué en base64 — pas de requête réseau

const COMPANY = {
  name: "IMPRIMELLE CÔTE D'IVOIRE",
  address: "Bingerville, nouvelle gare",
  phones: ["(+225) 0102656626", "(+225) 2522010330"],
};

const COLORS = {
  orange: "#F4A261",
  blue: "#274293",
  green: "#2E7D32",
  bg: "#f9f9f9",
  text: "#333",
  border: "#ddd",
  modalOrange: "#f39700",
};

// ──────────────────────────────────────────────
// Styles CSS partagés (inline car Puppeteer)
// ──────────────────────────────────────────────
const SHARED_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Roboto', sans-serif;
    color: ${COLORS.text};
    background: ${COLORS.bg};
    line-height: 1.5;
  }
  .top-bar {
    background-color: ${COLORS.orange};
    height: 8px;
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 10;
  }
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 30px 20px;
    background: white;
    min-height: 100vh;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid ${COLORS.border};
    padding-bottom: 12px;
    margin-bottom: 12px;
    margin-top: 8px;
  }
  .company-info { font-size: 13px; color: #555; line-height: 1.6; }
  .company-info strong { font-size: 15px; color: ${COLORS.blue}; }
  .company-info p { margin: 2px 0; }
  .logo img { max-width: 220px; height: auto; }

  h1 {
    font-family: 'Open Sans', sans-serif;
    color: ${COLORS.blue};
    font-size: 26px;
    margin: 14px 0 6px;
    font-weight: 600;
  }
  .subtitle {
    font-size: 14px;
    color: #777;
    margin-bottom: 16px;
  }

  .info-cols {
    display: flex;
    gap: 16px;
    margin-bottom: 18px;
  }
  .info-box {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid ${COLORS.border};
    border-radius: 6px;
    font-size: 14px;
  }
  .info-box p { margin: 4px 0; }
  .info-box strong { color: ${COLORS.blue}; }

  .project-line {
    font-size: 16px;
    color: ${COLORS.blue};
    margin-bottom: 18px;
    font-weight: 500;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 14px;
  }
  table th, table td {
    padding: 10px 12px;
    text-align: left;
    border: 1px solid ${COLORS.border};
  }
  table th {
    background-color: ${COLORS.blue};
    color: white;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  table tr:nth-child(even) td {
    background-color: #fafafa;
  }
  .desc-col { width: 50%; }
  .num-col { width: 50px; text-align: center; }
  .price-col { width: 90px; text-align: right; }
  .total-col { width: 100px; text-align: right; }

  .totals {
    text-align: right;
    font-size: 15px;
    margin-top: 16px;
    padding-right: 4px;
    border-top: 2px solid ${COLORS.border};
    padding-top: 12px;
  }
  .totals p { margin: 4px 0; }
  .totals .sub { color: #666; }
  .totals .discount { color: ${COLORS.modalOrange}; font-weight: 500; }
  .final-price {
    display: inline-block;
    background-color: ${COLORS.green};
    color: white;
    font-size: 17px;
    font-weight: bold;
    padding: 8px 18px;
    border-radius: 4px;
    margin-top: 12px;
  }

  .info-line {
    font-size: 14px;
    color: #555;
    margin: 8px 0;
  }
  .payment-box {
    margin: 18px 0;
    font-size: 15px;
    font-weight: 500;
    color: ${COLORS.modalOrange};
    padding: 8px 0;
    border-top: 1px dashed ${COLORS.orange};
    border-bottom: 1px dashed ${COLORS.orange};
  }

  .enseigne-card {
    border: 1px solid ${COLORS.orange};
    border-left: 4px solid ${COLORS.orange};
    border-radius: 6px;
    padding: 10px 14px;
    margin: 8px 0;
    font-size: 13px;
  }
  .enseigne-card h3 {
    color: ${COLORS.blue};
    font-size: 14px;
    margin-bottom: 6px;
  }
  .enseigne-card .meta {
    font-size: 12px;
    color: #666;
    margin: 3px 0;
  }
  .section-title {
    font-family: 'Open Sans', sans-serif;
    color: ${COLORS.blue};
    border-bottom: 2px solid ${COLORS.orange};
    padding-bottom: 4px;
    margin: 20px 0 10px;
    font-size: 15px;
    font-weight: 600;
  }

  .product-image {
    max-width: 60px;
    max-height: 60px;
    border-radius: 4px;
    vertical-align: middle;
    margin-right: 6px;
  }

  /* ── Cahier des Charges: layout deux colonnes ── */
  .cdc-header-box {
    text-align: left;
    background-color: ${COLORS.blue};
    color: #fff;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.6;
  }
  .cdc-header-box .cdc-num {
    font-size: 18px;
    font-weight: 700;
    text-transform: uppercase;
    display: block;
    margin-bottom: 2px;
  }
  .cdc-header-box .cdc-date {
    font-size: 13px;
    opacity: 0.9;
  }

  .enseigne-section {
    margin: 18px 0;
    border: 1px solid ${COLORS.border};
    border-radius: 8px;
    overflow: hidden;
  }
  .enseigne-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }
  .enseigne-table td {
    vertical-align: middle;
    padding: 14px 16px;
    border: none;
  }
  .enseigne-name-cell {
    width: 60%;
    text-transform: uppercase;
    font-size: 20px;
    color: ${COLORS.blue};
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .enseigne-image-cell {
    width: 40%;
    text-align: center;
  }
  .enseigne-image-cell img {
    max-width: 100%;
    max-height: 180px;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
  }

  .materials-block {
    padding: 0 16px 12px;
  }
  .materials-block h3 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    background-color: ${COLORS.orange};
    padding: 8px 12px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .materials-block ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .materials-block ul li {
    padding: 6px 8px;
    border-bottom: 1px solid ${COLORS.border};
    font-size: 13px;
    color: #444;
  }
  .materials-block ul li:last-child {
    border-bottom: none;
  }
  .tech-info {
    padding: 8px 16px 14px;
    font-size: 13px;
    color: #555;
  }
  .tech-info p {
    margin: 3px 0;
  }
  .tech-info strong {
    color: ${COLORS.blue};
  }

  .status-badge {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .status-brouillon { background: #eee; color: #666; }
  .status-valide { background: #e8f5e9; color: ${COLORS.green}; }
  .status-attente { background: #fff3e0; color: ${COLORS.modalOrange}; }
  .status-livre { background: #e3f2fd; color: ${COLORS.blue}; }

  .footer {
    margin-top: 30px;
    font-size: 13px;
    color: #999;
    text-align: center;
    border-top: 1px solid ${COLORS.border};
    padding-top: 12px;
  }
  .footer p { margin: 2px 0; }
  .footer strong { color: #666; }

  @media print {
    body { background: white; }
    .container { box-shadow: none; }
  }
`;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function esc(html: string): string {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(statut?: string): string {
  const s = (statut || "").toLowerCase();
  if (s.includes("valide") || s.includes("payé") || s.includes("accepté")) return "status-valide";
  if (s.includes("attente") || s.includes("vérif") || s.includes("brouillon")) return "status-attente";
  if (s.includes("livré")) return "status-livre";
  return "status-brouillon";
}

function statusLabel(statut?: string): string {
  return statut || "Brouillon";
}

function headerHTML(): string {
  return `
<header>
  <div class="company-info">
    <p><strong>${COMPANY.name}</strong></p>
    <p>${COMPANY.address}</p>
    ${COMPANY.phones.map((p) => `<p>${p}</p>`).join("")}
  </div>
  <div class="logo">
    <img src="${LOGO_URL}" alt="Logo Imprimelle" />
  </div>
</header>`;
}

function clientBoxHTML(client: { nom: string; adresse?: string; telephone?: string }): string {
  return `
<div class="info-box">
  <p>Facture pour : <strong>${esc(client.nom || "—")}</strong></p>
  ${client.adresse ? `<p>Adresse : <strong>${esc(client.adresse)}</strong></p>` : ""}
  ${client.telephone ? `<p>Contact : <strong>${esc(client.telephone)}</strong></p>` : ""}
</div>`;
}

function formatPrice(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ──────────────────────────────────────────────
// Builders par type de document
// ──────────────────────────────────────────────

// ── FACTURE PROFORMA ──────────────────────────
function buildFactureHTML(d: FactureData): string {
  const rows = (d.details || [])
    .map(
      (i) => `
    <tr>
      <td class="desc-col">${esc(i.description)}</td>
      <td class="num-col">${i.quantite}</td>
      <td class="price-col">${formatPrice(Number(i.prixUnitaire))} F</td>
      <td class="total-col">${formatPrice(Number(i.sous_total))} F</td>
    </tr>`,
    )
    .join("");

  const baseTotal = (d.details || []).reduce((s, i) => s + Number(i.sous_total || 0), 0);
  const discount = Number(d.reduction || 0);
  const total = Number(d.total || baseTotal - discount);
  const discountPct = baseTotal > 0 ? Math.round((discount / baseTotal) * 100) : 0;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Facture ${esc(d.factureNumero)}</title><style>${SHARED_STYLES}</style></head>
<body>
<div class="top-bar"></div>
<div class="container">
  ${headerHTML()}
  <h1>FACTURE PROFORMA</h1>
  <div class="subtitle">N° ${esc(d.factureNumero)} — ${d.dateEmission ? new Date(d.dateEmission).toLocaleDateString("fr-FR") : ""}</div>

  ${d.statut ? `<div class="status-badge ${statusClass(d.statut)}">${statusLabel(d.statut)}</div>` : ""}

  <div class="info-cols">
    ${clientBoxHTML(d.client)}
    <div class="info-box">
      <p>Date : <strong>${d.dateEmission ? new Date(d.dateEmission).toLocaleDateString("fr-FR") : "—"}</strong></p>
      <p>N° facture : <strong>${esc(d.factureNumero)}</strong></p>
      ${d.delaiLivraison ? `<p>Délai : <strong>${esc(d.delaiLivraison)}</strong></p>` : ""}
      ${d.echeancier ? `<p>Échéancier : <strong>${esc(d.echeancier)}</strong></p>` : ""}
    </div>
  </div>

  ${d.deliveryAddress?.rue ? `<div class="info-line">📍 Livraison : ${esc(d.deliveryAddress.rue)}, ${esc(d.deliveryAddress.ville || "")}</div>` : ""}

  <table>
    <thead><tr>
      <th class="desc-col">Description</th>
      <th class="num-col">Nbre</th>
      <th class="price-col">Prix U.</th>
      <th class="total-col">Prix Total</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999">Aucun article</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <p class="sub">Sous-total : <strong>${formatPrice(baseTotal)} F</strong></p>
    ${discount > 0 ? `<p class="discount">Remise : <strong>−${formatPrice(discount)} F</strong> (${discountPct}%)</p>` : ""}
    <p class="final-price">Total : <strong>${formatPrice(total)} F</strong></p>
  </div>

  ${d.delaiLivraison ? `<div class="payment-box">🚚 Délai de livraison : <strong>${esc(d.delaiLivraison)}</strong></div>` : ""}

  <div class="footer">
    <p>Merci d'avance pour votre achat !</p>
    <p><strong>IMPRIMELLE CÔTE D'IVOIRE</strong> — Bingerville, nouvelle gare</p>
  </div>
</div>
</body></html>`;
}

// ── DEVIS ─────────────────────────────────────
function buildDevisHTML(d: DevisData): string {
  const rows = (d.details || [])
    .map(
      (i) => `
    <tr>
      <td class="desc-col">${esc(i.description)}</td>
      <td class="num-col">${i.quantite}</td>
      <td class="price-col">${formatPrice(Number(i.prixUnitaire))} F</td>
      <td class="total-col">${formatPrice(Number(i.sous_total))} F</td>
    </tr>`,
    )
    .join("");

  const baseTotal = (d.details || []).reduce((s, i) => s + Number(i.sous_total || 0), 0);
  const total = Number(d.total || baseTotal);

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Devis ${esc(d.devisNumero)}</title><style>${SHARED_STYLES}</style></head>
<body>
<div class="top-bar"></div>
<div class="container">
  ${headerHTML()}
  <h1>DEVIS</h1>
  <div class="subtitle">N° ${esc(d.devisNumero)} — ${d.dateEmission ? new Date(d.dateEmission).toLocaleDateString("fr-FR") : ""}</div>

  ${d.statut ? `<div class="status-badge ${statusClass(d.statut)}">${statusLabel(d.statut)}</div>` : ""}

  <div class="info-cols">
    ${clientBoxHTML(d.client)}
    <div class="info-box">
      <p>Date : <strong>${d.dateEmission ? new Date(d.dateEmission).toLocaleDateString("fr-FR") : "—"}</strong></p>
      <p>N° devis : <strong>${esc(d.devisNumero)}</strong></p>
      <p>Validité : <strong>${d.validiteJours || 30} jours</strong></p>
      ${d.type_structure ? `<p>Structure : <strong>${esc(d.type_structure)}</strong></p>` : ""}
      ${d.method_fabrication ? `<p>Fabrication : <strong>${esc(d.method_fabrication)}</strong></p>` : ""}
    </div>
  </div>

  <table>
    <thead><tr>
      <th class="desc-col">Description</th>
      <th class="num-col">Nbre</th>
      <th class="price-col">Prix U.</th>
      <th class="total-col">Prix Total</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999">Aucun article</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <p class="sub">Sous-total : <strong>${formatPrice(baseTotal)} F</strong></p>
    <p class="final-price">Total : <strong>${formatPrice(total)} F</strong></p>
  </div>

  ${d.deliveryAddress?.rue ? `<div class="info-line">📍 Livraison : ${esc(d.deliveryAddress.rue)}, ${esc(d.deliveryAddress.ville || "")}</div>` : ""}

  <div class="footer">
    <p>Ce devis est valable ${d.validiteJours || 30} jours à compter de la date d'émission.</p>
    <p><strong>IMPRIMELLE CÔTE D'IVOIRE</strong> — Bingerville, nouvelle gare</p>
  </div>
</div>
</body></html>`;
}

// ── COMMANDE ──────────────────────────────────
function buildCommandeHTML(d: CommandeData): string {
  const rows = (d.items || [])
    .map(
      (i) => `
    <tr>
      <td class="desc-col">
        ${i.image_url ? `<img class="product-image" src="${esc(i.image_url)}" alt="" />` : ""}
        ${esc(i.nom)}
      </td>
      <td class="num-col">${i.quantite}</td>
      <td class="price-col">${formatPrice(Number(i.prixUnitaire))} F</td>
      <td class="total-col">${formatPrice(Number(i.sous_total))} F</td>
    </tr>`,
    )
    .join("");

  const baseTotal = (d.items || []).reduce((s, i) => s + Number(i.sous_total || 0), 0);
  const total = Number(d.total || baseTotal);

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Commande ${esc(d.commandeNumero)}</title><style>${SHARED_STYLES}</style></head>
<body>
<div class="top-bar"></div>
<div class="container">
  ${headerHTML()}
  <h1>COMMANDE</h1>
  <div class="subtitle">N° ${esc(d.commandeNumero)} — ${d.dateCommande ? new Date(d.dateCommande).toLocaleDateString("fr-FR") : ""}</div>

  ${d.statut ? `<div class="status-badge ${statusClass(d.statut)}">${statusLabel(d.statut)}</div>` : ""}

  <div class="info-cols">
    ${clientBoxHTML(d.client)}
    <div class="info-box">
      <p>Date commande : <strong>${d.dateCommande ? new Date(d.dateCommande).toLocaleDateString("fr-FR") : "—"}</strong></p>
      <p>N° commande : <strong>${esc(d.commandeNumero)}</strong></p>
      ${d.dateLivraison ? `<p>Livraison prévue : <strong>${esc(d.dateLivraison)}</strong></p>` : ""}
      ${d.linked_facture_id ? `<p>Facture liée : <strong>${esc(d.linked_facture_id)}</strong></p>` : ""}
    </div>
  </div>

  <table>
    <thead><tr>
      <th class="desc-col">Article</th>
      <th class="num-col">Nbre</th>
      <th class="price-col">Prix U.</th>
      <th class="total-col">Prix Total</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999">Aucun article</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <p class="sub">Sous-total : <strong>${formatPrice(baseTotal)} F</strong></p>
    <p class="final-price">Total : <strong>${formatPrice(total)} F</strong></p>
  </div>

  ${d.deliveryAddress?.rue ? `<div class="info-line">📍 Livraison : ${esc(d.deliveryAddress.rue)}, ${esc(d.deliveryAddress.ville || "")}</div>` : ""}

  ${(d.details || []).length > 0 ? `
  <div class="payment-box">
    ${d.details.map((det: any) => {
      let parts = [];
      if (det.note) parts.push(`📝 ${esc(det.note)}`);
      if (det.option) parts.push(`🔧 ${esc(det.option)}`);
      if (det.delaiLivraison) parts.push(`🚚 ${esc(det.delaiLivraison)}`);
      if (det.montantAvance) parts.push(`💰 Avance : ${formatPrice(det.montantAvance)} F`);
      return parts.join(" | ");
    }).join("<br>")}
  </div>` : ""}

  <div class="footer">
    <p>Merci de votre confiance !</p>
    <p><strong>IMPRIMELLE CÔTE D'IVOIRE</strong> — Bingerville, nouvelle gare</p>
  </div>
</div>
</body></html>`;
}

// ── CAHIER DES CHARGES ───────────────────────
function buildCahierHTML(d: CahierDesChargesData): string {

  // Bâtir chaque enseigne avec layout 2 colonnes
  const ensSections = (d.enseignes || []).map((e) => {
    const hasImage = !!e.details?.image_url;
    const dims = e.details?.dimensions;
    const tech = e.details?.technique;

    // Matériaux : priorité aux materiauxSections de l'enseigne
    const mats = e.materiauxSections || {};

    return `
    <div class="enseigne-section">
      <table class="enseigne-table">
        <tr>
          <td class="enseigne-name-cell">${esc(e.nom)}</td>
          ${hasImage ? `<td class="enseigne-image-cell"><img src="${esc(e.details!.image_url!)}" alt="${esc(e.nom)}" /></td>` : `<td class="enseigne-image-cell"></td>`}
        </tr>
      </table>

      ${dims ? `
      <div class="tech-info">
        <p><strong>Dimensions :</strong> ${dims.largeur || "—"} × ${dims.hauteur || "—"} cm${dims.profondeur ? ` × ${dims.profondeur} cm` : ""}</p>
        ${tech ? `<p><strong>Structure :</strong> ${esc(tech.type_structure || "—")} | <strong>Fabrication :</strong> ${esc(tech.method_fabrication || "—")}</p>` : ""}
      </div>` : ""}

      ${e.produits?.length ? `
      <div class="tech-info">
        <p><strong>Produits :</strong> ${e.produits.map((p) => esc(p.nom)).join(", ")}</p>
      </div>` : ""}

      ${Object.keys(mats).length > 0 ? `
      <div class="materials-block">
        <h3>Matériaux requis</h3>
        <ul>
          ${Object.entries(mats).map(([section, items]) =>
            items.map((m: any) => `
          <li>${esc(m.nom || m.description || "—")}${m.dimensions || m.dimension ? ` (${esc(m.dimensions || m.dimension || "")})` : ""}${m.quantite ? ` — Quantité : ${m.quantite} ${m.unite || "pièce"}` : ""}${section ? ` <em style="color:#999;font-size:12px">[${esc(section)}]</em>` : ""}</li>`
            ).join("")
          ).join("")}
        </ul>
      </div>` : ""}
    </div>`;
  }).join("");

  // Matériaux legacy (si non couverts par les enseignes)
  const hasLegacyMats = d.materiauxSections && Object.keys(d.materiauxSections).length > 0;
  const legacyMatsBlock = hasLegacyMats ? `
    <div class="materials-block" style="margin-top:12px">
      <h3>Matériaux globaux</h3>
      <ul>
        ${Object.entries(d.materiauxSections!).map(([section, items]) =>
          items.map((m: any) => `
        <li>${esc(m.nom || m.description || "—")}${m.quantite ? ` — ${m.quantite} ${m.unite || "pièce"}` : ""} <em style="color:#999;font-size:12px">[${esc(section)}]</em></li>`
          ).join("")
        ).join("")}
      </ul>
    </div>` : "";

  // Équipe
  const eqRows = (d.equipe || []).map((m) => `
    <tr>
      <td>${esc(m.nom || "—")}</td>
      <td>${esc(m.role || "—")}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Cahier des Charges — ${esc(d.titre)}</title><style>${SHARED_STYLES}</style></head>
<body>
<div class="top-bar"></div>
<div class="container">

  <!-- Header: logo à gauche, titre CDC à droite -->
  <header style="border-bottom:none;margin-bottom:18px">
    <div class="logo">
      <img src="${LOGO_URL}" alt="Logo Imprimelle" style="max-width:160px" />
    </div>
    <div class="cdc-header-box">
      <span class="cdc-num">CAHIER DES CHARGES — N° ${esc(d.titre || "Sans titre")}</span>
      <span class="cdc-date">Date : ${new Date().toLocaleDateString("fr-FR")}</span>
      ${d.commande_id ? `<br><span class="cdc-date">Commande liée : ${esc(d.commande_id)}</span>` : ""}
    </div>
  </header>

  ${d.statut ? `<div class="status-badge ${statusClass(d.statut)}">${statusLabel(d.statut)}</div>` : ""}

  <!-- Enseignes -->
  ${ensSections || '<p style="color:#999;font-size:14px;text-align:center;padding:20px">Aucune enseigne définie</p>'}

  <!-- Matériaux legacy -->
  ${legacyMatsBlock}

  <!-- Équipe -->
  <div style="margin-top:20px">
    <h2 class="section-title">👥 Équipe</h2>
    <table>
      <thead><tr><th>Nom</th><th>Rôle</th></tr></thead>
      <tbody>${eqRows || '<tr><td colspan="2" style="text-align:center;color:#999">Aucun membre</td></tr>'}</tbody>
    </table>
  </div>

  <div class="footer">
    <p>Ce cahier des charges est généré pour assurer une exécution optimale.</p>
    <p>Contact : (+225) 0102656626 | Email : contact@imprimelle.ci</p>
    <p style="margin-top:4px"><strong>IMPRIMELLE CÔTE D'IVOIRE</strong> — Bingerville, nouvelle gare</p>
  </div>
</div>
</body></html>`;
}

// ──────────────────────────────────────────────
// Dispatcher
// ──────────────────────────────────────────────
function buildHTML(templateType: TemplateType, data: any): string {
  switch (templateType) {
    case "facture":
      return buildFactureHTML(data as FactureData);
    case "devis":
      return buildDevisHTML(data as DevisData);
    case "commande":
      return buildCommandeHTML(data as CommandeData);
    case "cahier_des_charges":
      return buildCahierHTML(data as CahierDesChargesData);
    default:
      throw new Error(`Type non supporté : ${templateType}`);
  }
}

// ──────────────────────────────────────────────
// API publique
// ──────────────────────────────────────────────

export interface PDFResult {
  success: boolean;
  pdfBlob?: Blob;
  pdfUrl?: string;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  templateType?: string;
}

/**
 * Génère un vrai PDF via le microservice Puppeteer.
 * Fallback vers window.print() si le service est injoignable.
 */
export async function generatePDFClient(
  templateType: TemplateType,
  data: any,
  _userId: string,
  _sessionId: string,
): Promise<PDFResult> {
  appLogger.info(`📄 Génération PDF — ${templateType}`);

  try {
    const html = buildHTML(templateType, data);
    const docNum = getDocNumber(templateType, data);
    const filename = `${templateType}_${docNum || Date.now()}.pdf`;

    // Essayer le microservice Puppeteer
    try {
      const pdfBlob = await generateRealPDF(html);
      const url = URL.createObjectURL(pdfBlob);

      appLogger.info(`✅ PDF généré via service — ${(pdfBlob.size / 1024).toFixed(0)} KB`);
      return {
        success: true,
        pdfBlob,
        pdfUrl: url,
        downloadUrl: url,
        filename,
        templateType,
      };
    } catch (svcErr: any) {
      // Fallback : window.print()
      appLogger.warning(`⚠️ Service PDF injoignable, fallback window.print() — ${svcErr.message}`);
      return await generatePDFViaPrint(html, templateType, filename);
    }
  } catch (error: any) {
    appLogger.error("❌ Erreur génération PDF", { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * POST le HTML au microservice Puppeteer → retourne le Blob PDF.
 */
async function generateRealPDF(html: string): Promise<Blob> {
  const resp = await fetch("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "text/html" },
    body: html,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(`PDF service error ${resp.status}: ${err.error || resp.statusText}`);
  }

  return await resp.blob();
}

/**
 * Fallback : génération via iframe + window.print().
 * Conservé pour quand le service Puppeteer est down.
 */
async function generatePDFViaPrint(
  html: string,
  templateType: TemplateType,
  filename: string,
): Promise<PDFResult> {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, "_blank");
  if (!printWindow) {
    return { success: false, error: "Popup bloquée — autorisez les popups pour ce site" };
  }

  return new Promise((resolve) => {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
          resolve({ success: true, pdfUrl: url, downloadUrl: url, filename, templateType });
        };
        setTimeout(() => resolve({ success: true, pdfUrl: url, downloadUrl: url, filename, templateType }), 5000);
      }, 500);
    };
  });
}

/**
 * Génération d'une image preview (HTML en blob, pour aperçu rapide).
 */
export async function generateImageClient(
  templateType: TemplateType,
  data: any,
): Promise<PDFResult> {
  appLogger.info(`🖼️ Génération image — ${templateType}`);
  try {
    const html = buildHTML(templateType, data);
    const docNum = getDocNumber(templateType, data);
    const filename = `${templateType}_${docNum || Date.now()}.png`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    return { success: true, pdfUrl: url, downloadUrl: url, filename, templateType };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function getDocNumber(templateType: TemplateType, data: any): string {
  switch (templateType) {
    case "facture":
      return (data as FactureData).factureNumero;
    case "devis":
      return (data as DevisData).devisNumero;
    case "commande":
      return (data as CommandeData).commandeNumero;
    case "cahier_des_charges":
      return (data as CahierDesChargesData).titre;
    default:
      return "";
  }
}
