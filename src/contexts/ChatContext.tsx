import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface ProjectContext {
  projectId: string;
  projectName: string;
}

interface ChatContextType {
  isChatOpen: boolean;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  // Contexte projet (pour le chat contextuel)
  projectContext: ProjectContext | null;
  setProjectContext: (projectId: string, projectName: string) => void;
  clearProjectContext: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [projectContext, setProjectContextState] = useState<ProjectContext | null>(null);

  const toggleChat = () => setIsChatOpen(prev => !prev);
  const openChat = () => setIsChatOpen(true);
  const closeChat = () => setIsChatOpen(false);

  const setProjectContext = useCallback((projectId: string, projectName: string) => {
    setProjectContextState({ projectId, projectName });
  }, []);

  const clearProjectContext = useCallback(() => {
    setProjectContextState(null);
  }, []);

  return (
    <ChatContext.Provider value={{ isChatOpen, toggleChat, openChat, closeChat, projectContext, setProjectContext, clearProjectContext }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
