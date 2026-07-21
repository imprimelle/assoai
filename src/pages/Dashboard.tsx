
import React from "react";
import { User } from "@/types";
import MiniMonBara from "@/components/dashboard/MiniMonBara";
import { LayoutDashboard } from "lucide-react";

interface DashboardProps {
  user: User | null;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-1">
          <LayoutDashboard className="h-5 w-5 text-brand-orange" />
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          Vue d'ensemble de ton activité
        </p>
      </div>

      {/* Sections du dashboard */}
      <div className="space-y-6">
        {/* Section Mon Bara miniature */}
        <section>
          <MiniMonBara userRole={user.role} userName={user.name} />
        </section>

        {/* Autres sections à venir... */}
      </div>
    </div>
  );
};

export default Dashboard;
