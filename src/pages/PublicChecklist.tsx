import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ChecklistSlide } from '@/components/checklist/ChecklistSlide';
import { Layers } from 'lucide-react';

const PublicChecklist: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const userName = searchParams.get('user') || '';
  const viewerRole = searchParams.get('role') || '';
  const [footerCollapsed, setFooterCollapsed] = useState(true);

  if (!id) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-xl mb-2">📋</p>
        <p className="text-muted-foreground">Checklist introuvable</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Bouton vers le slider */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-end shrink-0">
        <Link
          to={`/public/checklists?user=${encodeURIComponent(userName)}&start=${id}${viewerRole ? `&role=${encodeURIComponent(viewerRole)}` : ''}`}
          className="inline-flex items-center gap-1.5 text-xs text-brand-orange hover:text-orange-600 transition-colors"
        >
          <Layers className="h-3.5 w-3.5" />
          Toutes les checklists
        </Link>
      </div>

      {/* Contenu de la checklist */}
      <div className="flex-1">
        <ChecklistSlide
          checklistId={id}
          userName={userName}
          viewerRole={viewerRole}
          lazyLoad={true}
          footerCollapsed={footerCollapsed}
          onFooterToggle={setFooterCollapsed}
        />
      </div>
    </div>
  );
};

export default PublicChecklist;
