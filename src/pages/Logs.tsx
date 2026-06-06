
import React, { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Trash2, RefreshCw, FileText, Database, MessageSquare, Upload, Info } from "lucide-react";
import { appLogger } from "@/utils/logger";
import { useToast } from "@/hooks/use-toast";

// ============================================================
// Configuration des sources de logs
// ============================================================
const SOURCE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  "prompt":       { label: "Prompt",       color: "bg-blue-100 text-blue-800 border-blue-300",   icon: <FileText className="h-3 w-3" /> },
  "db-injection": { label: "Injection DB", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: <Database className="h-3 w-3" /> },
  "response":     { label: "Réponse",      color: "bg-purple-100 text-purple-800 border-purple-300", icon: <MessageSquare className="h-3 w-3" /> },
  "upload":       { label: "Upload",       color: "bg-orange-100 text-orange-800 border-orange-300",  icon: <Upload className="h-3 w-3" /> },
  "chat":         { label: "Chat",         color: "bg-gray-100 text-gray-700 border-gray-300",     icon: <Info className="h-3 w-3" /> },
};
const DEFAULT_SOURCE_STYLE = "bg-gray-100 text-gray-600 border-gray-200";

const AGENTS = [
  { key: "all",   label: "Tous",   emoji: "📋" },
  { key: "wari",  label: "Wari",   emoji: "💼" },
  { key: "brico", label: "Brico",  emoji: "🔧" },
];

// ============================================================
// Composant principal
// ============================================================
const Logs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const loadLogs = () => {
    setLogs(appLogger.getLogs());
  };

  useEffect(() => {
    loadLogs();

    const handleLog = (event: any) => {
      if (event.detail?.type?.startsWith('APP_LOG')) {
        setLogs(prev => [...prev, event.detail]);
      }
    };

    window.addEventListener('app-log', handleLog);
    return () => window.removeEventListener('app-log', handleLog);
  }, []);

  // Filtrer les logs selon l'onglet actif
  const filteredLogs = useMemo(() => {
    if (activeTab === "all") return logs;
    return logs.filter((log) => {
      const agent = log.data?.agent;
      return agent === activeTab;
    });
  }, [logs, activeTab]);

  // Stats par source pour l'onglet courant
  const sourceStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredLogs.forEach((log) => {
      const src = log.data?.source || "autre";
      stats[src] = (stats[src] || 0) + 1;
    });
    return stats;
  }, [filteredLogs]);

  const getSourceBadge = (source: string) => {
    const cfg = SOURCE_CONFIG[source];
    if (cfg) {
      return (
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>
          {cfg.icon}
          {cfg.label}
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${DEFAULT_SOURCE_STYLE}`}>
        <Info className="h-3 w-3" />
        {source}
      </span>
    );
  };

  const handleClearLogs = () => {
    setIsClearing(true);
    try {
      const success = appLogger.clearLogs();
      if (success) {
        setLogs([]);
        toast({
          title: "Logs effacés",
          description: "Tous les logs ont été supprimés avec succès.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible d'effacer les logs.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur s'est produite lors de l'effacement des logs.",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleRefreshLogs = () => {
    setIsRefreshing(true);
    loadLogs();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // ============================================================
  // RENDU
  // ============================================================
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* En-tête */}
      <div className="border-b">
        <div className="container flex items-center gap-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-xl font-semibold">Logs de l'Application</h1>
          <div className="flex-1"></div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefreshLogs}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleClearLogs}
            disabled={isClearing || logs.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Effacer les logs
          </Button>
        </div>
      </div>
      
      {/* Contenu */}
      <div className="container py-6 flex-1 flex flex-col min-h-0">
        {/* Tabs agents */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              {AGENTS.map((a) => (
                <TabsTrigger key={a.key} value={a.key} className="gap-1.5">
                  <span>{a.emoji}</span>
                  {a.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Stats rapides */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}</span>
              {Object.entries(sourceStats).map(([src, count]) => (
                <span key={src} className="inline-flex items-center gap-1 text-xs">
                  {getSourceBadge(src)}
                  <span className="font-mono">{count}</span>
                </span>
              ))}
              {logs.length >= 100 && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">
                  Limite 100
                </span>
              )}
            </div>
          </div>

          {/* Contenu des tabs */}
          {AGENTS.map((a) => (
            <TabsContent key={a.key} value={a.key} className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
              <ScrollArea className="h-[calc(100vh-12rem)] rounded-lg border bg-card p-4">
                {filteredLogs.map((log, index) => (
                  <LogEntry key={index} log={log} getSourceBadge={getSourceBadge} />
                ))}
                {filteredLogs.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Aucun log disponible
                    {activeTab !== "all" && ` pour ${AGENTS.find(a => a.key === activeTab)?.label}`}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

// ============================================================
// Entrée de log individuelle
// ============================================================
const LogEntry = React.memo(({ log, getSourceBadge }: { log: any; getSourceBadge: (s: string) => React.ReactNode }) => {
  const source = log.data?.source || "autre";
  const agent = log.data?.agent;

  return (
    <div className="mb-3 p-3 rounded border bg-muted hover:bg-muted/80 transition-colors">
      {/* Ligne 1 : timestamp + type + source + agent */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(log.timestamp).toLocaleString()}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
          log.type === 'APP_LOG_ERROR'   ? 'bg-destructive text-destructive-foreground' :
          log.type === 'APP_LOG_WARNING' ? 'bg-yellow-200 text-yellow-900' :
          'bg-primary/10 text-primary'
        }`}>
          {log.type.replace('APP_LOG_', '')}
        </span>
        {getSourceBadge(source)}
        {agent && (
          <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
            {agent === "wari" ? "💼 Wari" : agent === "brico" ? "🔧 Brico" : agent}
          </span>
        )}
      </div>

      {/* Ligne 2 : message */}
      <div className="text-sm mb-1">
        <span className="font-medium">Message:</span> {log.message}
      </div>

      {/* Ligne 3 : données (JSON formaté, avec sections selon source) */}
      {log.data && (
        <LogDetails log={log} source={source} />
      )}
    </div>
  );
});
LogEntry.displayName = "LogEntry";

