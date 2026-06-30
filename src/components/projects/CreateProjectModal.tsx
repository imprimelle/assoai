import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, FileText, FilePlus, ArrowLeft } from 'lucide-react';
import { useDocumentSearch, type DocumentSearchResult } from '@/hooks/useDocumentSearch';
import { useCreateProjectWithFacture } from '@/hooks/useCreateProjectWithFacture';
import { useIsMobile } from '@/hooks/use-mobile';
import FactureTemplate from '@/components/templates/FactureTemplate';
import type { FactureData } from '@/types';
import { supabase } from '@/integrations/supabase/client';

// ─── Constantes ────────────────────────────────────────────

type ModalStep = 'choose' | 'search' | 'create';

// Données par défaut pour une nouvelle facture (mode création)
function getDefaultFactureData(): FactureData {
  return {
    factureNumero: `F-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-XXXXX`,
    dateEmission: new Date().toISOString().split('T')[0],
    client: { nom: '', adresse: '', telephone: '' },
    details: [
      {
        id: crypto.randomUUID(),
        description: '',
        quantite: 1,
        prixUnitaire: 0,
        sous_total: 0,
      },
    ],
    total: 0,
    version: 1,
    is_latest: true,
  };
}

// ─── Props ──────────────────────────────────────────────────

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userSessionId: string;
  onProjectCreated: (projectId: string) => void;
}

