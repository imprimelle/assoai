import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectMedia, ProjectMediaFormData, MediaType, MediaSource } from '@/types/project-media';
import { appLogger } from '@/utils/logger';

// Bucket dédié aux médias de projet
const MEDIA_BUCKET = 'project-media';

async function fetchProjectMedia(projectId: string | undefined): Promise<ProjectMedia[]> {
  if (!projectId) return [];
  const { data, error } = await supabase
    .from('project_media')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) {
    appLogger.error('❌ Erreur fetch project_media', error);
    return [];
  }
  return (data || []) as ProjectMedia[];
}

export function useProjectMedia(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['project_media', projectId],
    queryFn: () => fetchProjectMedia(projectId),
    enabled: !!projectId,
    staleTime: 0,
  });

  // Upload d'un fichier → Supabase Storage + INSERT project_media
  const uploadMedia = useMutation({
    mutationFn: async (params: {
      file: File;
      project_id: string;
      type?: MediaType;
      source?: MediaSource;
      task_id?: string | null;
      label?: string;
      created_by?: string;
    }): Promise<ProjectMedia> => {
      const { file, project_id, type = 'photo', source = 'upload', task_id, label, created_by } = params;

      // 1. Upload vers Supabase Storage
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${uuidv4()}.${ext}`;
      const filePath = `projects/${project_id}/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from(MEDIA_BUCKET)
        .getPublicUrl(filePath);

      // 2. Insérer dans project_media
      const record: ProjectMediaFormData = {
        project_id,
        url: publicUrl,
        type,
        source,
        task_id: task_id || null,
        label,
        created_by,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('project_media')
        .insert(record)
        .select()
        .single();

      if (insertErr) throw insertErr;
      return inserted as ProjectMedia;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_media', projectId] });
    },
  });

  // Ajouter un média via URL (pour upload existant ailleurs)
  const addMediaUrl = useMutation({
    mutationFn: async (params: ProjectMediaFormData): Promise<ProjectMedia> => {
      const { data, error } = await supabase
        .from('project_media')
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectMedia;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_media', projectId] });
    },
  });

  // Supprimer un média (DB + Storage)
  const deleteMedia = useMutation({
    mutationFn: async (mediaId: string) => {
      // 1. Récupérer l'URL pour extraire le chemin storage
      const { data: mediaRow, error: fetchErr } = await supabase
        .from('project_media')
        .select('url')
        .eq('id', mediaId)
        .single();

      if (fetchErr) throw fetchErr;

      // 2. Supprimer le fichier du bucket (non-bloquant)
      if (mediaRow?.url) {
        try {
          // L'URL publique Supabase : https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
          const url = new URL(mediaRow.url);
          const pathParts = url.pathname.split('/');
          const publicIdx = pathParts.indexOf('public');
          if (publicIdx >= 0 && pathParts.length > publicIdx + 2) {
            // pathParts après 'public' : [bucket, ...path]
            const filePath = pathParts.slice(publicIdx + 2).join('/');
            const { error: removeErr } = await supabase.storage
              .from(MEDIA_BUCKET)
              .remove([filePath]);
            if (removeErr) {
              appLogger.error('⚠️ Storage remove failed (non-bloquant)', removeErr);
            }
          }
        } catch (parseErr) {
          appLogger.error('⚠️ URL parsing failed — storage not cleaned', parseErr);
        }
      }

      // 3. Supprimer la ligne DB
      const { error } = await supabase
        .from('project_media')
        .delete()
        .eq('id', mediaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_media', projectId] });
    },
  });

  return {
    media: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    uploadMedia,
    addMediaUrl,
    deleteMedia,
  };
}
