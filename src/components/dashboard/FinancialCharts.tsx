
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { formatCFA } from '@/utils/format';

interface MonthlyFinancialData {
  month: string;
  potential_revenue: number;
  actual_revenue: number;
  expenses: number;
}

interface FinancialChartsProps {
  timeScope: 'monthly' | 'weekly';
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#FFD166', '#9B87F5'];

const FinancialCharts: React.FC<FinancialChartsProps> = ({ timeScope }) => {
  const { data: monthlyData, isLoading } = useQuery({
    queryKey: ['monthlyFinancialData', timeScope],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_financial_data', {
        user_filter: 'ALL',
        months_back: timeScope === 'weekly' ? 4 : 6
      });
      
      if (error) throw error;
      return data as MonthlyFinancialData[];
    }
  });

  // If data is loading or not available, show skeleton loader
  if (isLoading || !monthlyData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[300px] bg-gray-100 animate-pulse rounded-lg"></div>
        <div className="h-[300px] bg-gray-100 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  // Prepare data for the comparison chart
  const conversionData = monthlyData.map(item => ({
    name: item.month,
    potentiel: item.potential_revenue,
    réalisé: item.actual_revenue,
    // Calculate conversion rate
    'taux %': item.potential_revenue ? 
      ((item.actual_revenue / item.potential_revenue) * 100).toFixed(1) : 0
  }));

  // Prepare data for the expense vs revenue chart
  const expenseVsRevenueData = monthlyData.map(item => ({
    name: item.month,
    revenus: item.actual_revenue,
    dépenses: item.expenses,
    profit: item.actual_revenue - item.expenses
  }));

  // Prepare data for the pie chart
  const revenueDistributionData = [
    { name: 'Revenus réalisés', value: monthlyData.reduce((sum, item) => sum + item.actual_revenue, 0) },
    { name: 'Revenus potentiels', value: monthlyData.reduce((sum, item) => sum + item.potential_revenue, 0) - monthlyData.reduce((sum, item) => sum + item.actual_revenue, 0) }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Conversion Factures → Commandes</CardTitle>
          <CardDescription>Analyse des montants potentiels vs réalisés</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] md:h-[300px]">
            <ChartContainer 
              config={{
                potentiel: { color: "#FF6B6B" },
                réalisé: { color: "#4ECDC4" },
                "taux %": { color: "#FFD166" }
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="potentiel" fill="var(--color-potentiel)" name="Revenus potentiels" />
                  <Bar yAxisId="left" dataKey="réalisé" fill="var(--color-réalisé)" name="Revenus réalisés" />
                  <Line yAxisId="right" type="monotone" dataKey="taux %" stroke="var(--color-taux %)" name="Taux de conversion" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
        
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Dépenses vs Revenus</CardTitle>
          <CardDescription>Analyse des revenus, dépenses et profits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] md:h-[300px]">
            <ChartContainer 
              config={{
                revenus: { color: "#4ECDC4" },
                dépenses: { color: "#FF6B6B" },
                profit: { color: "#9B87F5" }
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseVsRevenueData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="revenus" fill="var(--color-revenus)" stackId="a" />
                  <Bar dataKey="dépenses" fill="var(--color-dépenses)" stackId="a" />
                  <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md lg:col-span-2">
        <CardHeader>
          <CardTitle>Distribution des Revenus</CardTitle>
          <CardDescription>Potentiels vs Réalisés</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={revenueDistributionData} 
                  cx="50%" 
                  cy="50%" 
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={80} 
                  fill="#8884d8" 
                  dataKey="value"
                >
                  {revenueDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCFA(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
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
            {item.name}: {item.dataKey !== "taux %" ? formatCFA(item.value) : `${item.value}%`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Custom label for pie chart
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default FinancialCharts;
