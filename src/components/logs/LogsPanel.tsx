import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  details?: any;
}

const LEVEL_CONFIG: Record<string, { color: string; bg: string }> = {
  error: { color: 'text-red-700', bg: 'bg-red-50' },
  warn: { color: 'text-orange-700', bg: 'bg-orange-50' },
  info: { color: 'text-blue-700', bg: 'bg-blue-50' },
  debug: { color: 'text-gray-500', bg: 'bg-gray-50' },
};

const LogsPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  useEffect(() => {
    loadLogs();
    // Rafraîchir toutes les 30s
    const interval = setInterval(loadLogs, 30000);
    return () => clearInterval(interval);
  }, [sourceFilter, levelFilter]);

  const loadLogs = async () => {
    try {
      let query = supabase
        .from('app_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
      }
      if (levelFilter !== 'all') {
        query = query.eq('level', levelFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading logs:', error);
        return;
      }

      setLogs((data || []) as LogEntry[]);
    } catch (e) {
      console.error('Logs panel error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log =>
    !filter ||
    log.message.toLowerCase().includes(filter.toLowerCase()) ||
    log.source.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="🔍 Filtrer les logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs text-sm"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="text-sm border rounded px-2 py-1.5 bg-white"
        >
          <option value="all">Toutes sources</option>
          <option value="chat">Chat (Wari/Brico/PM)</option>
          <option value="tool">Outils (skills)</option>
          <option value="cron">Cron (Sentinelle)</option>
          <option value="global">Global</option>
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="text-sm border rounded px-2 py-1.5 bg-white"
        >
          <option value="all">Tous niveaux</option>
          <option value="error">🔴 Erreurs</option>
          <option value="warn">🟠 Alertes</option>
          <option value="info">🔵 Infos</option>
          <option value="debug">⚫ Debug</option>
        </select>
        <Badge variant="secondary" className="text-xs">
          {filteredLogs.length} logs
        </Badge>
      </div>

      {/* Table des logs */}
      <ScrollArea className="h-[500px] border rounded-lg">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Aucun log trouvé.</p>
            {!filter && <p className="text-xs mt-1">Les logs apparaîtront ici automatiquement.</p>}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 w-[140px]">Horodatage</th>
                <th className="text-left px-3 py-2 w-[70px]">Niveau</th>
                <th className="text-left px-3 py-2 w-[80px]">Source</th>
                <th className="text-left px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredLogs.map(log => {
                const cfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.debug;
                return (
                  <tr key={log.id} className={`${cfg.bg} hover:bg-gray-100`}>
                    <td className="px-3 py-1.5 text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge variant="outline" className={`text-xs ${cfg.color} border-0`}>
                        {log.level.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {log.source}
                    </td>
                    <td className="px-3 py-1.5 max-w-[400px] truncate" title={log.message}>
                      {log.message}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ScrollArea>
    </div>
  );
};

export default LogsPanel;
