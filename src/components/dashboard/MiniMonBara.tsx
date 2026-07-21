
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, Clock, Folder, ChevronDown, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MiniMonBaraProps {
  userRole: string;
  userName: string;
}

interface TaskRow {
  checklistId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  kanbanColumn: string;
}

const MiniMonBara: React.FC<MiniMonBaraProps> = ({ userRole, userName }) => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const { data: tasks, isLoading, isError, error } = useQuery({
    queryKey: ["mini-monbara", userRole],
    queryFn: async (): Promise<TaskRow[]> => {
      // Étape 1 : fetch checklists avec project_tasks (un seul !inner)
      let query = supabase
        .from("checklists")
        .select(
          `
          id,
          title,
          project_id,
          task_id,
          project_tasks!inner(
            kanban_column,
            active,
            assignee,
            title
          )
        `
        )
        .not("task_id", "is", null)
        .in("project_tasks.kanban_column", ["a_faire", "en_cours"])
        .eq("project_tasks.active", true);

      if (userRole) {
        query = query.eq("project_tasks.assignee", userRole);
      }

      const { data: checklistsData, error: clError } = await query.order(
        "project_tasks.due_date",
        { ascending: true, nullsFirst: false }
      );

      if (clError) throw new Error(clError.message);
      if (!checklistsData || checklistsData.length === 0) return [];

      // Étape 2 : récupérer les noms des projets en batch
      const projectIds = [
        ...new Set(
          (checklistsData as any[])
            .map((c: any) => c.project_id)
            .filter(Boolean)
        ),
      ] as string[];

      let projectNames: Record<string, string> = {};
      if (projectIds.length > 0) {
        const { data: projectsData, error: projError } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds);

        if (!projError && projectsData) {
          projectNames = (projectsData as any[]).reduce(
            (acc: Record<string, string>, p: any) => {
              acc[p.id] = p.name;
              return acc;
            },
            {}
          );
        }
      }

      return (checklistsData as any[]).map((row: any) => ({
        checklistId: row.id,
        taskTitle:
          row.title || row.project_tasks?.title || "Tâche sans titre",
        projectId: row.project_id,
        projectName: projectNames[row.project_id] || "Projet inconnu",
        kanbanColumn: row.project_tasks?.kanban_column || "a_faire",
      }));
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const aFaire = (tasks || []).filter((t) => t.kanbanColumn === "a_faire");
  const enCours = (tasks || []).filter((t) => t.kanbanColumn === "en_cours");

  const handleTaskClick = (checklistId: string) => {
    navigate(
      `/public/checklists?user=${encodeURIComponent(userName)}&role=${encodeURIComponent(userRole)}&start=${checklistId}`
    );
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-3 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 flex-1 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (isError) {
    return (
      <div className="bg-red-50 rounded-2xl border border-red-100 p-4 mb-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs font-medium">
            Erreur chargement Mon Bara
          </span>
        </div>
        <p className="text-xs text-red-500 mt-1">
          {(error as Error)?.message || "Erreur inconnue"}
        </p>
      </div>
    );
  }

  // ── Empty state (silencieux) ──
  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
      {/* Header collapsible */}
      <button
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-orange/10 flex items-center justify-center">
            <ClipboardCheck className="h-3.5 w-3.5 text-brand-orange" />
          </div>
          <span className="text-sm font-semibold text-gray-700">Mon Bara</span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {tasks.length}
          </Badge>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
            collapsed ? "" : "rotate-180"
          }`}
        />
      </button>

      {/* Contenu */}
      {!collapsed && (
        <div className="px-4 pb-3 space-y-2 border-t border-gray-50">
          {aFaire.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ClipboardCheck className="h-3 w-3 text-gray-400" />
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                  À faire
                </span>
                <span className="text-[10px] text-gray-400">
                  · {aFaire.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {aFaire.map((task) => (
                  <TaskRow
                    key={task.checklistId}
                    task={task}
                    onTaskClick={handleTaskClick}
                    onProjectClick={handleProjectClick}
                  />
                ))}
              </div>
            </div>
          )}

          {enCours.length > 0 && (
            <div className={aFaire.length > 0 ? "pt-1" : "pt-2"}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="h-3 w-3 text-blue-500" />
                <span className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">
                  En cours
                </span>
                <span className="text-[10px] text-blue-400">
                  · {enCours.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {enCours.map((task) => (
                  <TaskRow
                    key={task.checklistId}
                    task={task}
                    onTaskClick={handleTaskClick}
                    onProjectClick={handleProjectClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Ligne tâche ──

const TaskRow: React.FC<{
  task: TaskRow;
  onTaskClick: (checklistId: string) => void;
  onProjectClick: (projectId: string) => void;
}> = ({ task, onTaskClick, onProjectClick }) => {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors group">
      {/* Titre — cliquable → Mon Bara */}
      <button
        onClick={() => onTaskClick(task.checklistId)}
        className="flex-1 text-left text-[13px] text-gray-700 group-hover:text-brand-orange transition-colors truncate"
        title={task.taskTitle}
      >
        {task.taskTitle}
      </button>

      {/* Projet — cliquable */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onProjectClick(task.projectId);
        }}
        className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 hover:bg-brand-orange/10 hover:text-brand-orange transition-colors truncate max-w-[110px]"
        title={task.projectName}
      >
        <Folder className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{task.projectName}</span>
      </button>
    </div>
  );
};

export default MiniMonBara;
