
import React, { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { ChatContainer } from "@/components/chat";
import { User } from "@/types";
import { AGENTS } from "@/services/agentPrompts";
import { detectPageContext, routeToProfile } from "@/services/pageContextDetector";
import type { AgentMode } from "@/services/agentPrompts";

interface WariProps {
  user: User;
  persistentSessionId: string;
}

const Wari: React.FC<WariProps> = ({ user, persistentSessionId }) => {
  const location = useLocation();
  const [activeAgent, setActiveAgent] = useState<AgentMode>("wari");

  const effectiveAgent = useMemo((): AgentMode => {
    if (activeAgent === 'brico') return 'brico';
    if (activeAgent === 'pm') return 'pm';
    if (activeAgent === 'pia') return 'pia';
    const ctx = detectPageContext();
    const profile = routeToProfile(ctx);
    if (profile === 'hermes-pm') return 'pm';
    if (profile === 'hermes-brico') return 'brico';
    if (profile === 'hermes-pia') return 'pia';
    return 'wari';
  }, [activeAgent, location.pathname]);

  const agentInfo = AGENTS[effectiveAgent];

  return (
    <div className="flex flex-col h-screen">
      {/* En-tête */}
      <div className="h-12 border-b bg-white flex items-center justify-center gap-2 shrink-0">
        <span className="text-lg font-bold logo-text">
          Asso<span className="logo-highlight">AI</span>
        </span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
          <span className="text-sm leading-none">{agentInfo?.icon}</span>
          <span>{agentInfo?.label}</span>
        </span>
      </div>

      {/* Chat plein écran */}
      <div className="flex-1 bg-white min-h-0">
        <ChatContainer
          user={user}
          persistentSessionId={persistentSessionId}
          activeAgent={activeAgent}
          effectiveAgent={effectiveAgent}
          onAgentChange={setActiveAgent}
          enableTemplateCreation
        />
      </div>
    </div>
  );
};

export default Wari;
