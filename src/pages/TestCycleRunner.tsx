import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play, Square, Eye, CheckCircle2, Circle, Loader2,
  FileText, ArrowRight, RefreshCw, Zap, Clock, AlertCircle,
  ChevronDown, ChevronRight, ExternalLink, Copy, Trash2,
  Bot, User, Wrench, Truck, Package, BadgeCheck, Radio,
  Search, SkipForward,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@/types";

// =============================================================================
// Types
// =============================================================================

type PhaseName = "facturation" | "commande" | "fabrication" | "livraison";
type RunMode = "instant" | "wait-pollers";

interface TestConfig {
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  enseignes: EnseigneConfig[];
  reduction: number;
  useRealAgents: boolean;
}

interface EnseigneConfig {
  nom: string;
  dimensions: string;
  type: string;
  quantite: number;
  prixUnitaire: number;
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "success" | "error" | "warning" | "phase" | "step" | "poll";
  message: string;
}

interface PhaseProgress {
  phase: PhaseName;
  label: string;
  icon: React.ReactNode;
  status: "pending" | "running" | "done" | "error" | "waiting";
  tasks: { title: string; status: "pending" | "running" | "done" | "error" }[];
}

interface QueuePollStatus {
  pending: number;
  processed: number;
  lastAction: string;
  pollCount: number;
  elapsed: number;
}

const DEFAULT_ENSEIGNES: EnseigneConfig[] = [
  { nom: "Enseigne lumineuse 3D", dimensions: "2m × 1,2m", type: "enseigne_3d", quantite: 1, prixUnitaire: 350000 },
  { nom: "Néon lumineux transparent", dimensions: "1,5m × 0,8m", type: "neon_transparent", quantite: 1, prixUnitaire: 220000 },
];

const PHASES_CONFIG: { phase: PhaseName; label: string; icon: React.ReactNode }[] = [
  { phase: "facturation", label: "Facturation", icon: <FileText className="h-4 w-4" /> },
  { phase: "commande", label: "Commande", icon: <Package className="h-4 w-4" /> },
  { phase: "fabrication", label: "Fabrication", icon: <Wrench className="h-4 w-4" /> },
  { phase: "livraison", label: "Livraison", icon: <Truck className="h-4 w-4" /> },
];

const ASSIGNEES: Record<string, string> = {
  chef_technique: "Koné Daouda",
  superviseur_logistique: "Oumou",
  technicien_adjoint: "Sidick",
  commerciale: "Miss Kady",
  directrice_adjointe: "Fatou",
  directeur: "Emmanuel Loukou",
};

// =============================================================================
// Helpers
// =============================================================================

