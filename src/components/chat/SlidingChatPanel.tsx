
import React, { useEffect, useMemo, useState } from "react";
import { ChatContainer } from "@/components/chat";
import { User } from "@/types";
import { useChat } from "@/contexts/ChatContext";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AGENTS } from "@/services/agentPrompts";
import { detectPageContext, routeToProfile } from "@/services/pageContextDetector";
import type { AgentMode } from "@/services/agentPrompts";
import { useLocation } from "react-router-dom";

interface SlidingChatPanelProps {
  user: User;
  persistentSessionId: string;
}

const SlidingChatPanel: React.FC<SlidingChatPanelProps> = ({
  user,
  persistentSessionId,
}) => {
  const { isChatOpen, closeChat } = useChat();
  const location = useLocation();

  // État remonté depuis ChatContainer : choix manuel de l'agent
  const [activeAgent, setActiveAgent] = useState<AgentMode>("wari");

  // Agent effectif UNIFIÉ : tient compte du choix manuel + routage auto selon l'URL
  const effectiveAgent = useMemo((): AgentMode => {
    // Choix manuel prioritaire
    if (activeAgent === 'brico') return 'brico';
    if (activeAgent === 'pm') return 'pm';
    if (activeAgent === 'pia') return 'pia';
    // Sinon (wari = auto) → routage selon la page
    const ctx = detectPageContext();
    const profile = routeToProfile(ctx);
    if (profile === 'hermes-pm') return 'pm';
    if (profile === 'hermes-brico') return 'brico';
    if (profile === 'hermes-pia') return 'pia';
    return 'wari';
  }, [activeAgent, location.pathname]);

  const agentInfo = AGENTS[effectiveAgent];

  // Bloquer le défilement du corps lorsque le chat est ouvert sur mobile
  useEffect(() => {
    if (isChatOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isChatOpen]);

  return (
    <>
      {/* Overlay seulement sur mobile */}
      {isChatOpen && (
        <div className="md:hidden chat-overlay" onClick={closeChat}></div>
      )}

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 bg-white shadow-lg transition-transform duration-300 ease-in-out",
          "md:w-2/3 lg:w-1/2 w-full",
          isChatOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* En-tête avec AssoAI + agent actif */}
        <div className="relative h-12 border-b bg-white flex items-center justify-center gap-2">
          <span className="text-lg font-bold logo-text">
            Asso<span className="logo-highlight">AI</span>
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
            <span className="text-sm leading-none">{agentInfo?.icon}</span>
            <span>{agentInfo?.label}</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1"
            onClick={closeChat}
          >
            <X className="h-5 w-5 transform transition-transform duration-500 hover:rotate-180" />
          </Button>
        </div>

        <div className="h-[calc(100%-3rem)] bg-white">
          <ChatContainer
            user={user}
            persistentSessionId={persistentSessionId}
            activeAgent={activeAgent}
            effectiveAgent={effectiveAgent}
            onAgentChange={setActiveAgent}
          />
        </div>
      </div>
    </>
  );
};

export default SlidingChatPanel;
