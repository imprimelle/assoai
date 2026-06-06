// server.ts — Microservice PDF Puppeteer pour AssoAI
// POST /api/pdf — body: HTML brut → réponse: PDF binaire
import express from "express";
import cors from "cors";
import puppeteer, { type Browser } from "puppeteer";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const TIMEOUT_MS = 30_000; // 30 secondes max par requête

// ──────────────────────────────────────────────
// Browser pool (un seul navigateur partagé)
// ──────────────────────────────────────────────
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  // Écouter les crash/disconnect éventuels
  (browser.process()?.once?.("close", () => {
    browser = null;
  }) ?? browser.on("disconnected", () => {
    browser = null;
  }));
  return browser;
}

// ──────────────────────────────────────────────
// Génération PDF
// ──────────────────────────────────────────────
async function generatePDF(html: string): Promise<Buffer> {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setContent(html, {
      waitUntil: "load",
      timeout: TIMEOUT_MS,
    });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: false,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

// ──────────────────────────────────────────────
// Serveur Express
// ──────────────────────────────────────────────
const app = express();

// CORS pour l'appel depuis le SPA (même domaine, mais sécurité)
app.use(cors({ origin: true }));
// Parser raw body pour recevoir le HTML
app.use(express.text({ type: "text/html", limit: "10mb" }));
app.use(express.text({ type: "text/plain", limit: "10mb" })); // fallback

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Endpoint PDF
app.post("/api/pdf", async (req, res) => {
  const html = typeof req.body === "string" ? req.body : "";
  if (!html || html.length < 100) {
    res.status(400).json({ error: "HTML body required (min 100 chars)" });
    return;
  }

  const start = Date.now();

  try {
    const pdf = await generatePDF(html);
    const elapsed = Date.now() - start;
    console.log(`✅ PDF généré — ${(pdf.length / 1024).toFixed(0)} KB en ${elapsed}ms`);

    res
      .status(200)
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="document_${Date.now()}.pdf"`,
        "Content-Length": pdf.length.toString(),
        "X-Generation-Time-Ms": elapsed.toString(),
      })
      .send(pdf);
  } catch (err: any) {
    const elapsed = Date.now() - start;
    console.error(`❌ Erreur PDF après ${elapsed}ms:`, err.message);

    // Si le navigateur a crashé, on réinitialise
    if (err.message?.includes("Target closed") || err.message?.includes("Protocol error")) {
      browser = null;
    }

    res.status(500).json({
      error: "PDF generation failed",
      detail: err.message?.slice(0, 300),
      generation_time_ms: elapsed,
    });
  }
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found. Use POST /api/pdf or GET /health" });
});

// ──────────────────────────────────────────────
// Démarrage
// ──────────────────────────────────────────────
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`📄 PDF Service ready on port ${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log("🛑 Shutting down...");
  server.close();
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
