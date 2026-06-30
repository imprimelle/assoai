import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

interface ProjectChatProps {
  projectId: string;
  projectName: string;
  userId: string;
  sessionId?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
  agent?: string;
}

export const ProjectChat: React.FC<ProjectChatProps> = ({
  projectId,
  projectName,
  userId,
  sessionId: initialSessionId,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState<string>(
    // Bug 6 : aligner avec la convention sidebar (project-{id})
    `project-${projectId}`
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Charger l'historique des messages du projet
  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectId)
        .eq('session_type', 'project')
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error loading project messages:', error);
        return;
      }

      const formatted: ChatMessage[] = (data || []).map((m: any) => ({
        id: m.id,
        content: m.content,
        isUser: m.sender === 'user',
        timestamp: m.timestamp,
        agent: m.sender === 'system' ? 'Chef de Projet' : undefined,
      }));
      setMessages(formatted);
    };

    loadMessages();
  }, [projectId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      content: input.trim(),
      isUser: true,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Sauvegarder le message utilisateur dans Supabase AVANT l'appel API
      await supabase.from('messages').insert({
        session_id: sessionId,
        user_id: userId,
        sender: 'user',
        content: userMsg.content,
        project_id: projectId,
        session_type: 'project',
        timestamp: userMsg.timestamp,
      });

      // Appeler l'API Hermes locale avec le contexte projet
      const response = await fetch('/hermes/router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          userId,
          sessionId,
          profile: 'hermes-pm',
          skills: [
            'project-orchestrator',
            'kanban-manager',
            'checklist-validator',
            'project-reporting',
            'team-coordinator',
            'cdc-parse',
          ],
          context: { projectId, projectName },
        }),
      });

      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        content: data.response?.textFallback 
          || (data.response?.data 
            ? `✅ Document généré avec succès.` 
            : 'Aucune réponse générée.'),
        isUser: false,
        timestamp: new Date().toISOString(),
        agent: data.profile || 'hermes-pm',
      };

      setMessages(prev => [...prev, aiMsg]);

      // Sauvegarder dans Supabase
      await supabase.from('messages').insert({
        session_id: sessionId,
        user_id: userId,
        sender: 'system',
        content: aiMsg.content,
        project_id: projectId,
        session_type: 'project',
        timestamp: aiMsg.timestamp,
      });

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        content: 'Désolé, je rencontre un problème de connexion. Veuillez réessayer.',
        isUser: false,
        timestamp: new Date().toISOString(),
        agent: 'system',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-300px)] border rounded-lg bg-white">
      {/* En-tête */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 rounded-t-lg">
        <span className="text-lg">🎯</span>
        <div>
          <h3 className="font-medium text-sm">Chef de Projet</h3>
          <p className="text-xs text-muted-foreground">Projet : {projectName}</p>
        </div>
        <Badge variant="outline" className="ml-auto text-xs">
          {messages.length} msg
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">🎯</p>
            <p className="text-sm">
              Bonjour ! Je suis le Chef de Projet AssoAI.
              Je peux vous aider à suivre l'avancement, créer des tâches,
              gérer les checklists et coordonner l'équipe.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Tapez votre message pour commencer.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.isUser
                      ? 'bg-[#274293] text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                >
                  {!msg.isUser && msg.agent && (
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {msg.agent === 'hermes-pm' ? '🎯 Chef de Projet' : msg.agent}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.isUser ? 'text-blue-100' : 'text-muted-foreground'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg rounded-bl-none px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t">
        <Input
          placeholder="Écrivez au Chef de Projet..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isLoading}
          className="text-sm"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
