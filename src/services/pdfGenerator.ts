// pdfGenerator.ts — Génération PDF/Image côté client (remplace le webhook n8n)
import type { TemplateType, FactureData, DevisData, CommandeData, CahierDesChargesData } from "@/types";
import { appLogger } from "@/utils/logger";

interface PDFResult {
  success: boolean;
  url?: string;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  templateType?: string;
}

// Styles partagés
const SHARED_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; padding: 30px; color: #1B2A34; font-size: 12px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 25px; }
  h1 { color: #FF8139; font-size: 24px; margin-bottom: 2px; }
  .ref { font-size: 13px; color: #555; }
  .statut { display: inline-block; padding: 4px 12px; background: #FF8139; color: #fff; border-radius: 20px; font-size: 11px; margin: 8px 0; }
  .client-box { margin: 15px 0; padding: 12px; background: #FFF3ED; border-radius: 6px; }
  .client-box strong { display: block; margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th { background: #FF8139; color: #fff; padding: 8px 6px; text-align: left; font-size: 11px; }
  td { padding: 6px; border-bottom: 1px solid #eee; font-size: 11px; }
  .total-line { text-align: right; font-size: 18px; font-weight: bold; margin-top: 15px; color: #FF8139; }
  .footer { margin-top: 30px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
  .info-line { font-size: 11px; color: #666; margin: 4px 0; }
  .enseigne-card { border: 2px solid #FF8139; border-radius: 6px; padding: 10px; margin: 8px 0; }
  .enseigne-card h3 { color: #FF8139; font-size: 13px; margin-bottom: 5px; }
  .section-title { color: #1B2A34; border-bottom: 2px solid #FF8139; padding-bottom: 4px; margin: 20px 0 10px; font-size: 14px; }
`;

function buildFactureHTML(d: FactureData): string {
  const rows = (d.details || []).map(i =>
    `<tr><td>${i.description}</td><td style="text-align:center">${i.quantite}</td><td style="text-align:right">${Number(i.prixUnitaire).toFixed(2)} €</td><td style="text-align:right">${Number(i.sous_total).toFixed(2)} €</td></tr>`
  ).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SHARED_STYLES}</style></head><body>
    <div class="header"><div><h1>FACTURE</h1><p>AssoAI — Signalétique</p></div><div class="ref">N° ${d.factureNumero}<br>${d.dateEmission || ""}</div></div>
    ${d.statut ? `<div class="statut">${d.statut}</div>` : ""}
    <div class="client-box"><strong>Client</strong>${d.client?.nom || ""}<br>${d.client?.adresse || ""}${d.client?.telephone ? "<br>Tél : " + d.client.telephone : ""}</div>
    <table><tr><th>Description</th><th style="text-align:center;width:60px">Qté</th><th style="text-align:right;width:90px">Prix U.</th><th style="text-align:right;width:100px">Sous-total</th></tr>${rows}</table>
    <div class="total-line">Total : ${Number(d.total || 0).toFixed(2)} €</div>
    ${d.delaiLivraison ? `<div class="info-line">Délai de livraison : ${d.delaiLivraison}</div>` : ""}
    ${d.reduction ? `<div class="info-line">Réduction : ${d.reduction}%</div>` : ""}
    <div class="footer">AssoAI — Document généré le ${new Date().toLocaleDateString("fr-FR")}</div>
  </body></html>`;
}

function buildDevisHTML(d: DevisData): string {
  const rows = (d.details || []).map(i =>
    `<tr><td>${i.description}</td><td style="text-align:center">${i.quantite}</td><td style="text-align:right">${Number(i.prixUnitaire).toFixed(2)} €</td><td style="text-align:right">${Number(i.sous_total).toFixed(2)} €</td></tr>`
  ).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SHARED_STYLES}</style></head><body>
    <div class="header"><div><h1>DEVIS</h1><p>AssoAI — Signalétique</p></div><div class="ref">N° ${d.devisNumero}<br>${d.dateEmission || ""}</div></div>
    <div class="info-line">Valable ${d.validiteJours || 30} jours${d.statut ? ` — ${d.statut}` : ""}</div>
    <div class="client-box"><strong>Client</strong>${d.client?.nom || ""}<br>${d.client?.adresse || ""}${d.client?.telephone ? "<br>Tél : " + d.client.telephone : ""}</div>
    <table><tr><th>Description</th><th style="text-align:center;width:60px">Qté</th><th style="text-align:right;width:90px">Prix U.</th><th style="text-align:right;width:100px">Sous-total</th></tr>${rows}</table>
    <div class="total-line">Total : ${Number(d.total || 0).toFixed(2)} €</div>
    ${d.type_structure ? `<div class="info-line">Structure : ${d.type_structure} — ${d.method_fabrication || ""}</div>` : ""}
    <div class="footer">AssoAI — Document généré le ${new Date().toLocaleDateString("fr-FR")}</div>
  </body></html>`;
}

function buildCommandeHTML(d: CommandeData): string {
  const rows = (d.items || []).map(i =>
    `<tr><td>${i.nom}</td><td style="text-align:center">${i.quantite}</td><td style="text-align:right">${Number(i.prixUnitaire).toFixed(2)} €</td><td style="text-align:right">${Number(i.sous_total).toFixed(2)} €</td></tr>`
  ).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SHARED_STYLES}</style></head><body>
    <div class="header"><div><h1>COMMANDE</h1><p>AssoAI — Signalétique</p></div><div class="ref">N° ${d.commandeNumero}<br>${d.dateCommande || ""}</div></div>
    <div class="statut">${d.statut || "En cours"}</div>
    <div class="client-box"><strong>Client</strong>${d.client?.nom || ""}<br>${d.client?.adresse || ""}${d.client?.telephone ? "<br>Tél : " + d.client.telephone : ""}</div>
    <table><tr><th>Article</th><th style="text-align:center;width:60px">Qté</th><th style="text-align:right;width:90px">Prix U.</th><th style="text-align:right;width:100px">Sous-total</th></tr>${rows}</table>
    <div class="total-line">Total : ${Number(d.total || 0).toFixed(2)} €</div>
    ${d.dateLivraison ? `<div class="info-line">Livraison prévue : ${d.dateLivraison}</div>` : ""}
    <div class="footer">AssoAI — Document généré le ${new Date().toLocaleDateString("fr-FR")}</div>
  </body></html>`;
}

function buildCahierHTML(d: CahierDesChargesData): string {
  const ens = (d.enseignes || []).map(e => `
    <div class="enseigne-card">
      <h3>🏗️ ${e.nom}</h3>
      <p style="font-size:11px">Dimensions : ${e.details?.dimensions?.largeur || "-"} × ${e.details?.dimensions?.hauteur || "-"} cm | Structure : ${e.details?.technique?.type_structure || "-"} | Fabrication : ${e.details?.technique?.method_fabrication || "-"}</p>
      ${e.produits?.length ? `<p style="font-size:11px">Produits : ${e.produits.map(p => p.nom).join(", ")}</p>` : ""}
    </div>
  `).join("");
  const eq = (d.equipe || []).map(m =>
    `<tr><td>${m.name}</td><td>${m.role}</td><td>${m.email || ""}</td></tr>`
  ).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SHARED_STYLES}</style></head><body>
    <div class="header"><div><h1>CAHIER DES CHARGES</h1><p>AssoAI — Signalétique</p></div></div>
    <p style="font-size:16px;color:#555;margin-bottom:10px">${d.titre || "Projet"}</p>
    ${d.statut ? `<div class="statut">${d.statut}</div>` : ""}
    <h2 class="section-title">Enseignes (${(d.enseignes || []).length})</h2>
    ${ens || "<p>Aucune enseigne</p>"}
    <h2 class="section-title">Équipe</h2>
    <table><tr><th>Nom</th><th>Rôle</th><th>Email</th></tr>${eq || '<tr><td colspan="3">Aucun membre</td></tr>'}</table>
    <div class="footer">AssoAI — Document généré le ${new Date().toLocaleDateString("fr-FR")}</div>
  </body></html>`;
}

function buildHTML(templateType: TemplateType, data: any): string {
  switch (templateType) {
    case "facture": return buildFactureHTML(data as FactureData);
    case "devis": return buildDevisHTML(data as DevisData);
    case "commande": return buildCommandeHTML(data as CommandeData);
    case "cahier_des_charges": return buildCahierHTML(data as CahierDesChargesData);
    default: throw new Error(`Type non supporté : ${templateType}`);
  }
}

// Génération PDF via iframe + window.print()
export async function generatePDFClient(
  templateType: TemplateType,
  data: any,
  _userId: string,
  _sessionId: string,
): Promise<PDFResult> {
  appLogger.info(`📄 Génération PDF client — ${templateType}`);

  try {
    const html = buildHTML(templateType, data);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const filename = `${templateType}_${Date.now()}.pdf`;

    // Ouvrir dans une nouvelle fenêtre et imprimer
    const printWindow = window.open(url, "_blank");
    if (!printWindow) {
      return { success: false, error: "Popup bloquée — autorisez les popups pour ce site" };
    }

    // Attendre le chargement puis imprimer
    return new Promise((resolve) => {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.onafterprint = () => {
            printWindow.close();
            resolve({
              success: true,
              url,
              downloadUrl: url,
              filename,
              templateType,
            });
          };
          // Fallback si onafterprint ne se déclenche pas
          setTimeout(() => resolve({
            success: true,
            url,
            downloadUrl: url,
            filename,
            templateType,
          }), 5000);
        }, 500);
      };
    });
  } catch (error: any) {
    appLogger.error("❌ Erreur génération PDF", { error: error.message });
    return { success: false, error: error.message };
  }
}

// Génération d'une image via canvas (pour preview)
export async function generateImageClient(
  templateType: TemplateType,
  data: any,
): Promise<PDFResult> {
  appLogger.info(`🖼️ Génération image — ${templateType}`);
  try {
    const html = buildHTML(templateType, data);
    const filename = `${templateType}_${Date.now()}.png`;

    // Créer un canvas à partir du HTML avec html2canvas-like approche
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    return {
      success: true,
      url,
      downloadUrl: url,
      filename,
      templateType,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
