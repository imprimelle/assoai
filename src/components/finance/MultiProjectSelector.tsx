import React, { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MultiProjectSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export function MultiProjectSelector({
  selectedIds,
  onChange,
  placeholder = "Projet(s)...",
}: MultiProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", "multi-selector", search],
    queryFn: async () => {
      let query = supabase.from("projects").select("id, name").order("name").limit(20);
      if (search.trim()) query = query.ilike("name", `%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    enabled: open,
    staleTime: 30_000,
  });

  // Récupérer les noms des projets sélectionnés
  const { data: selectedProjects } = useQuery({
    queryKey: ["projects", "selected", selectedIds],
    queryFn: async () => {
      if (!selectedIds.length) return [];
      const { data } = await supabase.from("projects").select("id, name").in("id", selectedIds);
      return (data || []) as { id: string; name: string }[];
    },
    enabled: selectedIds.length > 0,
  });

  const toggleProject = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
    setSearch("");
    inputRef.current?.focus();
  };

  const removeProject = (id: string) => {
    onChange(selectedIds.filter((sid) => sid !== id));
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Tags + Input */}
      <div
        className="flex flex-wrap items-center gap-1 px-2 py-1.5 border rounded-lg bg-white min-h-[36px] cursor-text"
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {selectedProjects?.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
          >
            {p.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeProject(p.id); }}
              className="ml-0.5 hover:text-blue-900"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selectedIds.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] outline-none text-sm bg-transparent py-0.5"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-xs text-gray-400 text-center">Chargement...</div>
          ) : (projects && projects.length > 0) ? (
            projects
              .filter((p) => !selectedIds.includes(p.id))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProject(p.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 border-b border-gray-50 last:border-0"
                >
                  <Search className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-700">{p.name}</span>
                </button>
              ))
          ) : (
            <div className="p-3 text-xs text-gray-400 text-center">Aucun projet</div>
          )}
        </div>
      )}
    </div>
  );
}
