
import React, { useEffect } from "react";
import { ChatContainer } from "@/components/chat";
import { User } from "@/types";
import { useChat } from "@/contexts/ChatContext";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlidingChatPanelProps {
  user: User;
  persistentSessionId: string;
}

const SlidingChatPanel: React.FC<SlidingChatPanelProps> = ({
  user,
  persistentSessionId,
}) => {
  const { isChatOpen, closeChat } = useChat();

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
          "md:w-2/3 lg:w-1/2 w-full", // Taille responsive
          isChatOpen ? "translate-x-0" : "translate-x-full" // Animation de slide
        )}
      >
        {/* En-tête minimaliste */}
        <div className="relative h-12 border-b bg-white flex items-center justify-center">
          <span className="text-lg font-bold logo-text">
            Asso<span className="logo-highlight">AI</span>
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
          />
        </div>
      </div>
    </>
  );
};

export default SlidingChatPanel;
