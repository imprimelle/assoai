
import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import type { Enseigne } from "@/types";

interface EnseigneFilterProps {
  enseignes: Enseigne[];
  selectedEnseigneId: string | "all";
  onFilterChange: (enseigneId: string | "all") => void;
  className?: string;
}

const EnseigneFilter: React.FC<EnseigneFilterProps> = ({
  enseignes,
  selectedEnseigneId,
  onFilterChange,
  className = ""
}) => {
  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
          Filtrer par enseigne
        </span>
      </div>
      <Select value={selectedEnseigneId} onValueChange={onFilterChange}>
        <SelectTrigger className="w-full sm:w-64 h-9">
          <SelectValue placeholder="Filtrer par enseigne" />
        </SelectTrigger>
        <SelectContent className="max-w-[90vw]">
          <SelectItem value="all">Toutes les enseignes</SelectItem>
          {enseignes.map((enseigne) => (
            <SelectItem key={enseigne.id} value={enseigne.id}>
              <span className="truncate max-w-[200px] block">
                {enseigne.nom}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default EnseigneFilter;
