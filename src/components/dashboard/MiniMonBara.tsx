
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, Clock, ArrowRight, Folder } from "lucide-react";
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

const MiniMonBara: React.FC<MiniMonBaraProps> = ({ userRole, userName }) => {
  const navigate = useNavigate();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["dashboard-mini-monbara", userRole],
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
        projectId: row.project_id || row.projects?.id,
        projectName: row.projects?.name || "Projet inconnu",
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 flex-1 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (!tasks || tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-500">
            Mon Bara
          </h3>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Aucune tâche en attente. Tout est clean ✨
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-brand-orange" />
          <h3 className="text-sm font-semibold text-gray-700">Mon Bara</h3>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {tasks.length}
          </Badge>
        </div>
        <button
          onClick={() =>
            navigate(
              `/public/checklists?user=${encodeURIComponent(userName)}&role=${encodeURIComponent(userRole)}`
            )
          }
          className="text-[11px] text-brand-orange hover:underline flex items-center gap-1"
        >
          Voir tout <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* ── Section À faire ── */}
      {aFaire.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ClipboardCheck className="h-3 w-3 text-gray-400" />
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
              À faire
            </span>
            <Badge variant="outline" className="text-[10px] h-4 px-1 border-gray-200 text-gray-400">
              {aFaire.length}
            </Badge>
          </div>
          <div className="space-y-1.5">
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

      {/* ── Section En cours ── */}
      {enCours.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="h-3 w-3 text-blue-500" />
            <span className="text-[11px] font-medium text-blue-500 uppercase tracking-wide">
              En cours
            </span>
            <Badge variant="outline" className="text-[10px] h-4 px-1 border-blue-200 text-blue-500">
              {enCours.length}
            </Badge>
          </div>
          <div className="space-y-1.5">
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
  );
};

// ── Ligne tâche ──

const TaskRow: React.FC<{
  task: TaskRow;
  onTaskClick: (checklistId: string) => void;
  onProjectClick: (projectId: string) => void;
}> = ({ task, onTaskClick, onProjectClick }) => {
  const config = STATUS_CONFIG[task.kanbanColumn] || STATUS_CONFIG.a_faire;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group">
      {/* Icône statut */}
      <span className="shrink-0">{config.icon}</span>

      {/* Titre tâche — cliquable → Mon Bara */}
      <button
        onClick={() => onTaskClick(task.checklistId)}
        className="flex-1 text-left text-sm text-gray-700 group-hover:text-brand-orange transition-colors truncate"
        title={task.taskTitle}
      >
        {task.taskTitle}
      </button>

      {/* Projet — cliquable → page projet */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onProjectClick(task.projectId);
        }}
        className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 hover:bg-brand-orange/10 hover:text-brand-orange transition-colors truncate max-w-[120px]"
        title={task.projectName}
      >
        <Folder className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{task.projectName}</span>
      </button>
    </div>
  );
};

export default MiniMonBara;
