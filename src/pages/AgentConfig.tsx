import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Save, RotateCcw, Check, Loader2, Pencil, Eye,
  Wifi, Inbox, MessageSquare, Users, Brain, BookOpen, Settings,
  Search, Plus, ChevronDown, ChevronUp, ExternalLink, Trash2, Play
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Profils ─────────────────────────────────────────────
const HERMES_PROFILES = [
  { key: 'hermes-wari', label: '💼 Wari', role: 'Commercial', instance: '#1' },
  { key: 'hermes-brico', label: '🔧 Brico', role: 'Technique', instance: '#1' },
  { key: 'hermes-pm', label: '📊 PM', role: 'Chef de projet', instance: '#1' },
  { key: 'hermes-sentinelle', label: '🛡️ Sentinelle', role: 'Veilleur', instance: '#1' },
  { key: 'hermes-notificateur', label: '🔔 Notificateur', role: 'Notifications', instance: '#1' },
  { key: 'hermes-pia', label: '💰 PIA', role: 'Comptabilité', instance: '#1' },
  { key: 'hermes-communicateur', label: '📱 Communicateur', role: 'WhatsApp', instance: '#2' },
] as const;

type ProfileKey = typeof HERMES_PROFILES[number]['key'];

// ── Providers / Modèles ─────────────────────────────────
const PROVIDERS = ['deepseek', 'openrouter', 'anthropic', 'openai', 'xai', 'google', 'mistral'];
const MODELS_BY_PROVIDER: Record<string, string[]> = {
  deepseek: ['deepseek-chat', 'deepseek-v4-flash', 'deepseek-v4-pro'],
  openrouter: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.5-pro'],
  anthropic: ['claude-sonnet-4', 'claude-opus-4', 'claude-haiku-3'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  xai: ['grok-4.20-reasoning', 'grok-3'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  mistral: ['mistral-large', 'mistral-medium'],
};

// ── Composant principal ─────────────────────────────────
const AgentConfig: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // SOUL.md
  const [soulContent, setSoulContent] = useState<Record<string, string>>({});
  const [soulOriginal, setSoulOriginal] = useState<Record<string, string>>({});
  const [soulLoading, setSoulLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string>("hermes-pm");

  // Autosave debounce refs
  const soulTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [soulSaving, setSoulSaving] = useState<Record<string, boolean>>({});
  const [soulSaved, setSoulSaved] = useState<Record<string, boolean>>({}); // flash "✔ Sauvegardé"

  // Modèle/Provider
  const [model, setModel] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState<Record<string, string>>({});
  const [reasoning, setReasoning] = useState<Record<string, string>>({});
  const [modelOrig, setModelOrig] = useState<Record<string, string>>({});
  const [providerOrig, setProviderOrig] = useState<Record<string, string>>({});
  const [reasoningOrig, setReasoningOrig] = useState<Record<string, string>>({});
  const [savingModel, setSavingModel] = useState(false);

  // Health check
  const [healthStatus, setHealthStatus] = useState<Record<string, 'loading' | 'ok' | 'error'>>({});

  // Skills
  const [skills, setSkills] = useState<Record<string, { name: string; size: number }[]>>({});
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [skillView, setSkillView] = useState<{ name: string; content: string } | null>(null);
  const [skillEdit, setSkillEdit] = useState<{ name: string; content: string } | null>(null);
  const [skillNew, setSkillNew] = useState(false); // modal création
  const [skillNewName, setSkillNewName] = useState("");
  const [skillNewContent, setSkillNewContent] = useState("");
  const [savingSkill, setSavingSkill] = useState(false);

  // Test agent
  const [testOpen, setTestOpen] = useState(false);
  const [testPrompt, setTestPrompt] = useState("Bonjour, réponds uniquement par 'OK' pour confirmer que tu fonctionnes.");
  const [testResponse, setTestResponse] = useState("");
  const [testRunning, setTestRunning] = useState(false);

  // Stats Communicateur — activité queue partagée PM/Comm
  const [commStats, setCommStats] = useState<{
    queue: { direction: string; pending: number; processed: number }[];
    contacts: number;
    recentQueue: { id: string; direction: string; action: string; status: string; preview: string; created_at: string }[];
  } | null>(null);
  const [commStatsLoading, setCommStatsLoading] = useState(false);

  // ── Charger SOUL.md ──────────────────────────────────
  const loadSoul = useCallback(async (profile: ProfileKey) => {
    setSoulLoading(prev => ({ ...prev, [profile]: true }));
    try {
      const res = await fetch(`/hermes/soul/${profile}`);
      const data = await res.json();
      if (data.success) {
        setSoulContent(prev => ({ ...prev, [profile]: data.content }));
        setSoulOriginal(prev => ({ ...prev, [profile]: data.content }));
        setSoulSaved(prev => ({ ...prev, [profile]: false }));
      }
    } catch { /* ignore */ }
    finally { setSoulLoading(prev => ({ ...prev, [profile]: false })); }
  }, []);

  // ── Autosave SOUL.md (debounce 2s) ───────────────────
  const autoSaveSoul = useCallback((profile: ProfileKey, content: string) => {
    // Clear previous timer
    if (soulTimers.current[profile]) clearTimeout(soulTimers.current[profile]);

    // Ne pas autosave si pas de changement ou si c'est le chargement initial
    if (content === soulOriginal[profile] || soulOriginal[profile] === undefined) return;

    soulTimers.current[profile] = setTimeout(async () => {
      setSoulSaving(prev => ({ ...prev, [profile]: true }));
      try {
        const res = await fetch(`/hermes/soul/${profile}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (data.success) {
          setSoulOriginal(prev => ({ ...prev, [profile]: content }));
          setSoulSaved(prev => ({ ...prev, [profile]: true }));
          setTimeout(() => setSoulSaved(prev => ({ ...prev, [profile]: false })), 2000);
        }
      } catch { /* ignore */ }
      finally { setSoulSaving(prev => ({ ...prev, [profile]: false })); }
    }, 2000);
  }, [soulOriginal]);

  // ── Charger modèle/provider ──────────────────────────
  const loadConfig = useCallback(async (profile: ProfileKey) => {
    try {
      const res = await fetch(`/hermes/config/${profile}`);
      const data = await res.json();
      if (data.success) {
        // Gère reasoning_effort (instance #1) ET reasoning (management-api via proxy)
        const re = data.reasoning_effort || data.reasoning || '';
        setModel(prev => ({ ...prev, [profile]: data.model || '' }));
        setProvider(prev => ({ ...prev, [profile]: data.provider || '' }));
        setReasoning(prev => ({ ...prev, [profile]: re }));
        setModelOrig(prev => ({ ...prev, [profile]: data.model || '' }));
        setProviderOrig(prev => ({ ...prev, [profile]: data.provider || '' }));
        setReasoningOrig(prev => ({ ...prev, [profile]: re }));
      }
    } catch { /* ignore */ }
  }, []);

  // ── Health check ─────────────────────────────────────
  const checkHealth = useCallback(async (profile: ProfileKey) => {
    setHealthStatus(prev => ({ ...prev, [profile]: 'loading' }));
    try {
      // Ping via GET /hermes/soul/:profile (teste la connectivité de l'agent)
      const res = await fetch(`/hermes/soul/${profile}`);
      const data = await res.json();
      setHealthStatus(prev => ({ ...prev, [profile]: data.success ? 'ok' : 'error' }));
    } catch {
      setHealthStatus(prev => ({ ...prev, [profile]: 'error' }));
    }
  }, []);

  // ── Charger skills ────────────────────────────────────
  const loadSkills = useCallback(async (profile: ProfileKey, force = false) => {
    if (!force && skills[profile]) return;
    setSkillsLoading(true);
    try {
      const res = await fetch(`/hermes/skills/${profile}`);
      const data = await res.json();
      if (data.success) setSkills(prev => ({ ...prev, [profile]: data.skills }));
    } catch { /* ignore */ }
    finally { setSkillsLoading(false); }
  }, [skills]);

  // ── Stats Communicateur / Activité Queue ───────────────
  const loadCommStats = useCallback(async (force = false) => {
    if (!force && commStats) return;
    setCommStatsLoading(true);
    try {
      const [queueRes, countRes, recentRes] = await Promise.all([
        supabase.from('communicator_queue').select('direction,status').order('created_at', { ascending: false }).limit(100),
        supabase.from('human_contacts').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('communicator_queue').select('id,direction,action,status,payload,created_at').order('created_at', { ascending: false }).limit(15),
      ]);
      const grouped: Record<string, { direction: string; pending: number; processed: number }> = {};
      for (const q of queueRes.data || []) {
        if (!grouped[q.direction]) grouped[q.direction] = { direction: q.direction, pending: 0, processed: 0 };
        if (q.status === 'pending') grouped[q.direction].pending++;
        else grouped[q.direction].processed++;
      }
      // Construire des previews lisibles depuis les payloads JSONB
      const recentQueue = (recentRes.data || []).map((q: any) => {
        let preview = '';
        try {
          const p = typeof q.payload === 'string' ? JSON.parse(q.payload) : q.payload;
          if (q.action === 'task_assigned') preview = p.message || p.task_title || '';
          else if (q.action === 'task_completed') preview = `${p.pct || '?'}% (${p.done || 0}/${p.total || 0})`;
          else if (q.action === 'checklist_progress') preview = `${p.pct || '?'}% (${p.done || 0}/${p.total || 0})`;
          else if (q.action === 'phase_started') preview = `${p.phase || ''} — ${(p.tasks || []).length} tâche(s)`;
          else if (q.action === 'project_deleted') preview = p.project_name || '';
          else preview = JSON.stringify(p).slice(0, 80);
        } catch { preview = ''; }
        return { id: q.id, direction: q.direction, action: q.action, status: q.status, preview, created_at: q.created_at };
      });
      setCommStats({
        queue: Object.values(grouped),
        contacts: countRes.count || 0,
        recentQueue,
      });
    } catch { /* ignore */ }
    finally { setCommStatsLoading(false); }
  }, [commStats]);

  // ── Effet principal ───────────────────────────────────
  useEffect(() => {
    const profile = activeTab as ProfileKey;
    if (!HERMES_PROFILES.some(p => p.key === profile)) return;
    loadSoul(profile);
    loadConfig(profile);
    loadSkills(profile);
    checkHealth(profile);
    if (profile === 'hermes-communicateur' || profile === 'hermes-pm') loadCommStats();
  }, [activeTab, loadSoul, loadConfig, loadSkills, checkHealth, loadCommStats]);

  // ── Cleanup autosave timers on unmount ───────────────
  useEffect(() => {
    return () => {
      Object.values(soulTimers.current).forEach(t => clearTimeout(t));
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────
  const handleSaveSoul = async (profile: ProfileKey) => {
    const content = soulContent[profile];
    if (!content?.trim()) return;
    // Clear autosave timer
    if (soulTimers.current[profile]) clearTimeout(soulTimers.current[profile]);
    setSoulSaving(prev => ({ ...prev, [profile]: true }));
    try {
      const res = await fetch(`/hermes/soul/${profile}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.success) {
        setSoulOriginal(prev => ({ ...prev, [profile]: content }));
        setSoulSaved(prev => ({ ...prev, [profile]: true }));
        setTimeout(() => setSoulSaved(prev => ({ ...prev, [profile]: false })), 2000);
        toast({ title: "SOUL.md sauvegardé ✅" });
      }
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
    finally { setSoulSaving(prev => ({ ...prev, [profile]: false })); }
  };

  const handleSoulChange = (profile: ProfileKey, value: string) => {
    setSoulContent(prev => ({ ...prev, [profile]: value }));
    autoSaveSoul(profile, value);
  };

  const handleSaveModel = async (profile: ProfileKey) => {
    setSavingModel(true);
    try {
      const res = await fetch(`/hermes/config/${profile}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model[profile], provider: provider[profile], reasoning_effort: reasoning[profile] || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setModelOrig(prev => ({ ...prev, [profile]: model[profile] }));
        setProviderOrig(prev => ({ ...prev, [profile]: provider[profile] }));
        setReasoningOrig(prev => ({ ...prev, [profile]: reasoning[profile] }));
        toast({ title: "Modèle mis à jour ✅" });
      }
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
    finally { setSavingModel(false); }
  };

  const viewSkill = async (name: string) => {
    const profile = activeTab as ProfileKey;
    try {
      const res = await fetch(`/hermes/skill/${profile}/${name}`);
      const data = await res.json();
      if (data.success) setSkillView({ name, content: data.content });
    } catch { /* ignore */ }
  };

  const editSkill = async (name: string) => {
    if (skillEdit?.name === name) return;
    const profile = activeTab as ProfileKey;
    try {
      const res = await fetch(`/hermes/skill/${profile}/${name}`);
      const data = await res.json();
      if (data.success) setSkillEdit({ name, content: data.content });
    } catch { /* ignore */ }
  };

  const handleSaveSkill = async () => {
    if (!skillEdit) return;
    setSavingSkill(true);
    const profile = activeTab as ProfileKey;
    try {
      const res = await fetch(`/hermes/skill/${profile}/${skillEdit.name}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: skillEdit.content }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: `Skill ${skillEdit.name} sauvegardé ✅` });
        setSkillEdit(null);
        loadSkills(profile, true);
      }
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
    finally { setSavingSkill(false); }
  };

  const handleCreateSkill = async () => {
    if (!skillNewName.trim()) return;
    setSavingSkill(true);
    const profile = activeTab as ProfileKey;
    try {
      const content = skillNewContent.trim() || `# ${skillNewName}\n\nNouveau skill AssoAI.\n`;
      const res = await fetch(`/hermes/skill/${profile}/${skillNewName.trim()}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: `Skill ${skillNewName} créé ✅` });
        setSkillNew(false);
        setSkillNewName("");
        setSkillNewContent("");
        loadSkills(profile, true);
      }
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
    finally { setSavingSkill(false); }
  };

  const handleDeleteSkill = async (name: string) => {
    const profile = activeTab as ProfileKey;
    try {
      // Suppression via PUT avec contenu vide (l'API supprime le fichier si content = "")
      const res = await fetch(`/hermes/skill/${profile}/${name}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: "", _delete: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: `Skill ${name} supprimé 🗑️` });
        loadSkills(profile, true);
      } else {
        toast({ title: data.error || "Erreur suppression", variant: "destructive" });
      }
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const handleTest = async () => {
    setTestRunning(true);
    setTestResponse("");
    const profile = activeTab as ProfileKey;
    try {
      const res = await fetch('/hermes/router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testPrompt,
          userId: 'agent-config-test',
          sessionId: `test-${Date.now()}`,
          profile,
          skills: [],
        }),
      });
      const data = await res.json();
      if (data.success && data.response) {
        setTestResponse(data.response.textFallback || JSON.stringify(data.response, null, 2));
      } else {
        setTestResponse(`❌ Erreur: ${data.error || 'Réponse vide'}`);
      }
    } catch (err: any) {
      setTestResponse(`❌ Exception: ${err.message}`);
    }
    finally { setTestRunning(false); }
  };

  // ── Helpers ───────────────────────────────────────────
  const modelChanged = (p: string) => model[p] !== modelOrig[p] || provider[p] !== providerOrig[p] || reasoning[p] !== reasoningOrig[p];
  const soulChanged = (p: string) => soulContent[p] !== undefined && soulContent[p] !== soulOriginal[p];
  const filteredSkills = (skills[activeTab] || []).filter(s =>
    !skillSearch || s.name.toLowerCase().includes(skillSearch.toLowerCase())
  );
  const profileInfo = HERMES_PROFILES.find(p => p.key === activeTab);
  const availableModels = MODELS_BY_PROVIDER[provider[activeTab]] || [];

  // ── Rendu ──────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b bg-gray-50">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <h1 className="text-lg font-bold">⚙️ Configuration des agents</h1>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex flex-wrap gap-1 h-auto">
            {HERMES_PROFILES.map(p => (
              <TabsTrigger key={p.key} value={p.key} className="gap-1 text-xs sm:text-sm">
                {p.label}
                {(modelChanged(p.key) || soulChanged(p.key)) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {HERMES_PROFILES.map(p => (
            <TabsContent key={p.key} value={p.key} className="space-y-4">
              {/* ── STATUT ──────────────────────────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Statut — {p.label} ({p.role})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3 text-sm items-center">
                    {healthStatus[p.key] === 'loading' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : healthStatus[p.key] === 'ok' ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">🟢 Online</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700">🔴 Offline</Badge>
                    )}
                    <span className="text-muted-foreground">
                      Modèle: <strong>{model[p.key] || '—'}</strong> (@{provider[p.key] || '—'})
                    </span>
                    <span className="text-muted-foreground">Instance {p.instance}</span>
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => checkHealth(p.key)} title="Vérifier la connexion">
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4" /> Modèle, Provider & Raisonnement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Provider</label>
                      <Select value={provider[p.key] || ''} onValueChange={v => setProvider(prev => ({ ...prev, [p.key]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          {PROVIDERS.map(pv => <SelectItem key={pv} value={pv}>{pv}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Modèle</label>
                      <Select value={model[p.key] || ''} onValueChange={v => setModel(prev => ({ ...prev, [p.key]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          {availableModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Raisonnement</label>
                      <Select value={reasoning[p.key] || ''} onValueChange={v => setReasoning(prev => ({ ...prev, [p.key]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Par défaut" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Button
                        size="sm"
                        onClick={() => handleSaveModel(p.key)}
                        disabled={!modelChanged(p.key) || savingModel}
                        className="bg-orange-500 hover:bg-orange-600 w-full"
                      >
                        {savingModel ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                        Sauvegarder
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── BOUTON TEST ──────────────────────────── */}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => { setTestOpen(true); setTestResponse(""); }}>
                  <Play className="h-3.5 w-3.5 mr-1" /> Tester l'agent
                </Button>
              </div>

              {/* ── STATS COMMUNICATEUR ──────────────────── */}
              {p.key === 'hermes-communicateur' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground">📊 Activité Communicateur</h3>
                    <Button variant="ghost" size="sm" onClick={() => { setCommStats(null); loadCommStats(true); }} disabled={commStatsLoading}>
                      {commStatsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      <span className="ml-1 text-xs">Rafraîchir</span>
                    </Button>
                  </div>
                  {commStats && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Card>
                          <CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1"><Wifi className="h-3 w-3 text-green-500" /> Bridge</CardTitle></CardHeader>
                          <CardContent><Badge variant="outline" className="bg-green-50 text-green-700 text-xs">🟢 Online</Badge></CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> Contacts</CardTitle></CardHeader>
                          <CardContent><span className="text-xl font-bold">{commStats.contacts}</span></CardContent>
                        </Card>
                      </div>
                      <Card>
                        <CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1"><Inbox className="h-3 w-3" /> Queue</CardTitle></CardHeader>
                        <CardContent>
                          {commStats.queue.map(s => (
                            <div key={s.direction} className="flex justify-between text-xs">
                              <span className="font-mono">{s.direction}</span>
                              <span>{s.pending > 0 && <Badge variant="outline" className="text-amber-600 text-xs mr-1">{s.pending} en attente</Badge>}{s.processed} traités</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Activité récente</CardTitle></CardHeader>
                        <CardContent>
                          {commStats.recentQueue.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Aucune activité</p>
                          ) : (
                            <div className="space-y-1 max-h-[180px] overflow-y-auto">
                              {commStats.recentQueue.map(q => (
                                <div key={q.id} className="flex items-start gap-2 text-xs py-0.5">
                                  <Badge variant="outline" className={`shrink-0 text-[10px] px-1 py-0 ${q.status === 'pending' ? 'border-amber-400 text-amber-600' : 'border-green-400 text-green-600'}`}>
                                    {q.status === 'pending' ? '⏳' : '✓'}
                                  </Badge>
                                  <span className="font-mono text-[10px] shrink-0 w-12 text-muted-foreground">
                                    {new Date(q.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                                  </span>
                                  <span className={`font-mono text-[10px] shrink-0 w-20 truncate ${q.direction === 'pm_to_communicator' ? 'text-blue-500' : 'text-purple-500'}`} title={q.direction}>
                                    {q.direction === 'pm_to_communicator' ? 'PM→Comm' : 'Comm→PM'}
                                  </span>
                                  <span className="font-mono text-[10px] shrink-0 w-24 truncate" title={q.action}>{q.action}</span>
                                  <span className="truncate text-muted-foreground">{q.preview}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              )}

              {/* ── ACTIVITÉ QUEUE PM ──────────────────── */}
              {p.key === 'hermes-pm' && commStats && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground">📊 Activité Queue PM</h3>
                    <Button variant="ghost" size="sm" onClick={() => { setCommStats(null); loadCommStats(true); }} disabled={commStatsLoading}>
                      {commStatsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      <span className="ml-1 text-xs">Rafraîchir</span>
                    </Button>
                  </div>
                  <Card>
                    <CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Activité récente</CardTitle></CardHeader>
                    <CardContent>
                      {commStats.recentQueue.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucune activité</p>
                      ) : (
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                          {commStats.recentQueue.map(q => (
                            <div key={q.id} className="flex items-start gap-2 text-xs py-0.5">
                              <Badge variant="outline" className={`shrink-0 text-[10px] px-1 py-0 ${q.status === 'pending' ? 'border-amber-400 text-amber-600' : 'border-green-400 text-green-600'}`}>
                                {q.status === 'pending' ? '⏳' : '✓'}
                              </Badge>
                              <span className="font-mono text-[10px] shrink-0 w-12 text-muted-foreground">
                                {new Date(q.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                              </span>
                              <span className={`font-mono text-[10px] shrink-0 w-20 truncate ${q.direction === 'pm_to_communicator' ? 'text-blue-500' : 'text-purple-500'}`} title={q.direction}>
                                {q.direction === 'pm_to_communicator' ? 'PM→Comm' : 'Comm→PM'}
                              </span>
                              <span className="font-mono text-[10px] shrink-0 w-24 truncate" title={q.action}>{q.action}</span>
                              <span className="truncate text-muted-foreground">{q.preview}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ── SOUL.MD ─────────────────────────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> SOUL.md</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => loadSoul(p.key)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Recharger
                      </Button>
                      <Button size="sm" onClick={() => handleSaveSoul(p.key)} disabled={!soulChanged(p.key) || soulSaving[p.key]}
                        className="bg-orange-500 hover:bg-orange-600">
                        {soulSaving[p.key] ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                        Sauvegarder
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {soulLoading[p.key] ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <>
                      <Textarea
                        value={soulContent[p.key] || ''}
                        onChange={e => handleSoulChange(p.key, e.target.value)}
                        className="font-mono text-xs min-h-[200px] max-h-[400px] resize-y"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {(soulContent[p.key] || '').length.toLocaleString()} car.
                        {soulSaved[p.key] && <span className="text-green-600 ml-2"><Check className="h-3 w-3 inline" /> Sauvegardé</span>}
                        {!soulSaved[p.key] && soulChanged(p.key) && <span className="text-orange-500 ml-2">● Modifications non sauvegardées</span>}
                        {!soulChanged(p.key) && soulContent[p.key] !== undefined && soulOriginal[p.key] !== undefined && !soulSaved[p.key] && (
                          <span className="text-muted-foreground ml-2">Synchronisé</span>
                        )}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* ── SKILLS ASSOAI ────────────────────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Skills AssoAI
                      {skills[p.key] && <Badge variant="outline" className="text-xs">{skills[p.key].length}</Badge>}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setSkillNew(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Nouveau skill
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-3">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Filtrer..."
                      className="pl-8 h-9 text-sm"
                      value={skillSearch}
                      onChange={e => setSkillSearch(e.target.value)}
                    />
                  </div>
                  {skillsLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : filteredSkills.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun skill</p>
                  ) : (
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                      {filteredSkills.map(s => (
                        <div key={s.name} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 text-sm">
                          <span className="truncate flex-1 font-mono text-xs">{s.name}</span>
                          <span className="text-xs text-muted-foreground mr-2">{Math.round(s.size / 1024)} KB</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => viewSkill(s.name)} title="Voir">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => editSkill(s.name)} title="Modifier">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteSkill(s.name)} title="Supprimer" className="text-red-500 hover:text-red-700">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* ── Modale voir skill ─────────────────────────── */}
      <Dialog open={!!skillView} onOpenChange={() => setSkillView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>📄 {skillView?.name}</DialogTitle></DialogHeader>
          <pre className="text-xs font-mono whitespace-pre-wrap bg-gray-50 p-4 rounded max-h-[60vh] overflow-y-auto">
            {skillView?.content}
          </pre>
        </DialogContent>
      </Dialog>

      {/* ── Modale éditer skill ────────────────────────── */}
      <Dialog open={!!skillEdit} onOpenChange={() => setSkillEdit(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>✏️ Modifier {skillEdit?.name}</DialogTitle></DialogHeader>
          <Textarea
            value={skillEdit?.content || ''}
            onChange={e => setSkillEdit(prev => prev ? { ...prev, content: e.target.value } : null)}
            className="font-mono text-xs flex-1 min-h-[400px] resize-y"
          />
          <DialogFooter className="gap-2 pt-3">
            <Button variant="outline" onClick={() => setSkillEdit(null)}>Annuler</Button>
            <Button onClick={handleSaveSkill} disabled={savingSkill} className="bg-orange-500 hover:bg-orange-600">
              {savingSkill ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modale créer skill ──────────────────────────── */}
      <Dialog open={skillNew} onOpenChange={setSkillNew}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>🆕 Nouveau skill</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nom du skill</label>
              <Input value={skillNewName} onChange={e => setSkillNewName(e.target.value)} placeholder="mon-nouveau-skill" className="font-mono text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Contenu initial (optionnel)</label>
              <Textarea
                value={skillNewContent}
                onChange={e => setSkillNewContent(e.target.value)}
                className="font-mono text-xs min-h-[150px]"
                placeholder={"---\nname: mon-skill\ndescription: Description courte\n---\n\n# Mon skill\n\nInstructions ici."}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-3">
            <Button variant="outline" onClick={() => { setSkillNew(false); setSkillNewName(""); setSkillNewContent(""); }}>Annuler</Button>
            <Button onClick={handleCreateSkill} disabled={savingSkill || !skillNewName.trim()} className="bg-orange-500 hover:bg-orange-600">
              {savingSkill ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modale tester agent ─────────────────────────── */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>🧪 Tester {profileInfo?.label}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prompt de test</label>
              <Textarea
                value={testPrompt}
                onChange={e => setTestPrompt(e.target.value)}
                className="font-mono text-xs min-h-[60px]"
              />
            </div>
            <Button onClick={handleTest} disabled={testRunning} className="bg-orange-500 hover:bg-orange-600 w-full">
              {testRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Envoyer
            </Button>
            {testResponse && (
              <div className="bg-gray-50 p-3 rounded text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {testResponse}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentConfig;