function makeUUID(): string {
  return crypto.randomUUID();
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function dueDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// =============================================================================
// Main Component
// =============================================================================

interface TestCycleRunnerProps {
  user: User | null;
}

const TestCycleRunner: React.FC<TestCycleRunnerProps> = ({ user }) => {
  const navigate = useNavigate();
  const logContainerRef = useRef<HTMLDivElement>(null);

  // ── Mode & Options ──
  const [runMode, setRunMode] = useState<RunMode>("instant");
  const [existingProjectId, setExistingProjectId] = useState("");
  const [skipDocs, setSkipDocs] = useState(false);
  const [onlyPhase, setOnlyPhase] = useState<PhaseName | "">("");
  const [searchProjectQuery, setSearchProjectQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; phase: string }[]>([]);

  // ── Config ──
  const [config, setConfig] = useState<TestConfig>({
    clientName: "Café La Paix",
    clientAddress: "Abidjan, Cocody, Rue des Jardins",
    clientPhone: "2250102030405",
    enseignes: DEFAULT_ENSEIGNES,
    reduction: 30000,
    useRealAgents: false,
  });

  // ── Run state ──
  const [running, setRunning] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<PhaseName | null>(null);
  const [phases, setPhases] = useState<PhaseProgress[]>([]);
  const [documents, setDocuments] = useState<{ type: string; numero: string; id: string; link: string }[]>([]);
  const [queueEntries, setQueueEntries] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [queuePoll, setQueuePoll] = useState<QueuePollStatus>({ pending: 0, processed: 0, lastAction: "", pollCount: 0, elapsed: 0 });

  // ── Logs ──
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(["facturation"]));
  const runRef = useRef(false);
  const abortRef = useRef(false);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Log helper
  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    setLogs(prev => [...prev.slice(-300), {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString("fr-FR"),
      level,
      message,
    }]);
  }, []);

  // ── Search existing projects ──
  const searchProjects = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("projects")
      .select("id, name, phase")
      .or(`name.ilike.%${query}%,id.eq.${query}`)
      .order("created_at", { ascending: false })
      .limit(5);
    setSearchResults((data || []) as any[]);
  }, []);

  useEffect(() => { searchProjects(searchProjectQuery); }, [searchProjectQuery, searchProjects]);

  // ── RPC & Supabase helpers ──
  const getNextNumber = useCallback(async (type: string): Promise<string> => {
    const { data, error } = await supabase.rpc("next_document_number", { p_doc_type: type });
    if (error) throw error;
    return String(data).replace(/"/g, "");
  }, []);

  const attachDocument = useCallback(async (projectId: string, key: string, msgId: string) => {
    const { data: proj } = await supabase.from("projects").select("templates").eq("id", projectId).single();
    const templates = (proj?.templates as Record<string, string[]>) || {};
    const list = templates[key] || [];
    if (!list.includes(msgId)) { list.push(msgId); templates[key] = list; }
    await supabase.from("projects").update({ templates }).eq("id", projectId);
  }, []);

  const createDocument = useCallback(async (
    projectId: string, templateType: string, data: Record<string, any>, templateKey: string,
  ) => {
    const { data: msg, error } = await supabase.from("messages").insert({
      template_type: templateType,
      template_data: { data },
      project_id: projectId,
      user_id: "test_runner",
      sender: "system",
      content: `${templateType} ${data[`${templateType}Numero`] || data.cdcNumero}`,
      session_id: `test-${Date.now()}`,
      session_type: "chat",
    }).select("id").single();
    if (error) throw error;
    await attachDocument(projectId, templateKey, msg.id);
    return msg.id;
  }, [attachDocument]);

  const createTask = useCallback(async (
    projectId: string, title: string, assignee: string, priority: string, due: string,
    isValidation = false, active = true,
  ) => {
    const { data, error } = await supabase.from("project_tasks").insert({
      project_id: projectId, title, kanban_column: "a_faire", assignee, priority,
      due_date: due, is_phase_validation: isValidation, active, created_by: "test_runner",
    }).select("id").single();
    if (error) throw error;
    return data;
  }, []);

  const createChecklist = useCallback(async (
    projectId: string, taskId: string, title: string, section: string, itemLabels: string[],
  ) => {
    const items = itemLabels.map(label => ({ id: makeUUID(), label, done: false }));
    await supabase.from("checklists").insert({ project_id: projectId, task_id: taskId, title, section, items });
  }, []);

  const insertQueue = useCallback(async (projectId: string, action: string, payload: Record<string, any>) => {
    await supabase.from("communicator_queue").insert({
      project_id: projectId, direction: "pm_to_communicator", action, status: "pending", retry_count: 0, payload,
    });
  }, []);

  // ── Queue polling (wait-pollers mode) ──
  const pollQueueStatus = useCallback(async (pid: string): Promise<QueuePollStatus> => {
    const { count: pending } = await supabase
      .from("communicator_queue")
      .select("*", { count: "exact", head: true })
      .eq("project_id", pid)
      .eq("status", "pending");

    const { count: processed } = await supabase
      .from("communicator_queue")
      .select("*", { count: "exact", head: true })
      .eq("project_id", pid)
      .eq("status", "processed");

    const { data: last } = await supabase
      .from("communicator_queue")
      .select("action, status")
      .eq("project_id", pid)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return {
      pending: pending || 0,
      processed: processed || 0,
      lastAction: last?.action || "—",
      pollCount: 0,
      elapsed: 0,
    };
  }, []);

  // ── Wait for PM tasks (poll) ──
  const waitForPmTasks = useCallback(async (pid: string, expectedPhase: string, timeout = 300): Promise<boolean> => {
    addLog("poll", `⏳ Attente du PM — création tâches phase '${expectedPhase}' (max ${timeout}s)...`);
    const start = Date.now();
    let lastMsg = "";

    while (Date.now() - start < timeout * 1000) {
      if (abortRef.current) return false;

      const { data: proj } = await supabase.from("projects").select("phase").eq("id", pid).single();
      const { data: tasks } = await supabase.from("project_tasks")
        .select("id")
        .eq("project_id", pid)
        .eq("kanban_column", "a_faire");

      const count = (tasks || []).length;
      const currentPhase = proj?.phase;

      if (currentPhase === expectedPhase && count >= 1) {
        addLog("success", `✅ PM a créé ${count} tâches — phase='${expectedPhase}'`);
        return true;
      }

      const msg = `Phase=${currentPhase}, ${count} tâches 'a_faire' (attend '${expectedPhase}')`;
      if (msg !== lastMsg) {
        const elapsed = Math.round((Date.now() - start) / 1000);
        addLog("poll", `   ... ${elapsed}s — ${msg}`);
        lastMsg = msg;
      }

      await sleep(15000); // Poll every 15s
    }
    addLog("warning", `⚠️ Timeout attente PM après ${timeout}s`);
    return false;
  }, [addLog]);

  // ── Wait for Communicator to process notifications ──
  const waitForCommunicator = useCallback(async (pid: string, action: string, timeout = 240): Promise<boolean> => {
    addLog("poll", `⏳ Attente Communicateur — traitement '${action}' (max ${timeout}s)...`);
    const start = Date.now();

    while (Date.now() - start < timeout * 1000) {
      if (abortRef.current) return false;

      const { data } = await supabase
        .from("communicator_queue")
        .select("status")
        .eq("project_id", pid)
        .eq("action", action)
        .eq("status", "processed")
        .limit(1);

      if (data && data.length > 0) {
        addLog("success", `✅ Communicateur a traité '${action}'`);
        return true;
      }

      await sleep(15000);
    }
    addLog("warning", `⚠️ Timeout Communicateur pour '${action}' après ${timeout}s`);
    return false;
  }, [addLog]);

  // ===========================================================================
  // MODE: Instant — run everything (like --direct)
  // ===========================================================================
  const runInstant = useCallback(async () => {
    addLog("phase", "━━━ MODE INSTANTANÉ — Démarrage ━━━");

    // Step 1: Create project
    addLog("phase", "━━━ ÉTAPE 1/6 : Création du projet ━━━");
    const pid = makeUUID();
    const pname = `TEST AUTO — ${config.clientName} (${todayISO()})`;

    const { error: projErr } = await supabase.from("projects").insert({
      id: pid, name: pname,
      description: `Projet test — ${config.clientName} — ${config.clientAddress}`,
      phase: null, status: "actif",
      session_id: `test-${pid.slice(0, 8)}`,
      created_by: "test_runner",
      templates: { factures: [], commandes: [], cahiers_des_charges: [], devis: [] },
    });
    if (projErr) throw projErr;
    addLog("success", `✅ Projet créé : ${pname}`);
    addLog("info", `🆔 ${pid}`);
    setProjectId(pid); setProjectName(pname);

    // Steps 2-4: Documents
    if (!skipDocs) {
      // Facture
      addLog("phase", "━━━ ÉTAPE 2/6 : Création de la facture ━━━");
      const factureNumero = await getNextNumber("facture");
      const details = config.enseignes.map(e => ({
        id: makeUUID(), description: `${e.nom} — ${e.dimensions}`,
        quantite: e.quantite, prix_unitaire: e.prixUnitaire,
        sous_total: e.quantite * e.prixUnitaire,
      }));
      const totalBrut = details.reduce((s, d) => s + d.sous_total, 0);
      const total = totalBrut - config.reduction;

      const factureData = {
        factureNumero, dateEmission: todayISO(),
        client: { nom: config.clientName, adresse: config.clientAddress, telephone: config.clientPhone },
        details, reduction: config.reduction, total, version: 1, is_latest: true, statut: "Brouillon",
      };
      const fId = await createDocument(pid, "facture", factureData, "factures");
      addLog("success", `✅ Facture ${factureNumero} — ${total.toLocaleString()} FCFA`);
      setDocuments(prev => [...prev, { type: "Facture", numero: factureNumero, id: fId, link: `/public/doc/${fId}` }]);

      // Commande
      addLog("phase", "━━━ ÉTAPE 3/6 : Dérivation Facture → Commande ━━━");
      const cmdNumero = await getNextNumber("commande");
      const items = details.map(d => ({
        id: makeUUID(), nom: d.description, quantite: d.quantite,
        prix_unitaire: d.prix_unitaire, sous_total: d.sous_total,
      }));
      const cmdData = {
        commandeNumero: cmdNumero, client: factureData.client, items,
        reduction: config.reduction, total, statut: "En attente",
        version: 1, is_latest: true, linked_facture_id: factureNumero,
      };
      const cId = await createDocument(pid, "commande", cmdData, "commandes");
      addLog("success", `✅ Commande ${cmdNumero} — liée à ${factureNumero}`);
      setDocuments(prev => [...prev, { type: "Commande", numero: cmdNumero, id: cId, link: `/public/doc/${cId}` }]);

      // CDC
      addLog("phase", "━━━ ÉTAPE 4/6 : Dérivation Commande → CDC ━━━");
      const cdcNumero = await getNextNumber("cahier_des_charges");
      const enseignesCdc = config.enseignes.map((e, i) => ({
        id: makeUUID(), nom: `${e.nom} — ${e.dimensions}`, type: e.type,
        dimensions: e.dimensions, quantite: e.quantite,
        materiaux: i === 0
          ? ["Panneau Dibond 3mm", "LED 5050 RGB", "Alimentation 12V 150W"]
          : ["Support transparent", "Tube néon LED", "Alimentation 12V 60W"],
      }));
      const cdcData = {
        cdcNumero, client: factureData.client, enseignes: enseignesCdc,
        equipe: { chef_technique: ASSIGNEES.chef_technique, superviseur_logistique: ASSIGNEES.superviseur_logistique, technicien_adjoint: ASSIGNEES.technicien_adjoint },
        deliveryAddress: config.clientAddress, commande_id: cmdNumero, version: 1, is_latest: true,
      };
      const cdcId = await createDocument(pid, "cahier_des_charges", cdcData, "cahiers_des_charges");
      addLog("success", `✅ CDC ${cdcNumero} — ${config.enseignes.length} enseigne(s)`);
      setDocuments(prev => [...prev, { type: "CDC", numero: cdcNumero, id: cdcId, link: `/public/doc/${cdcId}` }]);
    }

    // Step 5: Initialize
    addLog("phase", "━━━ ÉTAPE 5/6 : Initialisation du projet ━━━");
    await supabase.from("projects").update({ phase: "facturation", status: "actif" }).eq("id", pid);

    const factuTasks = await createPhaseTasksLocal(pid, "facturation");
    await insertQueue(pid, "phase_started", {
      project_id: pid, project_name: pname, phase: "facturation", previous_phase: null,
      enseigne_count: config.enseignes.length,
      tasks: factuTasks.filter(t => t.active).map(t => ({
        title: t.title, assignee_name: ASSIGNEES[t.assignee] || t.assignee, due_date: dueDate(3),
      })),
    });
    await supabase.from("project_phase_history").insert({ project_id: pid, phase: "facturation", action: "started", performed_by: "test_runner" });
    addLog("success", `✅ Phase 'facturation' — ${factuTasks.filter(t => t.active).length} tâches actives + 1 validation`);

    updatePhasesDisplay("facturation", "running", factuTasks);

    // Step 6: Cycle phases
    await completeAllPhasesInstant(pid, pname);
    addLog("success", `🎉 CYCLE TERMINÉ — ${pname}`);

  }, [config, skipDocs, getNextNumber, createDocument, createTask, createChecklist, insertQueue, addLog]);

  // ===========================================================================
  // MODE: Wait-Pollers — only user actions, wait for real pollers
  // ===========================================================================
  const runWaitPollers = useCallback(async () => {
    const pid = existingProjectId;
    if (!pid) { addLog("error", "❌ Aucun projet sélectionné"); return; }

    addLog("phase", "━━━ MODE END-TO-END (attente pollers) — Démarrage ━━━");
    addLog("info", `🆔 Projet: ${pid}`);
    addLog("info", `⏱️  Pollers: Communicateur + PM (cycle 2 min)`);

    const phasesToRun: PhaseName[] = onlyPhase
      ? [onlyPhase as PhaseName]
      : ["facturation", "commande", "fabrication", "livraison"];

    for (let idx = 0; idx < phasesToRun.length; idx++) {
      if (abortRef.current) break;
      const phase = phasesToRun[idx];
      addLog("phase", `─── Phase ${phase.toUpperCase()} ───`);

      // Check if tasks exist
      const { data: tasks } = await supabase
        .from("project_tasks")
        .select("id, kanban_column")
        .eq("project_id", pid)
        .eq("kanban_column", "a_faire");

      if (!tasks || tasks.length === 0) {
        addLog("poll", `⏳ Aucune tâche 'a_faire' — attente du PM pour la phase ${phase}...`);
        const ok = await waitForPmTasks(pid, phase);
        if (!ok) { addLog("error", `❌ Timeout — le PM n'a pas créé les tâches`); break; }
      }

      // Complete checklists (2-step)
      await completePhaseChecklists(pid, phase);

      // Wait for PM to process task_completed
      addLog("poll", "📤 Attente PM : traitement task_completed...");
      await waitForQueueCleared(pid, ["task_completed", "checklist_progress"], 180);

      // Wait for PM to create next phase tasks
      if (idx < phasesToRun.length - 1) {
        const nextPhase = phasesToRun[idx + 1];
        await waitForPmTasks(pid, nextPhase);
      }

      // Wait for Communicator
      addLog("poll", "📢 Attente Communicateur : traitement notifications...");
      await waitForCommunicator(pid, "phase_started");
      await waitForCommunicator(pid, "task_completed");

      printPhaseStatus(pid, phase);
    }

    addLog("success", "🎉 CYCLE END-TO-END TERMINÉ !");
  }, [existingProjectId, onlyPhase, addLog, waitForPmTasks, waitForCommunicator]);

  // ── Wait for queue entries to be processed ──
  const waitForQueueCleared = useCallback(async (pid: string, actions: string[], timeout = 180): Promise<boolean> => {
    addLog("poll", `⏳ Attente queue vidée (actions: ${actions.join(", ")})...`);
    const start = Date.now();
    while (Date.now() - start < timeout * 1000) {
      if (abortRef.current) return false;
      const { count } = await supabase
        .from("communicator_queue")
        .select("*", { count: "exact", head: true })
        .eq("project_id", pid)
        .eq("status", "pending")
        .in("action", actions);
      if (!count || count === 0) {
        addLog("success", "✅ Queue traitée");
        return true;
      }
      const elapsed = Math.round((Date.now() - start) / 1000);
      setQueuePoll(prev => ({ ...prev, pending: count, elapsed }));
      await sleep(15000);
    }
    addLog("warning", `⚠️ Timeout queue après ${timeout}s`);
    return false;
  }, [addLog]);

  // ── Create phase tasks (local, used in instant mode) ──
  const createPhaseTasksLocal = useCallback(async (pid: string, phase: PhaseName) => {
    await supabase.from("projects").update({ phase }).eq("id", pid);
    const tasks: { id: string; title: string; assignee: string; active: boolean }[] = [];

    if (phase === "facturation") {
      const t1 = await createTask(pid, "Vérifier le paiement client", "commerciale", "high", dueDate(3));
      tasks.push({ ...t1, title: "Vérifier le paiement client", assignee: "commerciale", active: true });
      await createChecklist(pid, t1.id, "Vérification paiement", "facturation", [
        "Vérifier les coordonnées bancaires", "Confirmer réception acompte (50%)", "Noter référence virement", "Mettre à jour statut facture",
      ]);
      const t2 = await createTask(pid, "Envoyer la facture au client", "commerciale", "medium", dueDate(1));
      tasks.push({ ...t2, title: "Envoyer la facture au client", assignee: "commerciale", active: true });
      await createChecklist(pid, t2.id, "Envoi facture", "facturation", [
        "Générer le PDF", "Envoyer par email", "Envoyer lien WhatsApp", "Confirmer réception",
      ]);
      const tv = await createTask(pid, "Valider la phase facturation", "directrice_adjointe", "high", dueDate(5), true, false);
      tasks.push({ ...tv, title: "Valider la phase facturation", assignee: "directrice_adjointe", active: false });
      await createChecklist(pid, tv.id, "Validation — Facturation", "facturation", [
        "Vérifier paiement reçu", "Vérifier facture envoyée", "Valider passage en commande",
      ]);
    } else if (phase === "commande") {
      const t1 = await createTask(pid, "Créer bon de commande fournisseur", "chef_technique", "high", dueDate(3));
      tasks.push({ ...t1, title: "Créer bon de commande fournisseur", assignee: "chef_technique", active: true });
      await createChecklist(pid, t1.id, "Bon de commande fournisseur", "commande", [
        "Lister matériaux", "Contacter fournisseur", "Valider bon de commande", "Envoyer bon de commande",
      ]);
      const t2 = await createTask(pid, "Vérifier les délais de livraison", "superviseur_logistique", "medium", dueDate(2));
      tasks.push({ ...t2, title: "Vérifier les délais de livraison", assignee: "superviseur_logistique", active: true });
      await createChecklist(pid, t2.id, "Délais livraison", "commande", [
        "Vérifier stocks", "Confirmer délais", "Planifier réception",
      ]);
      const tv = await createTask(pid, "Valider la phase commande", "directrice_adjointe", "high", dueDate(5), true, false);
      tasks.push({ ...tv, title: "Valider la phase commande", assignee: "directrice_adjointe", active: false });
      await createChecklist(pid, tv.id, "Validation — Commande", "commande", [
        "Vérifier BC envoyé", "Vérifier délais confirmés", "Valider passage fabrication",
      ]);
    } else if (phase === "fabrication") {
      const t1 = await createTask(pid, "Découpe et assemblage — Enseigne 3D", "chef_technique", "critical", dueDate(7));
      tasks.push({ ...t1, title: "Découpe et assemblage — Enseigne 3D", assignee: "chef_technique", active: true });
      await createChecklist(pid, t1.id, "Fabrication Enseigne 3D", "fabrication", [
        "Découpe panneau Dibond", "Assemblage cadre aluminium", "Pose LEDs 5050 RGB", "Câblage et test", "Photo enseigne terminée",
      ]);
      const t2 = await createTask(pid, "Assemblage — Néon transparent", "technicien_adjoint", "high", dueDate(5));
      tasks.push({ ...t2, title: "Assemblage — Néon transparent", assignee: "technicien_adjoint", active: true });
      await createChecklist(pid, t2.id, "Fabrication Néon", "fabrication", [
        "Découpe support", "Pose tube néon LED", "Câblage et test", "Photo néon terminé",
      ]);
      const tv = await createTask(pid, "Valider la phase fabrication", "directeur", "high", dueDate(8), true, false);
      tasks.push({ ...tv, title: "Valider la phase fabrication", assignee: "directeur", active: false });
      await createChecklist(pid, tv.id, "Validation — Fabrication", "fabrication", [
        "Inspecter enseignes", "Vérifier conformité CDC", "Valider passage livraison",
      ]);
    } else if (phase === "livraison") {
      const t1 = await createTask(pid, "Préparer la livraison", "superviseur_logistique", "high", dueDate(2));
      tasks.push({ ...t1, title: "Préparer la livraison", assignee: "superviseur_logistique", active: true });
      await createChecklist(pid, t1.id, "Préparation livraison", "livraison", [
        "Emballer enseignes", "Préparer kit installation", "Vérifier check-list", "Charger véhicule",
      ]);
      const t2 = await createTask(pid, "Installation chez le client", "chef_technique", "critical", dueDate(3));
      tasks.push({ ...t2, title: "Installation chez le client", assignee: "chef_technique", active: true });
      await createChecklist(pid, t2.id, "Installation client", "livraison", [
        "Déballer enseignes", "Fixer enseigne 3D", "Installer néon", "Raccorder alimentation", "Test final — photo",
      ]);
      const tv = await createTask(pid, "Valider la phase livraison", "directrice_adjointe", "high", dueDate(5), true, false);
      tasks.push({ ...tv, title: "Valider la phase livraison", assignee: "directrice_adjointe", active: false });
      await createChecklist(pid, tv.id, "Validation — Livraison", "livraison", [
        "Vérifier satisfaction client", "Récupérer bon signé", "Valider clôture projet",
      ]);
    }

    await insertQueue(pid, "phase_started", {
      project_id: pid, project_name: projectName || "Projet test", phase, previous_phase: null,
      enseigne_count: config.enseignes.length,
      tasks: tasks.filter(t => t.active).map(t => ({
        title: t.title, assignee_name: ASSIGNEES[t.assignee] || t.assignee, due_date: dueDate(3),
      })),
    });
    await supabase.from("project_phase_history").insert({ project_id: pid, phase, action: "started", performed_by: "test_runner" });
    return tasks;
  }, [config, projectName, createTask, createChecklist, insertQueue]);

  // ── Complete checklists for one phase (2-step) ──
  const completePhaseChecklists = useCallback(async (pid: string, phase: string) => {
    const { data: checklists } = await supabase
      .from("checklists")
      .select("id, task_id, title, items")
      .eq("project_id", pid)
      .eq("section", phase);

    if (!checklists || checklists.length === 0) {
      addLog("warning", `⚠️ Aucune checklist pour ${phase}`);
      return;
    }

    for (const cl of checklists) {
      if (abortRef.current) break;
      const items = (cl.items as any[]) || [];
      if (items.length === 0) continue;

      const { data: task } = await supabase
        .from("project_tasks")
        .select("id, title, kanban_column, assignee, is_phase_validation")
        .eq("id", cl.task_id)
        .single();
      if (!task) continue;

      const isVal = task.is_phase_validation;
      const name = ASSIGNEES[task.assignee] || task.assignee || "?";

      // Step A: 1 item
      const first = items.find((it: any) => !it.done);
      if (first) {
        first.done = true;
        first.done_at = new Date().toISOString();
        await supabase.from("checklists").update({ items }).eq("id", cl.id);
        if (task.kanban_column === "a_faire") {
          await supabase.from("project_tasks").update({ kanban_column: "en_cours" }).eq("id", task.id);
        }
        await insertQueue(pid, "checklist_progress", {
          task_id: task.id, task_title: task.title, checklist_id: cl.id,
          checklist_title: cl.title, done_by: name, progress: `1/${items.length}`,
          timestamp: new Date().toISOString(),
        });
        addLog("step", `📊 Progress — ${cl.title}: ${Math.round(100 / items.length)}% (1/${items.length}) — ${name}${isVal ? " 🔒" : ""}`);
      }

      // Step B: all items
      const { data: ref } = await supabase.from("checklists").select("items").eq("id", cl.id).single();
      const refreshed = (ref?.items as any[]) || items;
      for (const item of refreshed) {
        if (!item.done) { item.done = true; item.done_at = new Date().toISOString(); }
      }
      await supabase.from("checklists").update({ items: refreshed }).eq("id", cl.id);
      await supabase.from("project_tasks").update({
        kanban_column: "termine", completed_at: new Date().toISOString(),
      }).eq("id", task.id);

      await insertQueue(pid, "task_completed", {
        task_id: task.id, task_title: task.title, checklist_id: cl.id,
        done_by: name, confidence: "high", timestamp: new Date().toISOString(),
      });
      addLog("success", `✅ Completed — ${cl.title}: 100% (${refreshed.length}/${refreshed.length}) — ${name}${isVal ? " 🔒" : ""}`);

      setQueueEntries(prev => prev + 2);
      await sleep(200);
    }
  }, [addLog, insertQueue]);

  // ── Complete all phases (instant mode) ──
  const completeAllPhasesInstant = useCallback(async (pid: string, pname: string) => {
    addLog("phase", "━━━ ÉTAPE 6/6 : Cycle des phases (2-step checklists) ━━━");
    const allPhases: PhaseName[] = onlyPhase ? [onlyPhase as PhaseName] : ["facturation", "commande", "fabrication", "livraison"];
    const phaseLabels = PHASES_CONFIG;

    for (let idx = 0; idx < allPhases.length; idx++) {
      const phase = allPhases[idx];
      addLog("phase", `─── Phase ${phase.toUpperCase()} ───`);
      setCurrentPhase(phase);
      await completePhaseChecklists(pid, phase);

      if (idx < allPhases.length - 1) {
        const nextPhase = allPhases[idx + 1];
        addLog("phase", `🚀 Transition → ${nextPhase.toUpperCase()}`);
        await createPhaseTasksLocal(pid, nextPhase);
        addLog("success", `✅ Phase '${nextPhase}' créée`);
      } else {
        await supabase.from("projects").update({ status: "termine", phase: "termine" }).eq("id", pid);
        addLog("success", "🏁 Projet marqué 'terminé'");
      }
      await sleep(500);
    }

    const { count: qc } = await supabase
      .from("communicator_queue")
      .select("*", { count: "exact", head: true })
      .eq("project_id", pid);
    setQueueEntries(qc || 0);
  }, [onlyPhase, addLog, completePhaseChecklists, createPhaseTasksLocal]);

  // ── Helpers ──
  const updatePhasesDisplay = (phase: PhaseName, status: PhaseProgress["status"], tasks: { id: string; title: string; assignee: string; active: boolean }[]) => {
    setPhases(prev => {
      const updated = [...prev];
      const idx = PHASES_CONFIG.findIndex(p => p.phase === phase);
      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          status,
          tasks: tasks.map(t => ({ title: t.title, status: "running" as const })),
        };
      }
      return updated;
    });
  };

  const printPhaseStatus = (pid: string, phase: string) => {
    addLog("info", `📊 Phase ${phase} — terminée`);
  };

  // ===========================================================================
  // Main run handler
  // ===========================================================================
  const handleRun = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;
    abortRef.current = false;
    setRunning(true);
    setLogs([]);
    setQueueEntries(0);

    const initialPhases = PHASES_CONFIG.map(p => ({
      ...p, status: "pending" as const, tasks: [] as { title: string; status: "pending" }[],
    }));
    setPhases(initialPhases);
    setStartedAt(new Date().toISOString());

    try {
      if (runMode === "wait-pollers") {
        await runWaitPollers();
      } else {
        await runInstant();
      }
    } catch (err: any) {
      addLog("error", `❌ Erreur : ${err.message || err}`);
      console.error(err);
    } finally {
      runRef.current = false;
      setRunning(false);
    }
  }, [runMode, runInstant, runWaitPollers, addLog]);

  const handleAbort = useCallback(() => {
    abortRef.current = true;
    addLog("warning", "⚠️ Exécution interrompue par l'utilisateur");
    setRunning(false);
  }, [addLog]);

  // ===========================================================================
  // Quick invoice
  // ===========================================================================
  const [quickInvoiceLoading, setQuickInvoiceLoading] = useState(false);
  const [quickInvoiceResult, setQuickInvoiceResult] = useState<{ numero: string; id: string } | null>(null);

  const createQuickInvoice = async () => {
    setQuickInvoiceLoading(true);
    setQuickInvoiceResult(null);
    try {
      const numero = await getNextNumber("facture");
      const factureData = {
        factureNumero: numero, dateEmission: todayISO(),
        client: { nom: config.clientName, adresse: "", telephone: "" },
        details: [], total: 0, version: 1, is_latest: true, statut: "Brouillon",
      };
      const { data, error } = await supabase.from("messages").insert({
        template_type: "facture", template_data: { data: factureData },
        user_id: "test_runner", sender: "system",
        content: `Facture ${numero} — ${config.clientName}`,
        session_id: `quick-${Date.now()}`, session_type: "chat",
      }).select("id").single();
      if (error) throw error;
      setQuickInvoiceResult({ numero, id: data.id });
      addLog("success", `✅ Facture vierge ${numero} créée pour ${config.clientName}`);
    } catch (err: any) {
      addLog("error", `❌ Erreur : ${err.message}`);
    } finally {
      setQuickInvoiceLoading(false);
    }
  };

  // ===========================================================================
  // Render helpers
  // ===========================================================================
  const getPhaseIcon = (status: string) => {
    switch (status) {
      case "done": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "running": return <Loader2 className="h-5 w-5 text-brand-orange animate-spin" />;
      case "waiting": return <Clock className="h-5 w-5 text-amber-500 animate-pulse" />;
      case "error": return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case "success": return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
      case "error": return <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case "warning": return <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      case "phase": return <Zap className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
      case "step": return <ArrowRight className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
      case "poll": return <RefreshCw className="h-3.5 w-3.5 text-cyan-400 shrink-0" />;
      default: return <Circle className="h-3.5 w-3.5 text-gray-500 shrink-0" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Zap className="h-6 w-6 text-brand-orange" />
            Test Cycle Projet
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Simulation complète — 2 modes : instantané ou end-to-end avec pollers
          </p>
        </div>
        <button onClick={() => navigate("/projects")} className="text-sm text-gray-500 hover:text-brand-orange flex items-center gap-1">
          <Eye className="h-4 w-4" /> Voir les projets
        </button>
      </div>

      {/* Quick Invoice Card */}
      <div className="mb-6 p-4 bg-white rounded-xl border-2 border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><FileText className="h-5 w-5 text-purple-700" /></div>
            <div>
              <h3 className="font-semibold text-gray-800">Créer une facture vierge</h3>
              <p className="text-xs text-gray-500">Pour le client : {config.clientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {quickInvoiceResult && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-600 font-mono">{quickInvoiceResult.numero}</span>
                <button onClick={() => window.open(`/public/doc/${quickInvoiceResult.id}`, "_blank")} className="p-1 hover:bg-gray-100 rounded">
                  <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
                </button>
              </div>
            )}
            <button
              onClick={createQuickInvoice}
              disabled={quickInvoiceLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
            >
              {quickInvoiceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Créer facture vierge
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Config Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Mode Selection */}
          <div className="bg-white rounded-xl border-2 border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Radio className="h-4 w-4 text-brand-orange" /> Mode de fonctionnement
            </h3>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${runMode === "instant" ? "border-brand-orange bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" name="mode" checked={runMode === "instant"} onChange={() => { setRunMode("instant"); setExistingProjectId(""); setOnlyPhase(""); setSkipDocs(false); }} className="mt-0.5 accent-brand-orange" />
                <div>
                  <span className="font-medium text-sm">⚡ Instantané</span>
                  <p className="text-xs text-gray-500 mt-0.5">Tout en un clic — ~10 secondes. Crée projet, documents, tâches et checklists.</p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${runMode === "wait-pollers" ? "border-brand-orange bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" name="mode" checked={runMode === "wait-pollers"} onChange={() => setRunMode("wait-pollers")} className="mt-0.5 accent-brand-orange" />
                <div>
                  <span className="font-medium text-sm">🔄 End-to-end (attente pollers)</span>
                  <p className="text-xs text-gray-500 mt-0.5">Simule un utilisateur réel — attend le PM et le Communicateur. ~10-15 minutes. Les pollers doivent tourner.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Wait-pollers options */}
          {runMode === "wait-pollers" && (
            <div className="bg-white rounded-xl border-2 border-amber-200 bg-amber-50/30 shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-amber-600" /> Projet existant
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Rechercher un projet</label>
                  <input
                    type="text"
                    placeholder="Nom du projet ou UUID..."
                    value={searchProjectQuery}
                    onChange={e => setSearchProjectQuery(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange outline-none"
                    disabled={running}
                  />
                  {searchResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-lg divide-y max-h-40 overflow-y-auto">
                      {searchResults.map(r => (
                        <button
                          key={r.id}
                          onClick={() => { setExistingProjectId(r.id); setSearchProjectQuery(r.name); setSearchResults([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                        >
                          <span className="truncate">{r.name}</span>
                          <span className="text-xs text-gray-400 ml-2 shrink-0">{r.phase || "—"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {existingProjectId && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Projet sélectionné : <code className="text-[10px] bg-gray-100 px-1 rounded">{existingProjectId.slice(0, 8)}...</code>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="skip-docs" checked={skipDocs} onChange={e => setSkipDocs(e.target.checked)} className="accent-brand-orange" disabled={running} />
                  <label htmlFor="skip-docs" className="text-sm text-gray-600">Skip documents (étapes 2-4)</label>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Phase unique (optionnel)</label>
                  <select
                    value={onlyPhase}
                    onChange={e => setOnlyPhase(e.target.value as PhaseName | "")}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange outline-none"
                    disabled={running}
                  >
                    <option value="">Toutes les phases</option>
                    {PHASES_CONFIG.map(p => (
                      <option key={p.phase} value={p.phase}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Client config */}
          <div className="bg-white rounded-xl border-2 border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" /> Client
            </h3>
            <div className="space-y-2">
              <input
                type="text" placeholder="Nom du client"
                value={config.clientName} onChange={e => setConfig({ ...config, clientName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange outline-none"
                disabled={running || runMode === "wait-pollers"}
              />
              {runMode !== "wait-pollers" && (
                <input
                  type="number" placeholder="Réduction (FCFA)"
                  value={config.reduction} onChange={e => setConfig({ ...config, reduction: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange outline-none"
                  disabled={running}
                />
              )}
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={running || (runMode === "wait-pollers" && !existingProjectId)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-orange text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-semibold transition-colors"
          >
            {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            {running
              ? (runMode === "wait-pollers" ? "Cycle en cours (attente pollers)..." : "Exécution en cours...")
              : (runMode === "wait-pollers"
                ? `🚀 Lancer cycle end-to-end${onlyPhase ? ` — ${onlyPhase}` : ""}`
                : "🚀 Lancer le cycle complet")}
          </button>

          {running && (
            <button onClick={handleAbort} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm transition-colors">
              <Square className="h-4 w-4" /> Arrêter
            </button>
          )}

          {runMode === "wait-pollers" && (
            <div className="text-xs text-gray-400 text-center">
              <Clock className="h-3 w-3 inline mr-1" />
              Pollers : cycle 2 min • Timeout max ~11 min/phase
            </div>
          )}
        </div>

        {/* Progress Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border-2 border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-brand-orange" /> Progression
              {startedAt && (
                <span className="text-xs text-gray-400 ml-auto">
                  Démarré à {new Date(startedAt).toLocaleTimeString("fr-FR")}
                </span>
              )}
            </h3>

            <div className="space-y-0">
              {phases.map((phase, idx) => (
                <div key={phase.phase} className="relative">
                  {idx < phases.length - 1 && (
                    <div className={`absolute left-[19px] top-10 bottom-0 w-0.5 ${phase.status === "done" ? "bg-green-400" : "bg-gray-200"}`} />
                  )}
                  <div className="flex items-center gap-3 py-2 cursor-pointer" onClick={() => {
                    const next = new Set(expandedPhases);
                    next.has(phase.phase) ? next.delete(phase.phase) : next.add(phase.phase);
                    setExpandedPhases(next);
                  }}>
                    <div className="relative z-10">{getPhaseIcon(phase.status)}</div>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-gray-500">{phase.icon}</span>
                      <span className={`font-medium text-sm ${
                        phase.status === "running" ? "text-brand-orange" :
                        phase.status === "waiting" ? "text-amber-600" :
                        phase.status === "done" ? "text-green-700" : "text-gray-400"
                      }`}>{phase.label}</span>
                      {phase.status === "waiting" && <span className="text-xs text-amber-500 animate-pulse">pollers...</span>}
                      {phase.status === "running" && <span className="text-xs text-brand-orange animate-pulse">en cours...</span>}
                      {phase.status === "done" && phase.tasks.length > 0 && (
                        <span className="text-xs text-green-600 ml-auto">{phase.tasks.length} tâches</span>
                      )}
                    </div>
                    {phase.tasks.length > 0 && (
                      expandedPhases.has(phase.phase) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  {expandedPhases.has(phase.phase) && phase.tasks.length > 0 && (
                    <div className="ml-10 mt-1 mb-2 space-y-1">
                      {phase.tasks.map((task, ti) => (
                        <div key={ti} className="flex items-center gap-2 text-xs text-gray-500">
                          {task.status === "done" ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                           : task.status === "running" ? <Loader2 className="h-3 w-3 text-brand-orange animate-spin shrink-0" />
                           : <Circle className="h-3 w-3 text-gray-300 shrink-0" />}
                          <span className={task.status === "done" ? "line-through text-gray-400" : ""}>{task.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Documents */}
            {documents.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Documents</h4>
                <div className="space-y-1">
                  {documents.map((doc, i) => (
                    <a key={i} href={doc.link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded">
                      <FileText className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs">{doc.numero}</span>
                      <span className="text-gray-400">—</span><span>{doc.type}</span>
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Queue / Project link */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <BadgeCheck className="h-4 w-4 text-green-500" />
                <span className="text-gray-600"><strong>{queueEntries}</strong> entrées queue</span>
                {runMode === "wait-pollers" && queuePoll.pending > 0 && (
                  <span className="text-amber-600 text-xs animate-pulse ml-1">
                    ({queuePoll.pending} en attente — {queuePoll.elapsed}s)
                  </span>
                )}
              </div>
              {(projectId || existingProjectId) && (
                <button onClick={() => navigate(`/projects/${projectId || existingProjectId}`)}
                  className="text-sm text-brand-orange hover:underline flex items-center gap-1">
                  Voir le projet <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Log */}
      <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <TerminalIcon className="h-4 w-4" /> Logs en direct
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{logs.length} entrées</span>
            <button onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
        </div>
        <div ref={logContainerRef} className="h-96 overflow-y-auto p-4 font-mono text-xs space-y-0.5 scrollbar-thin">
          {logs.length === 0 && (
            <div className="text-gray-600 flex items-center justify-center h-full">
              <div className="text-center">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Sélectionne un mode et lance le cycle</p>
                <p className="text-gray-700 mt-1">Les logs apparaîtront ici en temps réel</p>
              </div>
            </div>
          )}
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-gray-800/50 px-1 py-0.5 rounded">
              <span className="text-gray-600 shrink-0 w-10">{log.timestamp}</span>
              {getLogIcon(log.level)}
              <span className={
                log.level === "error" ? "text-red-400" :
                log.level === "success" ? "text-green-400" :
                log.level === "warning" ? "text-amber-400" :
                log.level === "phase" ? "text-orange-400 font-semibold" :
                log.level === "step" ? "text-blue-400" :
                log.level === "poll" ? "text-cyan-400" :
                "text-gray-300"
              }>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TerminalIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export default TestCycleRunner;
