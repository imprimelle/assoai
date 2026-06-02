
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import FinancialMetricCard from './FinancialMetricCard';

interface FinancialMetricsSectionProps {
  timeScope: 'monthly' | 'weekly';
}

interface FinancialMetricsData {
  potential_revenue: number;
  actual_revenue: number;
  conversion_rate: number;
  expenses: number;
  profit_margin: number;
}

const FinancialMetricsSection: React.FC<FinancialMetricsSectionProps> = ({ timeScope }) => {
  const { data: financialMetrics, isLoading } = useQuery({
    queryKey: ['financialMetrics', timeScope],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_financial_analytics', {
          user_filter: 'ALL',
          time_period: timeScope === 'weekly' ? 'week' : 'month'
        });
        
        if (error) throw error;
        return data?.[0] as FinancialMetricsData;
      } catch (error) {
        console.error('Erreur lors de la récupération des métriques financières:', error);
        // Retourner des données par défaut en cas d'erreur
        return {
          potential_revenue: 0,
          actual_revenue: 0,
          conversion_rate: 0,
          expenses: 0,
          profit_margin: 0
        } as FinancialMetricsData;
      }
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold mb-4">Analytiques financières</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  // S'assurer que financialMetrics est défini
  const metrics = financialMetrics || {
    potential_revenue: 0,
    actual_revenue: 0,
    conversion_rate: 0,
    expenses: 0,
    profit_margin: 0
  };

  // Calculer les tendances (pour démonstration, on utilise des valeurs statiques)
  // Dans un environnement réel, ces valeurs seraient calculées en comparant avec des périodes précédentes
  const getTrend = (value: number) => {
    if (value > 0) return { value: "+5", type: "positive" };
    if (value < 0) return { value: "-3", type: "negative" };
    return { value: "0", type: "neutral" };
  };

  const potentialRevenueTrend = getTrend(metrics.potential_revenue);
  const actualRevenueTrend = getTrend(metrics.actual_revenue);
  const conversionRateTrend = getTrend(metrics.conversion_rate);
  const profitMarginTrend = getTrend(metrics.profit_margin);

  return (
    <>
      <h2 className="text-xl font-semibold mb-4">Analytiques financières</h2>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <FinancialMetricCard 
          title="Revenus potentiels" 
          value={metrics.potential_revenue} 
          isMonetary={true}
          percentChange={potentialRevenueTrend.value}
          changeType={potentialRevenueTrend.type as 'positive' | 'negative' | 'neutral'}
        />
        
        <FinancialMetricCard 
          title="Revenus réels" 
          value={metrics.actual_revenue} 
          isMonetary={true}
          percentChange={actualRevenueTrend.value}
          changeType={actualRevenueTrend.type as 'positive' | 'negative' | 'neutral'}
        />
        
        <FinancialMetricCard 
          title="Taux de conversion" 
          value={metrics.conversion_rate} 
          isPercentage={true}
          percentChange={conversionRateTrend.value}
          changeType={conversionRateTrend.type as 'positive' | 'negative' | 'neutral'}
        />
        
        <FinancialMetricCard 
          title="Marge bénéficiaire" 
          value={metrics.profit_margin} 
          isPercentage={true}
          percentChange={profitMarginTrend.value}
          changeType={profitMarginTrend.type as 'positive' | 'negative' | 'neutral'}
        />
      </div>
    </>
  );
};

export default FinancialMetricsSection;