// ─── Composant ──────────────────────────────────────────────

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  open,
  onOpenChange,
  userId,
  userSessionId,
  onProjectCreated,
}) => {
  const [step, setStep] = useState<ModalStep>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [factureData, setFactureData] = useState<FactureData>(getDefaultFactureData());
  const isMobile = useIsMobile();

  const { data: searchResults, isLoading: isSearching } = useDocumentSearch(searchQuery);
  const { createFromExisting, createFromNew } = useCreateProjectWithFacture();

  // Reset au changement d'état de la modale
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Reset différé pour éviter de voir le flash
        setTimeout(() => {
          setStep('choose');
          setSearchQuery('');
          setFactureData(getDefaultFactureData());
        }, 200);
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  // 🔧 BUGFIX: Réserver un vrai numéro de facture via le RPC Supabase
  // quand l'utilisateur entre dans l'étape "create".
  // Avant: factureNumero = "F-YYYYMMDD-XXXXX" (placeholder littéral)
  // Après: factureNumero = "F-2026-065" (numéro séquentiel réel)
  const [allocatingNumero, setAllocatingNumero] = useState(false);
  useEffect(() => {
    if (step !== 'create') return;
    if (allocatingNumero) return;

    setAllocatingNumero(true);
    supabase.rpc('next_document_number', { p_doc_type: 'facture' })
      .then(({ data, error }) => {
        if (!error && data) {
          const numero = typeof data === 'string' ? data.replace(/^"|"$/g, '') : String(data);
          setFactureData(prev => ({ ...prev, factureNumero: numero }));
        }
        // Si échec, on garde le placeholder — l'utilisateur pourra le modifier
      })
      .finally(() => setAllocatingNumero(false));
  }, [step]);

  // ─── Mode A : Recherche de facture existante ──────────

  const handleSelectExistingFacture = useCallback(
    (doc: DocumentSearchResult) => {
      createFromExisting.mutate(
        { doc, userId, userSessionId },
        {
          onSuccess: ({ projectId }) => {
            handleOpenChange(false);
            onProjectCreated(projectId);
          },
        }
      );
    },
    [createFromExisting, userId, userSessionId, handleOpenChange, onProjectCreated]
  );

  // ─── Mode B : Création nouvelle facture ───────────────

  const handleFactureSave = useCallback(
    (data: FactureData) => {
      createFromNew.mutate(
        { factureData: data, userId, userSessionId },
        {
          onSuccess: ({ projectId }) => {
            handleOpenChange(false);
            onProjectCreated(projectId);
          },
        }
      );
    },
    [createFromNew, userId, userSessionId, handleOpenChange, onProjectCreated]
  );

  const isSaving = createFromExisting.isPending || createFromNew.isPending;

  // ─── Rendu ─────────────────────────────────────────────

  const renderStepIndicator = () => (
    <div className="flex items-center gap-2 mb-4">
      {step !== 'choose' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setStep('choose')}
          disabled={isSaving}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <span className="text-sm text-muted-foreground">
        {step === 'choose' && 'Nouveau projet'}
        {step === 'search' && 'Rechercher une facture'}
        {step === 'create' && 'Nouvelle facture'}
      </span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 ${isMobile ? 'rounded-none h-[100dvh] max-h-[100dvh]' : 'rounded-lg'}`}>
        {/* En-tête avec padding (car p-0 sur DialogContent) */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0 shrink-0">
          <DialogHeader className="p-0">
            <DialogTitle>
              {step === 'choose' && 'Créer un projet'}
              {step === 'search' && 'Rechercher une facture existante'}
              {step === 'create' && 'Nouvelle facture'}
            </DialogTitle>
          </DialogHeader>
          {renderStepIndicator()}
        </div>

        {/* ─── ÉTAPE 1 : Choix du mode ─────────────────── */}
        {step === 'choose' && (
          <div className="px-4 sm:px-6 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Carte Rechercher */}
            <button
              onClick={() => setStep('search')}
              className="flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-left group"
            >
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Search className="h-7 w-7 text-blue-600" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-base mb-1">Rechercher une facture</h3>
                <p className="text-sm text-muted-foreground">
                  Trouvez une facture déjà créée pour démarrer le projet. Le nom du client devient le nom du projet.
                </p>
              </div>
            </button>

            {/* Carte Créer */}
            <button
              onClick={() => setStep('create')}
              className="flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50/50 transition-all text-left group"
            >
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <FilePlus className="h-7 w-7 text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-base mb-1">Créer une facture</h3>
                <p className="text-sm text-muted-foreground">
                  Remplissez vous-même les informations de la facture. Le projet sera créé automatiquement.
                </p>
              </div>
            </button>
            </div>
          </div>
        )}

        {/* ─── ÉTAPE 2A : Recherche ────────────────────── */}
        {step === 'search' && (
          <div className="flex-1 min-h-0 flex flex-col px-4 sm:px-6">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par numéro de facture ou nom du client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            <div className="flex-1 min-h-0 mt-3">
              {isSearching && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isSearching && searchQuery.length >= 2 && searchResults && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Aucune facture trouvée pour « {searchQuery} »
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1"
                    onClick={() => setStep('create')}
                  >
                    Créer une nouvelle facture à la place
                  </Button>
                </div>
              )}

              {searchResults && searchResults.length > 0 && (
                <div className="overflow-y-auto h-full max-h-[60vh] sm:max-h-[400px] pb-2 -mr-2 pr-2">
                  <div className="space-y-2">
                    {searchResults.map((doc) => (
                      <button
                        key={doc.id}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors text-left ${
                          doc.projectId
                            ? 'border-amber-200 bg-amber-50/30'
                            : 'border-gray-200'
                        }`}
                        onClick={() => handleSelectExistingFacture(doc)}
                        disabled={isSaving}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText
                            className={`h-5 w-5 shrink-0 ${
                              doc.projectId ? 'text-amber-500' : 'text-blue-500'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm font-semibold text-blue-700">
                                {doc.numero}
                              </p>
                              {doc.projectId && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium shrink-0">
                                  Déjà liée
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {doc.client || 'Client inconnu'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-sm font-semibold">
                            {doc.montant.toLocaleString()} FCFA
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {doc.date
                              ? new Date(doc.date).toLocaleDateString('fr')
                              : ''}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchQuery.length < 2 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Tapez au moins 2 caractères pour rechercher une facture
                </p>
              )}
            </div>
          </div>
        )}

        {/* ─── ÉTAPE 2B : Création nouvelle facture ─────── */}
        {step === 'create' && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Zone scrollable — même pattern que TemplateModalContent */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 bg-white">
              {/* Même wrapper que TemplateRenderer : px-2 sm:px-6 */}
              <div className="w-full px-2 sm:px-6">
                <FactureTemplate
                  data={factureData}
                  isEditable={true}
                  onSave={handleFactureSave}
                  onChange={(data) => setFactureData(data)}
                />
              </div>
              {/* Espacement en bas pour le dernier élément (mobile safe area) */}
              <div className={`${isMobile ? 'h-24' : 'h-12'}`} />
            </div>

            {/* Barre d'actions en bas — toujours visible */}
            <div className={`shrink-0 flex items-center justify-between px-4 sm:px-6 pt-3 pb-3 border-t bg-white ${isMobile ? 'pb-6' : ''}`}>
              <p className="text-xs text-muted-foreground">
                Cliquez sur <span className="font-medium text-foreground">Enregistrer</span> dans le formulaire pour créer le projet.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('choose')}
                  disabled={isSaving}
                >
                  ← Retour
                </Button>
                {isSaving && (
                  <Button disabled size="sm" className="gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Création...
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectModal;
