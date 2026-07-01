import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play, Square, Eye, CheckCircle2, Circle, Loader2,
  FileText, ArrowRight, RefreshCw, Zap, Clock, AlertCircle,
  ChevronDown, ChevronRight, ExternalLink, Copy, Trash2,
  Bot, User, Wrench, Truck, Package, BadgeCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@/types";

// =============================================================================
// Types
// =============================================================================

type PhaseName = "facturation" | "commande" | "fabrication" | "livraison";

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
  level: "info" | "success" | "error" | "warning" | "phase" | "step";
  message: string;
}

interface PhaseProgress {
  phase: PhaseName;
  label: string;
  icon: React.ReactNode;
  status: "pending" | "running" | "done" | "error";
  tasks: { title: string; status: "pending" | "running" | "done" | "error" }[];
}

interface RunState {
  running: boolean;
  projectId: string | null;
  projectName: string | null;
  currentStep: string;
  currentPhase: PhaseName | null;
  phases: PhaseProgress[];
  documents: { type: string; numero: string; id: string; link: string }[];
  queueEntries: number;
  startedAt: string | null;
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

// =============================================================================
// Main Component
// =============================================================================

interface TestCycleRunnerProps {
  user: User | null;
}

const TestCycleRunner: React.FC<TestCycleRunnerProps> = ({ user }) => {
  const navigate = useNavigate();
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Config
  const [config, setConfig] = useState<TestConfig>({
    clientName: "Café La Paix",
    clientAddress: "Abidjan, Cocody, Rue des Jardins",
    clientPhone: "2250102030405",
    enseignes: DEFAULT_ENSEIGNES,
    reduction: 30000,
    useRealAgents: false,
  });

  // Run state
  const [run, setRun] = useState<RunState>({
    running: false,
    projectId: null,
    projectName: null,
    currentStep: "",
    currentPhase: null,
    phases: PHASES_CONFIG.map(p => ({
      ...p,
      status: "pending",
      tasks: [],
    })),
    documents: [],
    queueEntries: 0,
    startedAt: null,
  });

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [showConfig, setShowConfig] = useState(true);
  const [running, setRunning] = useState(false);
  const runRef = useRef(false);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Log helper
  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    setLogs(prev => [...prev.slice(-200), {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString("fr-FR"),
      level,
      message,
    }]);
  }, []);

  // RPC next_document_number
  const getNextNumber = useCallback(async (type: string): Promise<string> => {
    const { data, error } = await supabase.rpc("next_document_number", {
      p_doc_type: type,
    });
    if (error) throw error;
    return String(data).replace(/"/g, "");
  }, []);

  // Attach document to project
  const attachDocument = useCallback(async (projectId: string, key: string, msgId: string) => {
    const { data: proj } = await supabase
      .from("projects")
      .select("templates")
      .eq("id", projectId)
      .single();

    const templates = (proj?.templates as Record<string, string[]>) || {};
    const list = templates[key] || [];
    if (!list.includes(msgId)) {
      list.push(msgId);
      templates[key] = list;
      await supabase.from("projects").update({ templates }).eq("id", projectId);
    }
  }, []);

  // Create document directly in messages
  const createDocument = useCallback(async (
    projectId: string,
    templateType: string,
    data: Record<string, any>,
    templateKey: string,
  ) => {
    const msg = await supabase
      .from("messages")
      .insert({
        template_type: templateType,
        template_data: { data },
        project_id: projectId,
        user_id: "test_runner",
        sender: "system",
        content: `${templateType} ${data[`${templateType}Numero`] || data.cdcNumero}`,
        session_id: `test-${Date.now()}`,
        session_type: "chat",
      })
      .select("id")
      .single();

    if (msg.error) throw msg.error;
    await attachDocument(projectId, templateKey, msg.data.id);
    return msg.data.id;
  }, [attachDocument]);

  // Create task
  const createTask = useCallback(async (
    projectId: string,
    title: string,
    assignee: string,
    priority: string,
    due: string,
    isValidation = false,
    active = true,
  ) => {
    const { data, error } = await supabase
      .from("project_tasks")
      .insert({
        project_id: projectId,
        title,
        kanban_column: "a_faire",
        assignee,
        priority,
        due_date: due,
        is_phase_validation: isValidation,
        active,
        created_by: "test_runner",
      })
      .select("id")
      .single();

    if (error) throw error;
    return data;
  }, []);

  // Create checklist
  const createChecklist = useCallback(async (
    projectId: string,
    taskId: string,
    title: string,
    section: string,
    itemLabels: string[],
  ) => {
    const items = itemLabels.map(label => ({
      id: makeUUID(),
      label,
      done: false,
    }));

    const { error } = await supabase
      .from("checklists")
      .insert({
        project_id: projectId,
        task_id: taskId,
        title,
        section,
        items,
      });

    if (error) throw error;
  }, []);

  // Insert queue entry
  const insertQueue = useCallback(async (
    projectId: string,
    action: string,
    payload: Record<string, any>,
  ) => {
    await supabase.from("communicator_queue").insert({
      project_id: projectId,
      direction: "pm_to_communicator",
      action,
      status: "pending",
      retry_count: 0,
      payload,
    });
  }, []);

  // ===========================================================================
  // Main runner
  // ===========================================================================

  const runTestCycle = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;
    setRunning(true);
    setShowConfig(false);
    setLogs([]);

    const newPhases = PHASES_CONFIG.map(p => ({
      ...p,
      status: "pending" as const,
      tasks: [] as { title: string; status: "pending" | "running" | "done" | "error" }[],
    }));
    setRun(prev => ({ ...prev, phases: newPhases, startedAt: new Date().toISOString(), documents: [], queueEntries: 0 }));

    try {
      // ── STEP 1: Create project ──
      addLog("phase", "━━━ ÉTAPE 1/6 : Création du projet ━━━");
      const projectId = makeUUID();
      const projectName = `TEST AUTO — ${config.clientName} (${todayISO()})`;

      const { error: projErr } = await supabase.from("projects").insert({
        id: projectId,
        name: projectName,
        description: `Projet test — ${config.clientName} — ${config.clientAddress}`,
        phase: null,
        status: "actif",
        session_id: `test-${projectId.slice(0, 8)}`,
        created_by: "test_runner",
        templates: { factures: [], commandes: [], cahiers_des_charges: [], devis: [] },
      });

      if (projErr) throw projErr;
      addLog("success", `✅ Projet créé : ${projectName}`);
      addLog("info", `🆔 ${projectId}`);

      setRun(prev => ({ ...prev, projectId, projectName }));

      // ── STEP 2: Create invoice ──
      addLog("phase", "━━━ ÉTAPE 2/6 : Création de la facture ━━━");

      const factureNumero = await getNextNumber("facture");
      const details = config.enseignes.map(e => ({
        id: makeUUID(),
        description: `${e.nom} — ${e.dimensions}`,
        quantite: e.quantite,
        prix_unitaire: e.prixUnitaire,
        sous_total: e.quantite * e.prixUnitaire,
      }));
      const totalBrut = details.reduce((s, d) => s + d.sous_total, 0);
      const total = totalBrut - config.reduction;

      const factureData = {
        factureNumero,
        dateEmission: todayISO(),
        client: { nom: config.clientName, adresse: config.clientAddress, telephone: config.clientPhone },
        details,
        reduction: config.reduction,
        total,
        version: 1,
        is_latest: true,
        statut: "Brouillon",
      };

      const factureMsgId = await createDocument(projectId, "facture", factureData, "factures");
      addLog("success", `✅ Facture ${factureNumero} créée — ${total.toLocaleString()} FCFA (réduction: ${config.reduction.toLocaleString()})`);
      addLog("info", `📄 ID: ${factureMsgId.slice(0, 8)}...`);

      setRun(prev => ({
        ...prev,
        documents: [...prev.documents, { type: "Facture", numero: factureNumero, id: factureMsgId, link: `/public/doc/${factureMsgId}` }],
      }));

      // ── STEP 3: Derive → Commande ──
      addLog("phase", "━━━ ÉTAPE 3/6 : Dérivation Facture → Commande ━━━");

      const cmdNumero = await getNextNumber("commande");
      const items = details.map(d => ({
        id: makeUUID(),
        nom: d.description,
        quantite: d.quantite,
        prix_unitaire: d.prix_unitaire,
        sous_total: d.sous_total,
      }));

      const commandeData = {
        commandeNumero: cmdNumero,
        client: factureData.client,
        items,
        reduction: config.reduction,
        total,
        statut: "En attente",
        version: 1,
        is_latest: true,
        linked_facture_id: factureNumero,
      };

      const cmdMsgId = await createDocument(projectId, "commande", commandeData, "commandes");
      addLog("success", `✅ Commande ${cmdNumero} créée — liée à ${factureNumero}`);
      addLog("info", `📄 ID: ${cmdMsgId.slice(0, 8)}...`);

      setRun(prev => ({
        ...prev,
        documents: [...prev.documents, { type: "Commande", numero: cmdNumero, id: cmdMsgId, link: `/public/doc/${cmdMsgId}` }],
      }));

      // ── STEP 4: Derive → CDC ──
      addLog("phase", "━━━ ÉTAPE 4/6 : Dérivation Commande → CDC ━━━");

      const cdcNumero = await getNextNumber("cahier_des_charges");
      const enseignesCdc = config.enseignes.map((e, i) => ({
        id: makeUUID(),
        nom: `${e.nom} — ${e.dimensions}`,
        type: e.type,
        dimensions: e.dimensions,
        quantite: e.quantite,
        materiaux: i === 0
          ? ["Panneau Dibond 3mm", "LED 5050 RGB", "Alimentation 12V 150W"]
          : ["Support transparent", "Tube néon LED", "Alimentation 12V 60W"],
      }));

      const cdcData = {
        cdcNumero,
        client: factureData.client,
        enseignes: enseignesCdc,
        equipe: {
          chef_technique: ASSIGNEES.chef_technique,
          superviseur_logistique: ASSIGNEES.superviseur_logistique,
          technicien_adjoint: ASSIGNEES.technicien_adjoint,
        },
        deliveryAddress: config.clientAddress,
        commande_id: cmdNumero,
        version: 1,
        is_latest: true,
      };

      const cdcMsgId = await createDocument(projectId, "cahier_des_charges", cdcData, "cahiers_des_charges");
      addLog("success", `✅ CDC ${cdcNumero} créé — ${config.enseignes.length} enseigne(s)`);
      for (const e of enseignesCdc) {
        addLog("info", `   📐 ${e.nom} — ${e.dimensions}`);
      }

      setRun(prev => ({
        ...prev,
        documents: [...prev.documents, { type: "CDC", numero: cdcNumero, id: cdcMsgId, link: `/public/doc/${cdcMsgId}` }],
      }));

      // ── STEP 5: Initialize project (phase facturation) ──
      addLog("phase", "━━━ ÉTAPE 5/6 : Initialisation du projet ━━━");
      await supabase.from("projects").update({ phase: "facturation", status: "actif" }).eq("id", projectId);

      // Create facturation tasks
      const factuTasks: { id: string; title: string; assignee: string; active: boolean }[] = [];

      const t1 = await createTask(projectId, "Vérifier le paiement client", "commerciale", "high", dueDate(3));
      factuTasks.push({ ...t1, title: "Vérifier le paiement client", assignee: "commerciale", active: true });
      await createChecklist(projectId, t1.id, "Vérification paiement", "facturation", [
        "Vérifier les coordonnées bancaires du client",
        "Confirmer la réception de l'acompte (50%)",
        "Noter la référence du virement",
        "Mettre à jour le statut de la facture",
      ]);

      const t2 = await createTask(projectId, "Envoyer la facture au client", "commerciale", "medium", dueDate(1));
      factuTasks.push({ ...t2, title: "Envoyer la facture au client", assignee: "commerciale", active: true });
      await createChecklist(projectId, t2.id, "Envoi facture", "facturation", [
        "Générer le PDF de la facture",
        "Envoyer par email au client",
        "Envoyer le lien WhatsApp",
        "Confirmer la réception par le client",
      ]);

      const tVal = await createTask(projectId, "Valider la phase facturation", "directrice_adjointe", "high", dueDate(5), true, false);
      factuTasks.push({ ...tVal, title: "Valider la phase facturation", assignee: "directrice_adjointe", active: false });
      await createChecklist(projectId, tVal.id, "Validation — Facturation", "facturation", [
        "Vérifier que le paiement est bien reçu",
        "Vérifier que la facture est envoyée",
        "Valider le passage en phase commande",
      ]);

      // Insert phase_started
      await insertQueue(projectId, "phase_started", {
        project_id: projectId,
        project_name: projectName,
        phase: "facturation",
        previous_phase: null,
        enseigne_count: config.enseignes.length,
        tasks: factuTasks.filter(t => t.active).map(t => ({
          title: t.title,
          assignee_name: ASSIGNEES[t.assignee] || t.assignee,
          due_date: dueDate(3),
        })),
      });

      await supabase.from("project_phase_history").insert({
        project_id: projectId,
        phase: "facturation",
        action: "started",
        performed_by: "test_runner",
      });

      addLog("success", `✅ Phase 'facturation' initialisée — ${factuTasks.filter(t => t.active).length} tâches actives + 1 validation`);

      // Update phases display
      const updatedPhases = [...newPhases];
      updatedPhases[0] = {
        ...updatedPhases[0],
        status: "running",
        tasks: factuTasks.map(t => ({ title: t.title, status: "running" as const })),
      };
      setRun(prev => ({ ...prev, phases: updatedPhases, currentPhase: "facturation", queueEntries: prev.queueEntries + 1 }));

      // ── STEP 6: Complete all phases with 2-step checklists ──
      addLog("phase", "━━━ ÉTAPE 6/6 : Cycle des phases (2-step checklists) ━━━");

      const allPhases: PhaseName[] = ["facturation", "commande", "fabrication", "livraison"];

      for (let phaseIdx = 0; phaseIdx < allPhases.length; phaseIdx++) {
        const phase = allPhases[phaseIdx];
        addLog("phase", `─── Phase ${phase.toUpperCase()} ───`);

        // Get checklists for this phase
        const { data: checklists } = await supabase
          .from("checklists")
          .select("id, task_id, title, items, section")
          .eq("project_id", projectId)
          .eq("section", phase);

        if (!checklists || checklists.length === 0) {
          addLog("warning", `⚠️ Aucune checklist trouvée pour ${phase}`);
          continue;
        }

        for (const cl of checklists) {
          const items = (cl.items as any[]) || [];
          if (items.length === 0) continue;

          const { data: task } = await supabase
            .from("project_tasks")
            .select("id, title, kanban_column, assignee, is_phase_validation, active")
            .eq("id", cl.task_id)
            .single();

          if (!task) continue;

          const isValidation = task.is_phase_validation;
          const assigneeName = ASSIGNEES[task.assignee] || task.assignee || "?";

          // ── Step A: Check 1 item (progress) ──
          const firstUnchecked = items.find(it => !it.done);
          if (firstUnchecked) {
            firstUnchecked.done = true;
            firstUnchecked.done_at = new Date().toISOString();

            await supabase.from("checklists").update({ items }).eq("id", cl.id);

            if (task.kanban_column === "a_faire") {
              await supabase.from("project_tasks").update({ kanban_column: "en_cours" }).eq("id", task.id);
            }

            await insertQueue(projectId, "checklist_progress", {
              task_id: task.id,
              task_title: task.title,
              checklist_id: cl.id,
              checklist_title: cl.title,
              done_by: assigneeName,
              progress: `1/${items.length}`,
              timestamp: new Date().toISOString(),
            });

            addLog("step", `📊 Progress — ${cl.title}: ${Math.round(100 / items.length)}% (1/${items.length}) — ${assigneeName}${isValidation ? " 🔒" : ""}`);
          }

          // ── Step B: Check all items (task completed) ──
          const { data: refreshed } = await supabase
            .from("checklists")
            .select("items")
            .eq("id", cl.id)
            .single();

          const refreshedItems = (refreshed?.items as any[]) || items;
          for (const item of refreshedItems) {
            if (!item.done) {
              item.done = true;
              item.done_at = new Date().toISOString();
            }
          }

          await supabase.from("checklists").update({ items: refreshedItems }).eq("id", cl.id);
          await supabase.from("project_tasks").update({
            kanban_column: "termine",
            completed_at: new Date().toISOString(),
          }).eq("id", task.id);

          await insertQueue(projectId, "task_completed", {
            task_id: task.id,
            task_title: task.title,
            checklist_id: cl.id,
            done_by: assigneeName,
            confidence: "high",
            timestamp: new Date().toISOString(),
          });

          addLog("success", `✅ Completed — ${cl.title}: 100% (${refreshedItems.length}/${refreshedItems.length}) — ${assigneeName}${isValidation ? " 🔒" : ""}`);

          setRun(prev => ({ ...prev, queueEntries: prev.queueEntries + 2 }));
          await new Promise(r => setTimeout(r, 200)); // Small delay for visual feedback
        }

        // Mark phase done
        updatedPhases[phaseIdx] = { ...updatedPhases[phaseIdx], status: "done" };

        // Transition to next phase
        if (phaseIdx < allPhases.length - 1) {
          const nextPhase = allPhases[phaseIdx + 1];
          addLog("phase", `🚀 Transition → ${nextPhase.toUpperCase()}`);

          const nextTasks = await createPhaseTasks(projectId, projectName, nextPhase, phase);
          updatedPhases[phaseIdx + 1] = {
            ...updatedPhases[phaseIdx + 1],
            status: "running",
            tasks: nextTasks.map(t => ({ title: t.title, status: "running" as const })),
          };

          setRun(prev => ({ ...prev, phases: [...updatedPhases], currentPhase: nextPhase }));
        } else {
          // Mark project as complete
          await supabase.from("projects").update({ status: "termine", phase: "termine" }).eq("id", projectId);
          addLog("success", "🏁 Projet marqué 'terminé'");
        }

        setRun(prev => ({ ...prev, phases: [...updatedPhases] }));
        await new Promise(r => setTimeout(r, 500));
      }

      // Final report
      const { count: queueCount } = await supabase
        .from("communicator_queue")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);

      addLog("success", "═══════════════════════════════════");
      addLog("success", `🎉 CYCLE TERMINÉ — ${projectName}`);
      addLog("success", `📊 ${allPhases.length} phases | ${queueCount || 0} entrées queue | ${run.documents.length + 3} documents`);
      addLog("info", `🔗 /projects/${projectId}`);

      setRun(prev => ({
        ...prev,
        queueEntries: queueCount || prev.queueEntries,
        phases: updatedPhases.map(p => ({ ...p, status: "done" as const })),
      }));

    } catch (err: any) {
      addLog("error", `❌ Erreur : ${err.message || err}`);
      console.error(err);
    } finally {
      runRef.current = false;
      setRunning(false);
    }
  }, [config, addLog, getNextNumber, createDocument, createTask, createChecklist, insertQueue]);

  // Create phase tasks helper
  const createPhaseTasks = async (
    projectId: string,
    projectName: string,
    phase: PhaseName,
    prevPhase: PhaseName,
  ) => {
    await supabase.from("projects").update({ phase }).eq("id", projectId);

    const tasks: { id: string; title: string; assignee: string; active: boolean }[] = [];

    if (phase === "commande") {
      const t1 = await createTask(projectId, "Créer le bon de commande fournisseur", "chef_technique", "high", dueDate(3));
      tasks.push({ ...t1, title: "Créer le bon de commande fournisseur", assignee: "chef_technique", active: true });
      await createChecklist(projectId, t1.id, "Bon de commande fournisseur", "commande", [
        "Lister les matériaux nécessaires", "Contacter le fournisseur (devis)", "Valider le bon de commande", "Envoyer le bon de commande",
      ]);

      const t2 = await createTask(projectId, "Vérifier les délais de livraison", "superviseur_logistique", "medium", dueDate(2));
      tasks.push({ ...t2, title: "Vérifier les délais de livraison", assignee: "superviseur_logistique", active: true });
      await createChecklist(projectId, t2.id, "Délais livraison", "commande", [
        "Vérifier les stocks fournisseur", "Confirmer les délais de livraison", "Planifier la réception",
      ]);

      const tVal = await createTask(projectId, "Valider la phase commande", "directrice_adjointe", "high", dueDate(5), true, false);
      tasks.push({ ...tVal, title: "Valider la phase commande", assignee: "directrice_adjointe", active: false });
      await createChecklist(projectId, tVal.id, "Validation — Commande", "commande", [
        "Vérifier que le bon de commande est envoyé", "Vérifier les délais confirmés", "Valider le passage en phase fabrication",
      ]);
    } else if (phase === "fabrication") {
      const t1 = await createTask(projectId, "Découpe et assemblage — Enseigne 3D", "chef_technique", "critical", dueDate(7));
      tasks.push({ ...t1, title: "Découpe et assemblage — Enseigne 3D", assignee: "chef_technique", active: true });
      await createChecklist(projectId, t1.id, "Fabrication Enseigne 3D", "fabrication", [
        "Découpe du panneau Dibond aux dimensions", "Assemblage du cadre aluminium", "Pose des LEDs 5050 RGB", "Câblage électrique et test", "Photo de l'enseigne terminée (obligatoire)",
      ]);

      const t2 = await createTask(projectId, "Assemblage — Néon transparent", "technicien_adjoint", "high", dueDate(5));
      tasks.push({ ...t2, title: "Assemblage — Néon transparent", assignee: "technicien_adjoint", active: true });
      await createChecklist(projectId, t2.id, "Fabrication Néon", "fabrication", [
        "Découpe du support transparent", "Pose du tube néon LED", "Câblage et test d'allumage", "Photo du néon terminé (obligatoire)",
      ]);

      const tVal = await createTask(projectId, "Valider la phase fabrication", "directeur", "high", dueDate(8), true, false);
      tasks.push({ ...tVal, title: "Valider la phase fabrication", assignee: "directeur", active: false });
      await createChecklist(projectId, tVal.id, "Validation — Fabrication", "fabrication", [
        "Inspecter les enseignes fabriquées", "Vérifier la conformité CDC", "Valider le passage en livraison",
      ]);
    } else if (phase === "livraison") {
      const t1 = await createTask(projectId, "Préparer la livraison", "superviseur_logistique", "high", dueDate(2));
      tasks.push({ ...t1, title: "Préparer la livraison", assignee: "superviseur_logistique", active: true });
      await createChecklist(projectId, t1.id, "Préparation livraison", "livraison", [
        "Emballer les enseignes (protection mousse)", "Préparer le kit d'installation", "Vérifier la check-list matériel", "Charger le véhicule",
      ]);

      const t2 = await createTask(projectId, "Installation chez le client", "chef_technique", "critical", dueDate(3));
      tasks.push({ ...t2, title: "Installation chez le client", assignee: "chef_technique", active: true });
      await createChecklist(projectId, t2.id, "Installation client", "livraison", [
        "Déballer et inspecter les enseignes", "Fixer l'enseigne 3D au mur", "Installer le néon transparent", "Raccorder l'alimentation électrique", "Test final — photo obligatoire",
      ]);

      const tVal = await createTask(projectId, "Valider la phase livraison", "directrice_adjointe", "high", dueDate(5), true, false);
      tasks.push({ ...tVal, title: "Valider la phase livraison", assignee: "directrice_adjointe", active: false });
      await createChecklist(projectId, tVal.id, "Validation — Livraison", "livraison", [
        "Vérifier la satisfaction client", "Récupérer le bon de livraison signé", "Valider la clôture du projet",
      ]);
    }

    // Insert phase_started & history
    await insertQueue(projectId, "phase_started", {
      project_id: projectId,
      project_name: projectName,
      phase,
      previous_phase: prevPhase,
      enseigne_count: config.enseignes.length,
      tasks: tasks.filter(t => t.active).map(t => ({
        title: t.title,
        assignee_name: ASSIGNEES[t.assignee] || t.assignee,
        due_date: dueDate(3),
      })),
    });

    await supabase.from("project_phase_history").insert({
      project_id: projectId,
      phase,
      action: "started",
      performed_by: "test_runner",
    });

    addLog("success", `✅ Phase '${phase}' — ${tasks.filter(t => t.active).length} tâches actives + 1 validation`);
    return tasks;
  };

  // ===========================================================================
  // Quick invoice creation (standalone)
  // ===========================================================================
  const [quickInvoiceLoading, setQuickInvoiceLoading] = useState(false);
  const [quickInvoiceResult, setQuickInvoiceResult] = useState<{ numero: string; id: string } | null>(null);

  const createQuickInvoice = async () => {
    setQuickInvoiceLoading(true);
    setQuickInvoiceResult(null);
    try {
      const numero = await getNextNumber("facture");
      const factureData = {
        factureNumero: numero,
        dateEmission: todayISO(),
        client: { nom: config.clientName, adresse: "", telephone: "" },
        details: [],
        total: 0,
        version: 1,
        is_latest: true,
        statut: "Brouillon",
      };

      const { data, error } = await supabase
        .from("messages")
        .insert({
          template_type: "facture",
          template_data: { data: factureData },
          user_id: "test_runner",
          sender: "system",
          content: `Facture ${numero} — ${config.clientName}`,
          session_id: `quick-${Date.now()}`,
          session_type: "chat",
        })
        .select("id")
        .single();

      if (error) throw error;
      setQuickInvoiceResult({ numero, id: data.id });
      addLog("success", `✅ Facture vierge ${numero} créée pour ${config.clientName}`);
    } catch (err: any) {
      addLog("error", `❌ Erreur création facture : ${err.message}`);
    } finally {
      setQuickInvoiceLoading(false);
    }
  };

  // ===========================================================================
  // Render
  // ===========================================================================

  const getPhaseIcon = (status: string) => {
    switch (status) {
      case "done": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "running": return <Loader2 className="h-5 w-5 text-brand-orange animate-spin" />;
      case "error": return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case "success": return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
      case "error": return <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case "warning": return <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      case "phase": return <Zap className="h-3.5 w-3.5 text-brand-orange shrink-0" />;
      case "step": return <ArrowRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
      default: return <Circle className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
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
            Simulation complète du cycle projet : création → documents → initialisation → 4 phases
          </p>
        </div>
        <button
          onClick={() => navigate("/projects")}
          className="text-sm text-gray-500 hover:text-brand-orange flex items-center gap-1"
        >
          <Eye className="h-4 w-4" />
          Voir les projets
        </button>
      </div>

      {/* Quick Invoice Card */}
      <div className="mb-6 p-4 bg-white rounded-xl border-2 border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Créer une facture vierge</h3>
              <p className="text-xs text-gray-500">Pour le client : {config.clientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {quickInvoiceResult && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-600 font-mono">{quickInvoiceResult.numero}</span>
                <button
                  onClick={() => window.open(`/public/doc/${quickInvoiceResult.id}`, "_blank")}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
                </button>
              </div>
            )}
            <button
              onClick={createQuickInvoice}
              disabled={quickInvoiceLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {quickInvoiceLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Créer facture vierge
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Config + Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Config Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border-2 border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Bot className="h-4 w-4 text-brand-orange" />
                Configuration
              </h3>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showConfig ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>

            {showConfig && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Client</label>
                  <input
                    type="text"
                    value={config.clientName}
                    onChange={e => setConfig({ ...config, clientName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange outline-none"
                    disabled={running}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Réduction (FCFA)</label>
                    <input
                      type="number"
                      value={config.reduction}
                      onChange={e => setConfig({ ...config, reduction: parseInt(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange outline-none"
                      disabled={running}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Enseignes</label>
                    <div className="mt-1 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
                      {config.enseignes.length} enseigne(s)
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <button
                    onClick={runTestCycle}
                    disabled={running}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-orange text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-semibold transition-colors"
                  >
                    {running ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                    {running ? "Exécution en cours..." : "🚀 Lancer le cycle complet"}
                  </button>

                  {running && (
                    <p className="text-xs text-center text-gray-400 mt-2">
                      <Clock className="h-3 w-3 inline mr-1" />
                      ~10 secondes
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Phase Progress */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border-2 border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-brand-orange" />
              Progression
              {run.startedAt && (
                <span className="text-xs text-gray-400 ml-auto">
                  Démarré à {new Date(run.startedAt).toLocaleTimeString("fr-FR")}
                </span>
              )}
            </h3>

            <div className="space-y-0">
              {run.phases.map((phase, idx) => (
                <div key={phase.phase} className="relative">
                  {/* Connector line */}
                  {idx < run.phases.length - 1 && (
                    <div className={`absolute left-[19px] top-10 bottom-0 w-0.5 ${
                      phase.status === "done" ? "bg-green-400" : "bg-gray-200"
                    }`} />
                  )}

                  <div
                    className="flex items-center gap-3 py-2 cursor-pointer"
                    onClick={() => {
                      const next = new Set(expandedPhases);
                      if (next.has(phase.phase)) next.delete(phase.phase);
                      else next.add(phase.phase);
                      setExpandedPhases(next);
                    }}
                  >
                    <div className="relative z-10">
                      {getPhaseIcon(phase.status)}
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-gray-500">{phase.icon}</span>
                      <span className={`font-medium text-sm ${
                        phase.status === "running" ? "text-brand-orange" :
                        phase.status === "done" ? "text-green-700" : "text-gray-400"
                      }`}>
                        {phase.label}
                      </span>
                      {phase.status === "running" && (
                        <span className="text-xs text-brand-orange animate-pulse">en cours...</span>
                      )}
                      {phase.status === "done" && phase.tasks.length > 0 && (
                        <span className="text-xs text-green-600 ml-auto">
                          {phase.tasks.length} tâches
                        </span>
                      )}
                    </div>
                    {phase.tasks.length > 0 && (
                      expandedPhases.has(phase.phase)
                        ? <ChevronDown className="h-4 w-4 text-gray-400" />
                        : <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>

                  {/* Expanded tasks */}
                  {expandedPhases.has(phase.phase) && phase.tasks.length > 0 && (
                    <div className="ml-10 mt-1 mb-2 space-y-1">
                      {phase.tasks.map((task, ti) => (
                        <div key={ti} className="flex items-center gap-2 text-xs text-gray-500">
                          {task.status === "done" ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                          ) : task.status === "running" ? (
                            <Loader2 className="h-3 w-3 text-brand-orange animate-spin shrink-0" />
                          ) : (
                            <Circle className="h-3 w-3 text-gray-300 shrink-0" />
                          )}
                          <span className={task.status === "done" ? "line-through text-gray-400" : ""}>
                            {task.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Documents list */}
            {run.documents.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Documents créés</h4>
                <div className="space-y-1">
                  {run.documents.map((doc, i) => (
                    <a
                      key={i}
                      href={doc.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs">{doc.numero}</span>
                      <span className="text-gray-400">—</span>
                      <span>{doc.type}</span>
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Queue summary */}
            {run.queueEntries > 0 && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="h-4 w-4 text-green-500" />
                  <span className="text-gray-600">
                    <strong>{run.queueEntries}</strong> entrées dans la queue Communicateur
                  </span>
                </div>
                {run.projectId && (
                  <button
                    onClick={() => navigate(`/projects/${run.projectId}`)}
                    className="text-sm text-brand-orange hover:underline flex items-center gap-1"
                  >
                    Voir le projet
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Log */}
      <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <TerminalIcon className="h-4 w-4" />
            Logs en direct
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{logs.length} entrées</span>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>
        <div
          ref={logContainerRef}
          className="h-96 overflow-y-auto p-4 font-mono text-xs space-y-0.5 scrollbar-thin"
        >
          {logs.length === 0 && (
            <div className="text-gray-600 flex items-center justify-center h-full">
              <div className="text-center">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Clique sur "Lancer le cycle complet" pour démarrer</p>
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
                "text-gray-300"
              }>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Simple terminal icon (avoid extra import)
const TerminalIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export default TestCycleRunner;
