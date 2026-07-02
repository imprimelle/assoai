import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Project } from '@/types/project';
import { PHASE_CONFIG } from '@/components/projects/phaseConfig';
import {
  Truck,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  TrendingUp,
} from 'lucide-react';

// ── Rôle → types de documents visibles (même que ChecklistSlide) ──────────

const ROLE_DOC_VISIBILITY: Record<string, string[]> = {
  chef_technique: ['cahier_des_charges'],
  technicien_adjoint: ['cahier_des_charges'],
  directeur: ['facture', 'commande', 'cahier_des_charges'],
  directrice_adjointe: ['facture', 'commande', 'cahier_des_charges'],
  commerciale: ['commande'],
  superviseur_logistique: ['commande', 'cahier_des_charges'],
};

const DOC_LABELS: Record<string, string> = {
  facture: '🔵 FACTURE',
  commande: '🟠 COMMANDE',
  cahier_des_charges: '🟣 CDC',
};

// ── Types ──────────────────────────────────────────────────────────────────

interface DocEntry {
  id: string;
  type: 'facture' | 'commande' | 'cahier_des_charges';
  label: string;
  numero: string;
}

interface ProjectRecapDialogProps {
  project: Project;
  userRole: string;
  open: boolean;
  onClose: () => void;
}

// ── Composant ──────────────────────────────────────────────────────────────

const ProjectRecapDialog: React.FC<ProjectRecapDialogProps> = ({
  project,
  userRole,
  open,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [cdcInfo, setCdcInfo] = useState<any>(null);
  const [projectDocs, setProjectDocs] = useState<DocEntry[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  // ── Chargement des données projet ──────────────────────────────────────

  useEffect(() => {
    if (!open || !project.id) return;

    (async () => {
      setLoading(true);
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, template_data, template_type')
        .eq('project_id', project.id)
        .in('template_type', ['facture', 'commande', 'cahier_des_charges'])
        .or(
          'template_data->data->>is_latest.is.null,template_data->data->>is_latest.eq.true'
        )
        .order('timestamp', { ascending: false })
        .limit(10);

      if (msgs) {
        const cmd = msgs.find((m: any) => m.template_type === 'commande');
        const cdc = msgs.find((m: any) => m.template_type === 'cahier_des_charges');
        if (cmd) setOrderInfo(cmd.template_data?.data || null);
        if (cdc) setCdcInfo(cdc.template_data?.data || null);

        setProjectDocs(
          msgs.map((m: any) => {
            const td = m.template_data?.data || {};
            return {
              id: m.id,
              type: m.template_type,
              label: DOC_LABELS[m.template_type] || m.template_type.toUpperCase(),
              numero:
                td.factureNumero || td.commandeNumero || td.cdcNumero || '',
            };
          })
        );
      }
      setLoading(false);
    })();
  }, [open, project.id]);

  // ── Dérivés ────────────────────────────────────────────────────────────

  const phase = project.phase || '';
  const cfg = PHASE_CONFIG[phase];
  const deliveryDate = orderInfo?.dateLivraison
    ? new Date(orderInfo.dateLivraison).toLocaleDateString('fr-FR')
    : '';
  const deliveryAddress =
    orderInfo?.deliveryAddress?.label || cdcInfo?.deliveryAddress?.label || '';
  const orderItems = orderInfo?.items || [];
  const enseigneImages: string[] = (cdcInfo?.enseignes || [])
    .map((e: any) => e.details?.image_url)
    .filter(Boolean);

  const hasDetails =
    enseigneImages.length > 0 ||
    deliveryDate ||
    orderItems.length > 0 ||
    deliveryAddress;

  const allowedDocTypes = ROLE_DOC_VISIBILITY[userRole] || [];
  const visibleDocs = projectDocs.filter((d) =>
    allowedDocTypes.includes(d.type)
  );

  const healthScore = 0; // on pourrait injecter via props si besoin

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-bold text-gray-900 truncate flex-1">
              {project.name}
            </DialogTitle>
            {cfg && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: cfg.bg || '#f3f4f6',
                  color: cfg.color || '#374151',
                }}
              >
                {cfg.label || phase}
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {project.description}
            </p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse flex flex-col items-center gap-3">
              <div className="h-1 w-12 bg-brand-orange rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
              <p className="text-xs text-muted-foreground">Chargement...</p>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-3">
            {/* 🚚 Détails du projet */}
            {hasDetails && (
              <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-100 transition-colors"
                >
                  <Truck className="h-4 w-4 text-brand-orange shrink-0" />
                  <span className="text-xs font-medium flex-1 text-left text-gray-600">
                    Détails du projet
                  </span>
                  {showDetails ? (
                    <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  )}
                </button>

                {showDetails && (
                  <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-2.5">
                    {/* Enseignes */}
                    {enseigneImages.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                          Enseignes
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {enseigneImages.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-12 h-12 rounded-lg border border-gray-100 overflow-hidden bg-white hover:ring-2 hover:ring-brand-orange/30 transition-all"
                            >
                              <img
                                src={url}
                                alt={`Enseigne ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Livraison + adresse */}
                    {(deliveryDate || deliveryAddress) && (
                      <div className="space-y-2">
                        {deliveryDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <p className="text-xs font-medium text-gray-700">
                              Livraison prévue : {deliveryDate}
                            </p>
                          </div>
                        )}
                        {deliveryAddress && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              {deliveryAddress}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Produits commandés */}
                    {orderItems.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                          Produits
                        </p>
                        <div className="space-y-1.5">
                          {orderItems.map((item: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg border border-gray-100 overflow-hidden bg-white shrink-0">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.nom || ''}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs">
                                    📦
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-700">
                                  {item.nom}
                                </p>
                                {item.quantite > 1 && (
                                  <p className="text-[10px] text-muted-foreground">
                                    ×{item.quantite}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 📄 Documents */}
            {visibleDocs.length > 0 && (
              <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setShowDocs(!showDocs)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-100 transition-colors"
                >
                  <FileText className="h-4 w-4 text-brand-orange shrink-0" />
                  <span className="text-xs font-medium flex-1 text-left text-gray-600">
                    Documents du projet
                  </span>
                  {!showDocs && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-4 px-1 shrink-0"
                    >
                      {visibleDocs.length}
                    </Badge>
                  )}
                  {showDocs ? (
                    <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  )}
                </button>

                {showDocs && (
                  <div className="border-t border-gray-100">
                    {visibleDocs.map((doc) => (
                      <a
                        key={doc.id}
                        href={`/public/doc/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-0"
                      >
                        <span className="text-xs font-medium flex-1 text-gray-700">
                          {doc.label}
                          {doc.numero && (
                            <span className="text-[10px] text-muted-foreground ml-1.5">
                              {doc.numero}
                            </span>
                          )}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fallback : ni détails ni documents */}
            {!hasDetails && visibleDocs.length === 0 && (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  Aucun document ou détail disponible pour ce projet.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectRecapDialog;