// ============================================================
// Détails du log selon la source
// ============================================================
const LogDetails = React.memo(({ log, source }: { log: any; source: string }) => {
  const data = log.data;

  // Prompt : afficher le preview
  if (source === "prompt" && data.prompt_preview) {
    return (
      <div className="mt-2 space-y-1">
        <div className="text-xs text-muted-foreground">
          Taille : {(data.prompt_len || 0).toLocaleString()} caractères
        </div>
        <pre className="text-xs bg-background p-2 rounded border overflow-x-auto max-h-48 whitespace-pre-wrap">
          {data.prompt_preview}
          {(data.prompt_len > 500) && <span className="text-muted-foreground">… (tronqué à 500 car.)</span>}
        </pre>
      </div>
    );
  }

  // Injection DB : afficher le preview
  if (source === "db-injection" && data.injected_preview) {
    return (
      <div className="mt-2 space-y-1">
        <div className="flex gap-3 text-xs text-muted-foreground">
          {data.products_count != null && <span>{data.products_count} produits</span>}
          {data.products_with_rules != null && <span>{data.products_with_rules} avec règles</span>}
          {data.injected_len != null && <span>{(data.injected_len).toLocaleString()} car. injectés</span>}
        </div>
        <pre className="text-xs bg-background p-2 rounded border overflow-x-auto max-h-48 whitespace-pre-wrap">
          {data.injected_preview}
          {data.injected_len > 300 && <span className="text-muted-foreground">…</span>}
        </pre>
      </div>
    );
  }

  // Réponse : afficher le preview + tokens
  if (source === "response" && data.content_preview) {
    return (
      <div className="mt-2 space-y-1">
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{data.elapsed_sec}s</span>
          <span>{(data.content_len || 0).toLocaleString()} car.</span>
          {data.tokens && (
            <>
              <span>{data.tokens.prompt?.toLocaleString()} tok. prompt</span>
              <span>{data.tokens.completion?.toLocaleString()} tok. complétion</span>
            </>
          )}
        </div>
        <pre className="text-xs bg-background p-2 rounded border overflow-x-auto max-h-48 whitespace-pre-wrap">
          {data.content_preview}
          {data.content_len > 500 && <span className="text-muted-foreground">…</span>}
        </pre>
      </div>
    );
  }

  // Fallback : JSON brut
  const filteredData = { ...data };
  // Enlever les champs qui sont déjà affichés ailleurs
  delete filteredData.source;
  delete filteredData.agent;
  const keys = Object.keys(filteredData);
  if (keys.length === 0) return null;

  return (
    <pre className="text-xs bg-background p-2 rounded border overflow-x-auto mt-2 max-h-32">
      {JSON.stringify(filteredData, null, 2)}
    </pre>
  );
});
LogDetails.displayName = "LogDetails";

export default Logs;
