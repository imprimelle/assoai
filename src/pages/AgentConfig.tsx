import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, RotateCcw, Check } from "lucide-react";
import {
  type AgentMode,
  AGENTS_META,
  getPrompt,
  setPrompt,
  resetPrompt,
  isCustomized,
  DEFAULT_PROMPTS,
} from "@/services/agentConfigStore";

const AGENT_ORDER: AgentMode[] = ["auto", "wari", "brico"];

const AgentConfig: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // État local des prompts en cours d'édition
  const [editing, setEditing] = useState<Record<AgentMode, string>>(() => {
    const init: Record<string, string> = {};
    AGENT_ORDER.forEach((a) => {
      init[a] = getPrompt(a);
    });
    return init as Record<AgentMode, string>;
  });

  const [activeTab, setActiveTab] = useState<AgentMode>("auto");

  const handleSave = (agent: AgentMode) => {
    setPrompt(agent, editing[agent]);
    toast({
      title: "Prompt sauvegardé",
      description: `Le prompt de ${AGENTS_META[agent].label} a été enregistré.`,
    });
  };

  const handleReset = (agent: AgentMode) => {
    const def = resetPrompt(agent);
    setEditing((prev) => ({ ...prev, [agent]: def }));
    toast({
      title: "Prompt réinitialisé",
      description: `Le prompt de ${AGENTS_META[agent].label} a été remis par défaut.`,
    });
  };

  const hasChanges = (agent: AgentMode) => editing[agent] !== getPrompt(agent);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-gray-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <h1 className="text-lg font-bold">⚙️ Configuration des agents</h1>
      </div>

      <div className="flex-1 p-4">
        <p className="text-sm text-gray-500 mb-4">
          Personnalisez les prompts système de chaque agent. Les modifications sont
          sauvegardées localement. Utilisez <code>{`{INJECTED_PRODUCTS}`}</code> (Wari)
          ou <code>{`{INJECTED_RULES}`}</code> (Brico) comme marqueurs pour l'injection
          automatique des données du catalogue.
        </p>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as AgentMode)}
        >
          <TabsList className="mb-4">
            {AGENT_ORDER.map((a) => {
              const cfg = AGENTS_META[a];
              const customized = isCustomized(a);
              return (
                <TabsTrigger key={a} value={a} className="gap-1">
                  {cfg.icon} {cfg.label}
                  {customized && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-orange-500" title="Personnalisé" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {AGENT_ORDER.map((a) => {
            const cfg = AGENTS_META[a];
            return (
              <TabsContent key={a} value={a} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-md font-semibold">
                      {cfg.icon} {cfg.label}
                    </h2>
                    <p className="text-xs text-gray-500">{cfg.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReset(a)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Défaut
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSave(a)}
                      disabled={!hasChanges(a)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <Save className="h-3 w-3 mr-1" /> Sauvegarder
                    </Button>
                  </div>
                </div>

                <Textarea
                  value={editing[a]}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, [a]: e.target.value }))
                  }
                  className="font-mono text-xs min-h-[400px] resize-y"
                  placeholder={`Prompt système pour ${cfg.label}...`}
                />

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>
                    {editing[a].length.toLocaleString()} caractères
                  </span>
                  {hasChanges(a) && (
                    <span className="text-orange-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      Modifications non sauvegardées
                    </span>
                  )}
                  {!hasChanges(a) && isCustomized(a) && (
                    <span className="text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Personnalisé
                    </span>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Récap des marqueurs d'injection */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
          <strong>Marqueurs d'injection automatique :</strong>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>
              <code>{`{INJECTED_PRODUCTS}`}</code> — Wari : remplacé par la liste
              des produits (nom, description, variantes/prix) depuis Supabase
            </li>
            <li>
              <code>{`{INJECTED_RULES}`}</code> — Brico : remplacé par les règles
              de fabrication (manufacturing_rules) de tous les produits depuis Supabase
            </li>
            <li>
              <strong>Auto</strong> ne reçoit aucune injection — il route seulement
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AgentConfig;
