
import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MapView from '@/components/dashboard/MapView';
import RecentUpdates from '@/components/dashboard/RecentUpdates';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatCFA } from '@/utils/format';
import { ActivitySquare, Map, FileText, TrendingUp } from 'lucide-react';
import FinancialMetricsSection from '@/components/dashboard/FinancialMetricsSection';
import FinancialCharts from '@/components/dashboard/FinancialCharts';

// Données pour les graphiques (seront remplacées par les données réelles via API)
const monthlyData = [
  { name: 'Jan', factures: 4, devis: 6, commandes: 2, cahiers: 1 },
  { name: 'Fév', factures: 3, devis: 5, commandes: 4, cahiers: 2 },
  { name: 'Mar', factures: 5, devis: 8, commandes: 3, cahiers: 1 },
  { name: 'Avr', factures: 7, devis: 10, commandes: 5, cahiers: 3 },
  { name: 'Mai', factures: 6, devis: 9, commandes: 6, cahiers: 2 },
  { name: 'Juin', factures: 8, devis: 12, commandes: 7, cahiers: 4 },
];

const weeklyData = [
  { name: 'Lun', factures: 2, devis: 3, commandes: 1, cahiers: 1 },
  { name: 'Mar', factures: 1, devis: 4, commandes: 2, cahiers: 0 },
  { name: 'Mer', factures: 3, devis: 2, commandes: 1, cahiers: 1 },
  { name: 'Jeu', factures: 2, devis: 5, commandes: 3, cahiers: 1 },
  { name: 'Ven', factures: 4, devis: 3, commandes: 2, cahiers: 0 },
];

