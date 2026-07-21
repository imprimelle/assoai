
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, Clock, Folder, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MiniMonBaraProps {
  userRole: string;
  userName: string;
  /** Si fourni, appelé au clic tâche (mode intégré). Sinon, navigate interne. */
  onTaskClick?: (checklistId: string, kanbanColumn: string) => void;
}

interface TaskRow {
  checklistId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  kanbanColumn: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  a_faire: {
    label: "À faire",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: <ClipboardCheck className="h-3 w-3" />,
  },
  en_cours: {
    label: "En cours",
    color: "bg-blue-50 text-blue-600 border-blue-200",
    icon: <Clock className="h-3 w-3" />,
  },
};

const MiniMonBara: React.FC<MiniMonBaraProps> = ({ userRole, userName, onTaskClick }) => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["mini-monbara", userRole],
    queryFn: async (): Promise<TaskRow[]> => {
      let query = supabase
        .from("checklists")
        .select(
          `
          id,
          title,
          project_id,
          project_tasks!inner(
            kanban_column,
            active,
            assignee,
            title
          ),
          projects!inner(name)
        `
        )
        .not("task_id", "is", null)
        .in("project_tasks.kanban_column", ["a_faire", "en_cours"])
        .eq("project_tasks.active", true);

      if (userRole) {
        query = query.eq("project_tasks.assignee", userRole);
      }

      const { data, error } = await query.order("project_tasks.due_date", {
        ascending: true,
        nullsFirst: false,
      });

      if (error) throw error;

      return ((data || []) as any[]).map((row: any) => ({
        checklistId: row.id,
        taskTitle:
          row.title ||
          row.project_tasks?.title ||
          "Tâche sans titre",
        projectId: row.project_id,
        projectName: row.projects?.name || "Projet inconnu",
        kanbanColumn: row.project_tasks?.kanban_column || "a_faire",
      }));
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const aFaire = (tasks || []).filter((t) => t.kanbanColumn === "a_faire");
  const enCours = (tasks || []).filter((t) => t.kanbanColumn === "en_cours");

  const handleTaskClick = (checklistId: string, kanbanColumn: string) => {
    if (onTaskClick) {
      onTaskClick(checklistId, kanbanColumn);
    } else {
      navigate(
        `/public/checklists?user=${encodeURIComponent(userName)}&role=${encodeURIComponent(userRole)}&start=${checklistId}`
      );
    }
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
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

  // ── Empty ──
  if (!tasks || tasks.length === 0) {
    return null; // silencieux dans Mon Bara
  }

  const totalCount = tasks.length;

  return (
    <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
      {/* Header collapsible */}
      <button
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-brand-orange" />
          <span className="text-xs font-semibold text-gray-600">
            Vue d'ensemble
          </span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1">
            {totalCount}
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
        <div className="px-4 pb-3 space-y-2 max-h-[40vh] overflow-y-auto">
          {aFaire.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <ClipboardCheck className="h-3 w-3 text-gray-400" />
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                  À faire
                </span>
                <span className="text-[10px] text-gray-400">· {aFaire.length}</span>
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
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="h-3 w-3 text-blue-500" />
                <span className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">
                  En cours
                </span>
                <span className="text-[10px] text-blue-400">· {enCours.length}</span>
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
  onTaskClick: (checklistId: string, kanbanColumn: string) => void;
  onProjectClick: (projectId: string) => void;
}> = ({ task, onTaskClick, onProjectClick }) => {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors group">
      {/* Titre tâche — cliquable */}
      <button
        onClick={() => onTaskClick(task.checklistId, task.kanbanColumn)}
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
