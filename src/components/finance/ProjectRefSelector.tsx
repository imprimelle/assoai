import React, { useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProjectRefSelectorProps {
  value?: string;
  onChange: (projectId: string | undefined, projectName?: string) => void;
  placeholder?: string;
}

export function ProjectRefSelector({ value, onChange, placeholder = "Rechercher un projet..." }: ProjectRefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", "finance-selector", search],
    queryFn: async () => {
      let query = supabase.from("projects").select("id, name").order("name");
      if (search.trim()) query = query.ilike("name", `%${search}%`);
      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const selectedProject = value && projects ? projects.find((p: any) => p.id === value) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 border rounded-lg text-sm bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className={selectedProject ? "text-gray-900" : "text-gray-400"}>
          {selectedProject ? (selectedProject as any).name : placeholder}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="p-2 sticky top-0 bg-white border-b">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full px-2 py-1 text-sm border rounded"
                autoFocus
              />
            </div>
            {isLoading ? (
              <div className="p-4 text-sm text-gray-400 text-center">Chargement...</div>
            ) : (projects && projects.length > 0) ? (
              projects.map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange(p.id, p.name); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    value === p.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
                  }`}
                >
                  {p.name}
                </button>
              ))
            ) : (
              <div className="p-4 text-sm text-gray-400 text-center">Aucun projet trouvé</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
