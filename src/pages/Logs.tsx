
import React, { useState, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, RefreshCw } from "lucide-react";
import { appLogger } from "@/utils/logger";
import { useToast } from "@/hooks/use-toast";

const Logs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const loadLogs = () => {
    setLogs(appLogger.getLogs());
  };

  useEffect(() => {
    // Charger les logs initiaux depuis le localStorage
    loadLogs();

    const handleLog = (event: any) => {
      if (event.detail?.type?.startsWith('APP_LOG')) {
        setLogs(prev => [...prev, event.detail]);
      }
    };

    // S'abonner aux nouveaux logs
    window.addEventListener('app-log', handleLog);

    return () => {
      window.removeEventListener('app-log', handleLog);
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
      
      <div className="container py-6 flex-1">
        <div className="mb-4 flex items-center text-sm text-muted-foreground">
          <span>Nombre de logs: {logs.length}</span>
          {logs.length >= 100 && (
            <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">
              Limite de stockage atteinte (100 logs maximum)
            </span>
          )}
        </div>
        <ScrollArea className="h-[calc(100vh-8rem)] rounded-lg border bg-card p-4">
          {logs.map((log, index) => (
            <div 
              key={index}
              className="mb-4 p-3 rounded border bg-muted"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  log.type === 'APP_LOG_ERROR' ? 'bg-destructive text-destructive-foreground' :
                  log.type === 'APP_LOG_WARNING' ? 'bg-warning text-warning-foreground' :
                  'bg-primary text-primary-foreground'
                }`}>
                  {log.type.replace('APP_LOG_', '')}
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-semibold">Message:</span> {log.message}
                </div>
                {log.data && (
                  <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              Aucun log disponible
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default Logs;
