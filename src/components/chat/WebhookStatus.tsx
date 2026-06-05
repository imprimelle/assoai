import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { appLogger } from "@/utils/logger";

interface ApiStatusProps {
  status: 'unknown' | 'testing' | 'connected' | 'error';
  onStatusChange: (status: 'unknown' | 'testing' | 'connected' | 'error') => void;
  compact?: boolean;
}

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY || "";

async function testApiConnectivity(): Promise<{ success: boolean; error?: string; responseTime?: number }> {
  const startTime = Date.now();
  try {
    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { "Authorization": `Bearer ${OPENROUTER_KEY}` },
    });
    const responseTime = Date.now() - startTime;
    if (response.ok) {
      return { success: true, responseTime };
    }
    return { success: false, error: `HTTP ${response.status}`, responseTime };
  } catch (error: any) {
    return { success: false, error: error.message, responseTime: Date.now() - startTime };
  }
}

const ApiStatus: React.FC<ApiStatusProps> = ({ status, onStatusChange, compact = false }) => {
  const [lastTestTime, setLastTestTime] = useState<Date | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const handleTestConnectivity = async () => {
    onStatusChange('testing');
    appLogger.info("🧪 Testing OpenRouter API...");
    try {
      const result = await testApiConnectivity();
      setLastTestTime(new Date());
      setResponseTime(result.responseTime || null);
      if (result.success) {
        onStatusChange('connected');
      } else {
        onStatusChange('error');
      }
    } catch (error) {
      onStatusChange('error');
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'testing':
        return <Badge variant="secondary" className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Test...</Badge>;
      case 'connected':
        return <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1"><Wifi className="h-3 w-3" />Connecté{responseTime ? ` (${responseTime}ms)` : ""}</Badge>;
      case 'error':
        return <Badge variant="destructive" className="flex items-center gap-1"><WifiOff className="h-3 w-3" />Erreur</Badge>;
      default:
        return <Badge variant="outline" className="flex items-center gap-1"><WifiOff className="h-3 w-3" />Non testé</Badge>;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {getStatusBadge()}
        <Button variant="ghost" size="sm" onClick={handleTestConnectivity} disabled={status === 'testing'} className="h-6 px-2 text-xs">Test</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-md">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">État API OpenRouter:</span>
        {getStatusBadge()}
      </div>
      <Button variant="outline" size="sm" onClick={handleTestConnectivity} disabled={status === 'testing'} className="flex-1">
        {status === 'testing' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
        Tester la connexion
      </Button>
      {lastTestTime && <p className="text-xs text-gray-500">Dernier test: {lastTestTime.toLocaleTimeString()}</p>}
    </div>
  );
};

export default ApiStatus;
