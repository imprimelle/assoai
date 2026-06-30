import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wifi, Inbox, MessageSquare, Users } from 'lucide-react';

interface QueueStats { direction: string; pending: number; processed: number }
interface RecentMessage { id: string; content: string; sender: string; timestamp: string }

const CommunicatorDashboard: React.FC = () => {
  const [queueStats, setQueueStats] = useState<QueueStats[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Queue stats
      const { data: queue } = await supabase
        .from('communicator_queue')
        .select('direction,status')
        .order('created_at', { ascending: false })
        .limit(100);

      if (queue) {
        const grouped: Record<string, QueueStats> = {};
        for (const q of queue) {
          if (!grouped[q.direction]) grouped[q.direction] = { direction: q.direction, pending: 0, processed: 0 };
          if (q.status === 'pending') grouped[q.direction].pending++;
          else grouped[q.direction].processed++;
        }
        setQueueStats(Object.values(grouped));
      }

      // Recent messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('id,content,sender,timestamp')
        .order('timestamp', { ascending: false })
        .limit(10);
      if (msgs) setRecentMessages(msgs as RecentMessage[]);

      // Contact count
      const { count } = await supabase
        .from('human_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      setContactCount(count || 0);

      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="container mx-auto px-4 py-6"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">📱 Communicateur — État</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Bridge Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" /> Bridge WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="bg-green-50 text-green-700">🟢 Online</Badge>
            <p className="text-xs text-muted-foreground mt-1">Port 3000 • Mode bot</p>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{contactCount}</p>
            <p className="text-xs text-muted-foreground">contacts actifs</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Inbox className="h-4 w-4" /> File d'attente (communicator_queue)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queueStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">File vide</p>
          ) : (
            <div className="space-y-2">
              {queueStats.map(s => (
                <div key={s.direction} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{s.direction}</span>
                  <div className="flex gap-2">
                    {s.pending > 0 && <Badge variant="outline" className="text-amber-600 text-xs">{s.pending} pending</Badge>}
                    <Badge variant="outline" className="text-green-600 text-xs">{s.processed} traités</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Messages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Derniers messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun message récent</p>
          ) : (
            <div className="space-y-2">
              {recentMessages.map(m => (
                <div key={m.id} className="flex items-start gap-2 text-sm border-b border-gray-50 pb-2 last:border-0">
                  <span className="text-xs text-muted-foreground shrink-0 w-12">
                    {new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-muted-foreground truncate">{m.content?.substring(0, 80)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunicatorDashboard;
