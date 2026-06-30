import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, Download, Calendar, User, MapPin, Wrench, Package, Loader2, Pencil } from 'lucide-react';
import TemplateModal from '@/components/templates/TemplateModal';
import type { TemplateType } from '@/types/template';
import type { TemplateData } from '@/types/template-data';
import { generatePDFClient } from '@/services/pdfGenerator';

const PublicDocument: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const templateTypeMap: Record<string, TemplateType> = {
    facture: 'facture',
    commande: 'commande',
    devis: 'devis',
    cahier_des_charges: 'cahier_des_charges',
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('messages').select('*').eq('id', id).single();
      if (!error && data) setDoc(data);
      setLoading(false);
    })();
  }, [id]);

  const handleGeneratePDF = async () => {
    if (!doc) return;
    setGeneratingPdf(true);
    try {
      const result = await generatePDFClient(
        doc.template_type as TemplateType,
        doc.template_data?.data || {},
        'public',
        'public'
      );
      if (result.success && result.pdfBlob) {
        // Téléchargement direct
        const url = URL.createObjectURL(result.pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || `document.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch { /* PDF non disponible */ }
    setGeneratingPdf(false);
  };

  const handleSaveEdit = async (newData: TemplateData) => {
    if (!doc) return;
    const nextVersion = (doc.template_data?.version || 1) + 1;
    const newTemplateData = { data: newData, version: nextVersion };

    const { error } = await supabase
      .from('messages')
      .update({ template_data: newTemplateData })
      .eq('id', doc.id);

    if (!error) {
      setDoc({ ...doc, template_data: newTemplateData });
      setShowEdit(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-brand-orange">Asso</span>
          <span className="text-gray-900">AI</span>
        </h1>
        <div className="h-1 w-12 bg-brand-orange rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
        <p className="text-xs text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );

  if (!doc) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <p className="text-muted-foreground">Document introuvable</p>
    </div>
  );

  const td = doc.template_data?.data || {};
  const type = doc.template_type;
  const typeLabels: Record<string, string> = { facture: '🔵 Facture', commande: '🟠 Commande', devis: '🟢 Devis', cahier_des_charges: '🟣 Cahier des Charges' };
  const numero = td.factureNumero || td.devisNumero || td.commandeNumero || td.cdcNumero || '?';
  const client = td.client?.nom || td.titre || '';
  const total = td.total ? `${td.total?.toLocaleString()} FCFA` : '';
  const date = td.dateEmission || td.dateCommande || td.dateDevis || '';
  const items = td.details || td.items || [];
  const isCDC = type === 'cahier_des_charges';
  const enseignes = td.enseignes || [];
  const equipe = td.equipe || [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-md mx-auto">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div className="text-center mb-4">
            <p className="text-xs text-muted-foreground mb-1">Imprimelle — Document</p>
            <h1 className="text-lg font-bold">{typeLabels[type] || '📄 Document'}</h1>
            <p className="text-2xl font-bold text-brand-orange mt-1">{numero}</p>
          </div>

          <div className="space-y-2 text-sm">
            {client && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{client}</span>
              </div>
            )}
            {date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{date}</span>
              </div>
            )}
            {td.deliveryAddress?.label && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{td.deliveryAddress.label}</span>
              </div>
            )}
            {total && (
              <p className="text-lg font-bold mt-2">{total}</p>
            )}
            {td.statut && (
              <p className="text-xs text-muted-foreground">Statut : {td.statut}</p>
            )}
          </div>

          {td.version && (
            <p className="text-xs text-muted-foreground mt-3 text-right">v{td.version}</p>
          )}
        </div>

        {/* Items / Détails */}
        {items.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
            <h2 className="font-semibold mb-3">{type === 'commande' ? 'Articles' : 'Détails'}</h2>
            <div className="space-y-2">
              {items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <span className="flex-1">{item.description || item.nom || `Item ${i + 1}`}</span>
                  {item.quantite && <span className="text-muted-foreground mx-2">×{item.quantite}</span>}
                  {item.prixUnitaire && <span className="font-medium">{item.prixUnitaire?.toLocaleString()} F</span>}
                  {item.sous_total && <span className="font-medium ml-2">{item.sous_total?.toLocaleString()} F</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CDC — Enseignes + Matériaux */}
        {isCDC && enseignes.length > 0 && (
          <div className="space-y-4">
            {enseignes.map((ens: any, ei: number) => (
              <div key={ei} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="h-4 w-4 text-brand-orange" />
                  <h3 className="font-semibold">{ens.nom || `Enseigne ${ei + 1}`}</h3>
                </div>

                {ens.details?.dimensions && (
                  <p className="text-sm text-muted-foreground mb-2">
                    📏 {ens.details.dimensions.largeur}×{ens.details.dimensions.hauteur}×{ens.details.dimensions.profondeur} cm
                  </p>
                )}

                {ens.materiauxSections && Object.entries(ens.materiauxSections).map(([section, mats]: [string, any]) => (
                  <div key={section} className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{section}</p>
                    {(mats as any[]).map((mat: any, mi: number) => (
                      <div key={mi} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                        <span>{mat.nom}</span>
                        <span className="text-muted-foreground">
                          {mat.quantite} {mat.unite}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}

                {ens.produits?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Produits associés</p>
                    {ens.produits.map((p: any, pi: number) => (
                      <div key={pi} className="flex items-center gap-2 text-sm py-1">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <span>{p.nom}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CDC — Équipe */}
        {isCDC && equipe.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mt-4">
            <h3 className="font-semibold mb-2">👥 Équipe</h3>
            <div className="space-y-1">
              {equipe.map((m: any, mi: number) => (
                <div key={mi} className="text-sm flex justify-between">
                  <span>{m.nom}</span>
                  <span className="text-muted-foreground">{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sticky footer — Boutons d'action */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg z-50">
          <div className="max-w-md mx-auto flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              size="lg"
              onClick={() => setShowEdit(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              ✏️ Modifier
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={handleGeneratePDF}
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {generatingPdf ? 'Génération...' : '📥 Télécharger'}
            </Button>
          </div>
        </div>

        {/* Modale d'édition */}
        {showEdit && doc && templateTypeMap[doc.template_type] && (
          <TemplateModal
            isOpen={showEdit}
            onClose={() => setShowEdit(false)}
            templateType={templateTypeMap[doc.template_type]}
            data={doc.template_data?.data || {}}
            messageId={doc.id}
            metadata={{
              displayName: `${typeLabels[doc.template_type] || 'Document'} ${numero}`,
              mode: 'editable',
              availableActions: ['save', 'pdf'],
            }}
            onSave={handleSaveEdit}
          />
        )}
      </div>
    </div>
  );
};

export default PublicDocument;