const Dashboard: React.FC = () => {
  const [timeScope, setTimeScope] = useState<'monthly' | 'weekly'>('monthly');
  const [activeTab, setActiveTab] = useState<string>('analytics');
  const isMobile = useIsMobile();

  // Fetch template counts from Supabase using the function
  const { data: templateCounts, isLoading: isLoadingCounts } = useQuery({
    queryKey: ['templateCounts', 'ALL'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_template_counts', { user_filter: 'ALL' });
        
        if (error) throw error;
        
        return data || [];
      } catch (error) {
        console.error('Error fetching template counts:', error);
        return [];
      }
    }
  });

  // Transform template counts to be used in the stats cards
  const getCountByType = (type: string) => {
    if (!templateCounts) return { count: 0, change: '+0' };
    
    const found = templateCounts.find(item => item.template_type === type);
    const count = found ? found.count : 0;
    
    // This would need to be compared with historical data to calculate the real change
    // For now, we're using dummy data
    const change = type === 'commandes' && timeScope === 'weekly' ? '-1' : `+${Math.floor(count * 0.2)}`;
    
    return { count, change };
  };

  return (
    <div className="container mx-auto px-2 md:px-6 py-4 md:py-6">
      <h1 className="text-2xl font-bold mb-4 md:mb-6">Tableau de bord</h1>
      
      {/* Structure principale avec onglets */}
      <Tabs defaultValue="analytics" onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full mb-6 grid grid-cols-3 bg-white shadow-sm">
          <TabsTrigger value="analytics" className="data-[state=active]:border-orange-500 data-[state=active]:bg-orange-50 border-b-2 border-transparent">
            <ActivitySquare className="h-5 w-5" />
            <span className={`ml-2 ${isMobile ? "hidden" : "inline-block"}`}>Analytiques</span>
          </TabsTrigger>
          <TabsTrigger value="map" className="data-[state=active]:border-orange-500 data-[state=active]:bg-orange-50 border-b-2 border-transparent">
            <Map className="h-5 w-5" />
            <span className={`ml-2 ${isMobile ? "hidden" : "inline-block"}`}>Carte & Emplacements</span>
          </TabsTrigger>
          <TabsTrigger value="updates" className="data-[state=active]:border-orange-500 data-[state=active]:bg-orange-50 border-b-2 border-transparent">
            <FileText className="h-5 w-5" />
            <span className={`ml-2 ${isMobile ? "hidden" : "inline-block"}`}>Mises à jour</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Onglet 1: Analytiques - Evolution mensuelle, activité des documents, répartition par type */}
        <TabsContent value="analytics" className="space-y-6">
          <Tabs defaultValue={timeScope} onValueChange={(value) => setTimeScope(value as 'monthly' | 'weekly')} className="w-full mb-4 md:mb-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
              <h2 className="text-xl font-semibold">Activité des documents</h2>
              <TabsList className="self-start">
                <TabsTrigger value="monthly">Mensuel</TabsTrigger>
                <TabsTrigger value="weekly">Hebdomadaire</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="monthly" className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                <StatsCard 
                  title="Factures" 
                  value={getCountByType('facture').count.toString()} 
                  change={getCountByType('facture').change} 
                  changeType="positive" 
                />
                <StatsCard 
                  title="Devis" 
                  value={getCountByType('devis').count.toString()} 
                  change={getCountByType('devis').change} 
                  changeType="positive" 
                />
                <StatsCard 
                  title="Commandes" 
                  value={getCountByType('commande').count.toString()} 
                  change={getCountByType('commande').change} 
                  changeType="positive" 
                />
                <StatsCard 
                  title="Cahiers des charges" 
                  value={getCountByType('cahier_des_charges').count.toString()} 
                  change={getCountByType('cahier_des_charges').change} 
                  changeType="positive" 
                />
              </div>
              
              {/* Section des métriques financières */}
              <div className="mt-8 mb-6">
                <FinancialMetricsSection timeScope="monthly" />
              </div>
              
              {/* Nouveaux graphiques financiers */}
              <div className="mt-8 mb-6">
                <FinancialCharts timeScope="monthly" />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle>Évolution mensuelle</CardTitle>
                    <CardDescription>Documents créés par mois</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] md:h-[300px]">
                      <ChartContainer 
                        config={{
                          factures: { color: "#FF6B6B" },
                          devis: { color: "#4ECDC4" },
                          commandes: { color: "#FFD166" },
                          cahiers: { color: "#9B87F5" }
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey="factures" stroke="var(--color-factures)" activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="devis" stroke="var(--color-devis)" />
                            <Line type="monotone" dataKey="commandes" stroke="var(--color-commandes)" />
                            <Line type="monotone" dataKey="cahiers" stroke="var(--color-cahiers)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle>Répartition par type</CardTitle>
                    <CardDescription>Proportion des documents par type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] md:h-[300px]">
                      <ChartContainer 
                        config={{
                          factures: { color: "#FF6B6B" },
                          devis: { color: "#4ECDC4" },
                          commandes: { color: "#FFD166" },
                          cahiers: { color: "#9B87F5" }
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="factures" fill="var(--color-factures)" />
                            <Bar dataKey="devis" fill="var(--color-devis)" />
                            <Bar dataKey="commandes" fill="var(--color-commandes)" />
                            <Bar dataKey="cahiers" fill="var(--color-cahiers)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="weekly" className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                <StatsCard 
                  title="Factures" 
                  value="8" 
                  change="+2" 
                  changeType="positive" 
                />
                <StatsCard 
                  title="Devis" 
                  value="12" 
                  change="+3" 
                  changeType="positive" 
                />
                <StatsCard 
                  title="Commandes" 
                  value="5" 
                  change="-1" 
                  changeType="negative" 
                />
                <StatsCard 
                  title="Cahiers des charges" 
                  value="3" 
                  change="+1" 
                  changeType="positive" 
                />
              </div>
              
              {/* Section des métriques financières en mode hebdomadaire */}
              <div className="mt-8 mb-6">
                <FinancialMetricsSection timeScope="weekly" />
              </div>
              
              {/* Nouveaux graphiques financiers en mode hebdomadaire */}
              <div className="mt-8 mb-6">
                <FinancialCharts timeScope="weekly" />
              </div>
              
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Activité hebdomadaire</CardTitle>
                  <CardDescription>Documents créés cette semaine</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] md:h-[300px]">
                    <ChartContainer 
                      config={{
                        factures: { color: "#FF6B6B" },
                        devis: { color: "#4ECDC4" },
                        commandes: { color: "#FFD166" },
                        cahiers: { color: "#9B87F5" }
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar dataKey="factures" fill="var(--color-factures)" />
                          <Bar dataKey="devis" fill="var(--color-devis)" />
                          <Bar dataKey="commandes" fill="var(--color-commandes)" />
                          <Bar dataKey="cahiers" fill="var(--color-cahiers)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
        
        {/* Onglet 2: Carte & Emplacements */}
        <TabsContent value="map">
          <div className="mb-6">
            <MapView />
          </div>
        </TabsContent>
        
        {/* Onglet 3: Mises à jour récentes */}
        <TabsContent value="updates">
          <div className="mb-6">
            <RecentUpdates />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Composant pour le tooltip des graphiques
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 border border-gray-200 shadow-md rounded">
        <p className="font-medium">{label}</p>
        {payload.map((item: any, index: number) => (
          <p key={index} style={{ color: item.color }}>
            {item.name}: {item.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Composant pour les cartes de statistiques
interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, changeType }) => {
  return (
    <Card className="shadow-md">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs md:text-sm font-medium">{title}</p>
          <div className={`px-1 md:px-2 py-1 rounded-full text-xs font-medium ${
            changeType === 'positive' ? 'bg-green-100 text-green-800' : 
            changeType === 'negative' ? 'bg-red-100 text-red-800' : 
            'bg-gray-100 text-gray-800'
          }`}>
            {change}
          </div>
        </div>
        <p className="text-xl md:text-3xl font-bold mt-2">{value}</p>
      </CardContent>
    </Card>
  );
};

export default Dashboard;
