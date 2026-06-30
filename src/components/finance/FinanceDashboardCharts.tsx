import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Loader2 } from "lucide-react";

const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

function formatFCFA(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M FCFA";
  if (value >= 1_000) return (value / 1_000).toFixed(0) + "k FCFA";
  return value + " FCFA";
}

export function FinanceDashboardCharts() {
  const [period, setPeriod] = useState<"week" | "month">("month");

  // KPIs
  const { data: kpis, isLoading: kpiLoading } = useQuery({
    queryKey: ["financialAnalytics", period],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc("get_financial_analytics", {
        user_filter: "ALL",
        time_period: period,
      }) as any);
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  // Par catégorie
  const { data: byCategory, isLoading: catLoading } = useQuery({
    queryKey: ["financialByCategory", period],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc("get_financial_by_category", {
        p_project_id: null,
        p_time_period: period,
      }) as any);
      if (error) throw error;
      return data || [];
    },
  });

  // Évolution mensuelle
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ["monthlyFinancialData"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc("get_monthly_financial_data", {
        user_filter: "ALL",
        months_back: 6,
      }) as any);
      if (error) throw error;
      return data || [];
    },
  });

  const expenseCategories = (byCategory || []).filter((c: any) => c.type === "expense");
  const incomeCategories = (byCategory || []).filter((c: any) => c.type === "income");
  const chartData = (monthlyData || []).map((m: any) => ({
    month: m.month?.slice(2) || m.month, // "2026-06" → "26-06"
    "Revenu réel": Number(m.actual_revenue || 0),
    "Dépenses": Number(m.expenses || 0),
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="flex items-center gap-3">
        {(["week", "month"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              period === p ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {p === "week" ? "Cette semaine" : "Ce mois"}
          </button>
        ))}
      </div>

      {kpiLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : kpis ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Revenu potentiel", value: kpis.potential_revenue, color: "text-blue-600" },
            { label: "Revenu réel", value: kpis.actual_revenue, color: "text-green-600" },
            { label: "Conversion", value: `${kpis.conversion_rate || 0}%`, color: "text-purple-600" },
            { label: "Dépenses", value: kpis.expenses, color: "text-red-600" },
            { label: "Marge", value: `${kpis.profit_margin || 0}%`, color: "text-amber-600" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500">{kpi.label}</p>
              <p className={`text-lg font-bold ${kpi.color}`}>
                {typeof kpi.value === "number" ? formatFCFA(kpi.value) : kpi.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camembert dépenses */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Dépenses par catégorie</h3>
          {catLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
          ) : expenseCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={expenseCategories}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ category, amount }) => `${category}: ${formatFCFA(amount)}`}
                >
                  {expenseCategories.map((_: any, idx: number) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => formatFCFA(val)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
          )}
        </div>

        {/* Barres évolution */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Évolution mensuelle</h3>
          {monthlyLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => formatFCFA(v)} />
                <Tooltip formatter={(val: number) => formatFCFA(val)} />
                <Legend />
                <Bar dataKey="Revenu réel" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
          )}
        </div>
      </div>
    </div>
  );
}
