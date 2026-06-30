import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TemplateMiniCard } from './TemplateMiniCard';
import { DeriveButton } from './DeriveButton';
import TemplateModal from '@/components/templates/TemplateModal';
import type { TemplateType, TemplateData } from '@/types';
import { useDocumentChain, type ChainDocument } from '@/hooks/useDocumentChain';
import { useDeriveDocument } from '@/hooks/useDeriveDocument';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { DocumentSearchResult } from '@/hooks/useDocumentSearch';
import { Loader2, ShieldAlert, Download, FileDown, Trash2, AlertTriangle } from 'lucide-react';
import {
  validateFactureForDerivation,
  validateCommandeForDerivation,
  type ValidationResult,
} from '@/services/validateDocument';
import { generatePDFClient } from '@/services/pdfGenerator';

interface ProjectDocumentAccordionProps {
  selectedFacture: DocumentSearchResult | null;
  projectId: string;
  userId: string;
  onFactureDetached?: () => void;  // Callback quand la facture est détachée
  projectInitialized?: boolean;     // CDC verrouillé si le projet a des tâches Kanban
}

/**
 * Accordéon 3 sections : Facture → Commande → CDC.
 * - Garde-fous : validation complète avant dérivation
 * - Boutons Détacher / Régénérer sur chaque carte
 */
export const ProjectDocumentAccordion: React.FC<ProjectDocumentAccordionProps> = ({
  selectedFacture,
  projectId,
  userId,
  onFactureDetached,
  projectInitialized = false,
}) => {
  const [localCommande, setLocalCommande] = useState<ChainDocument | null>(null);
  const [localCDC, setLocalCDC] = useState<ChainDocument | null>(null);
  const [cmdError, setCmdError] = useState<string | null>(null);
  const [cdcError, setCdcError] = useState<string | null>(null);

  // 🔧 Persistance des dérivations : survit aux navigations/changements de page
  const DERIVE_PENDING_KEY_CMD = `derive_pending_cmd_${projectId}`;
  const DERIVE_PENDING_KEY_CDC = `derive_pending_cdc_${projectId}`;

  const saveDerivePending = (type: 'commande' | 'cdc', factureNumero: string, commandeNumero?: string) => {
    const key = type === 'commande' ? DERIVE_PENDING_KEY_CMD : DERIVE_PENDING_KEY_CDC;
    localStorage.setItem(key, JSON.stringify({ factureNumero, commandeNumero, startedAt: Date.now() }));
  };

  const clearDerivePending = (type: 'commande' | 'cdc') => {
    const key = type === 'commande' ? DERIVE_PENDING_KEY_CMD : DERIVE_PENDING_KEY_CDC;
    localStorage.removeItem(key);
  };

  const getDerivePending = (type: 'commande' | 'cdc'): { factureNumero: string; commandeNumero?: string; startedAt: number } | null => {
    const key = type === 'commande' ? DERIVE_PENDING_KEY_CMD : DERIVE_PENDING_KEY_CDC;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  // États pour le spinner pendant la reprise auto (survit au remount)
  const [resumingCmd, setResumingCmd] = useState(false);
  const [resumingCDC, setResumingCDC] = useState(false);

  // Données complètes des documents (fetch pour validation)
  const [factureFullData, setFactureFullData] = useState<any>(null);
  const [commandeFullData, setCommandeFullData] = useState<any>(null);
  const [cdcFullData, setCdcFullData] = useState<any>(null);

  // État pour le modal d'édition de document
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessageId, setModalMessageId] = useState('');
  const [modalTemplateType, setModalTemplateType] = useState<TemplateType>('facture');
  const [modalData, setModalData] = useState<TemplateData>({} as TemplateData);
  const [modalLoading, setModalLoading] = useState(false);
  // Chaîne documentaire pour le slider
  const [chainDocuments, setChainDocuments] = useState<any[] | undefined>(undefined);
  const [chainCurrentIndex, setChainCurrentIndex] = useState(0);

  const { data: chain } = useDocumentChain(
    selectedFacture?.numero,
    selectedFacture ? {
      id: selectedFacture.id,
      templateType: selectedFacture.templateType,
      numero: selectedFacture.numero,
      client: selectedFacture.client,
      montant: selectedFacture.montant,
      date: selectedFacture.date,
      version: selectedFacture.version,
      data: null,
    } : null,
    projectId  // ← filtre la chaîne par projet
  );
  const deriveCmd = useDeriveDocument();
  const deriveCDC = useDeriveDocument();
  const queryClient = useQueryClient();

  // Si une dérivation est pending (localStorage), le spinner est visible
  // ⚠️ Doit être APRÈS deriveCmd/deriveCDC (temporal dead zone)
  const isDerivingCmd = deriveCmd.isLoading || resumingCmd;
  const isDerivingCDC = deriveCDC.isLoading || resumingCDC;

  // Refs pour les handlers : l'effet auto-resume appelle toujours la dernière version
  const handleDeriveCommandeRef = useRef<() => Promise<void>>(async () => {});
  const handleDeriveCDCRef = useRef<() => Promise<void>>(async () => {});

  // Ref pour éviter de clearDerivePending au montage initial (selectedFacture?.numero passe de undefined → valeur)
  const prevFactureNumeroRef = useRef<string | undefined>(undefined);

  // Fetch les données complètes des documents pour validation
  useEffect(() => {
    const fetchFullData = async () => {
      // Facture
      if (selectedFacture?.id) {
        try {
          const { data: msg } = await supabase
            .from('messages')
            .select('template_type, template_data')
            .eq('id', selectedFacture.id)
            .single();
          if (msg) {
            setFactureFullData((msg.template_data as any)?.data || null);
          }
        } catch { setFactureFullData(null); }
      } else {
        setFactureFullData(null);
      }

      // Commande (depuis la chaîne)
      const cmdId = chain?.commande?.id || localCommande?.id;
      if (cmdId) {
        try {
          const { data: msg } = await supabase
            .from('messages')
            .select('template_type, template_data')
            .eq('id', cmdId)
            .single();
          if (msg) {
            setCommandeFullData((msg.template_data as any)?.data || null);
          }
        } catch { setCommandeFullData(null); }
      } else if (localCommande?.data) {
        setCommandeFullData(localCommande.data);
      } else {
        setCommandeFullData(null);
      }

      // CDC
      const cdcId = chain?.cahierDesCharges?.id || localCDC?.id;
      if (cdcId) {
        try {
          const { data: msg } = await supabase
            .from('messages')
            .select('template_type, template_data')
            .eq('id', cdcId)
            .single();
          if (msg) {
            setCdcFullData((msg.template_data as any)?.data || null);
          }
        } catch { setCdcFullData(null); }
      } else if (localCDC?.data) {
        setCdcFullData(localCDC.data);
      } else {
        setCdcFullData(null);
      }
    };
    fetchFullData();
  }, [selectedFacture?.id, chain, localCommande, localCDC]);

  // Validation en continu (memoized)
  const factureValidation = useMemo(() => {
    if (!factureFullData) return null;
    return validateFactureForDerivation(factureFullData);
  }, [factureFullData]);

  const commandeValidation = useMemo(() => {
    if (!commandeFullData) return null;
    return validateCommandeForDerivation(commandeFullData);
  }, [commandeFullData]);

  // À la sélection d'une facture, réinitialiser l'état local
  // 🔧 Ne clear PAS le pending au montage initial (undefined → valeur)
  useEffect(() => {
    const currentNumero = selectedFacture?.numero;
    const prevNumero = prevFactureNumeroRef.current;
    prevFactureNumeroRef.current = currentNumero;

    setLocalCommande(null);
    setLocalCDC(null);
    setCmdError(null);
    setCdcError(null);
    deriveCmd.reset();
    deriveCDC.reset();

    // Ne clear le pending QUE si l'utilisateur a CHANGÉ de facture
    // (évite d'effacer le pending au montage initial quand selectedFacture passe de undefined → valeur)
    if (prevNumero !== undefined && prevNumero !== currentNumero) {
      clearDerivePending('commande');
      clearDerivePending('cdc');
    }
  }, [selectedFacture?.numero]);

  // Si la chaîne existe déjà en base, l'afficher
  useEffect(() => {
    if (chain?.commande) setLocalCommande(chain.commande);
    if (chain?.cahierDesCharges) setLocalCDC(chain.cahierDesCharges);
  }, [chain]);

  // 🔧 Auto-resume : si une dérivation était en cours lors d'une navigation précédente
  // On vérifie le localStorage et on relance automatiquement.
  // Timeout de 5 minutes — passé ce délai, on affiche une erreur.
  useEffect(() => {
    const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

    // Vérifier commande pending
    const pendingCmd = getDerivePending('commande');
    if (pendingCmd && selectedFacture && !localCommande && !chain?.commande) {
      if (Date.now() - pendingCmd.startedAt > MAX_AGE_MS) {
        clearDerivePending('commande');
        setCmdError('La génération a expiré. Veuillez réessayer.');
        return;
      }
      if (pendingCmd.factureNumero === selectedFacture.numero && factureFullData) {
        setResumingCmd(true);
        handleDeriveCommandeRef.current().finally(() => setResumingCmd(false));
      }
    }

    // Vérifier CDC pending
    const pendingCDC = getDerivePending('cdc');
    if (pendingCDC && selectedFacture && !localCDC && !chain?.cahierDesCharges) {
      if (Date.now() - pendingCDC.startedAt > MAX_AGE_MS) {
        clearDerivePending('cdc');
        setCdcError('La génération a expiré. Veuillez réessayer.');
        return;
      }
      // Pour le CDC, il faut que la commande soit disponible (soit local, soit chain)
      const cmd = localCommande || chain?.commande;
      if (pendingCDC.factureNumero === selectedFacture.numero && cmd && commandeFullData) {
        setResumingCDC(true);
        handleDeriveCDCRef.current().finally(() => setResumingCDC(false));
      }
    }
  }, [selectedFacture?.numero, factureFullData, commandeFullData, localCommande, chain]);

  // ============================================================
  // HANDLERS
  // ============================================================

  // État pour le téléchargement PDF
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);

  // État pour la confirmation de détachement
  const [detachTarget, setDetachTarget] = useState<{ messageId: string; type: 'facture' | 'commande' | 'cdc'; label: string; numero: string } | null>(null);

  /**
   * Télécharge le PDF d'un document.
   * Utilise les données complètes déjà fetchées (factureFullData, etc.)
   * ou fetch à la volée si pas encore disponible.
   */
  const handleDownloadPDF = async (docId: string, docType: string) => {
    setDownloadingDoc(docId);
    try {
      // Récupérer les données complètes
      let fullData: any = null;
      
      if (docType === 'facture') fullData = factureFullData;
      else if (docType === 'commande') fullData = commandeFullData;
      else if (docType === 'cahier_des_charges') fullData = cdcFullData;

      // Fallback : fetch si pas encore en mémoire
      if (!fullData && docId) {
        const { data: msg } = await supabase
          .from('messages')
          .select('template_type, template_data')
          .eq('id', docId)
          .single();
        if (msg) fullData = (msg.template_data as any)?.data;
      }

      if (!fullData) {
        throw new Error('Données du document introuvables');
      }

      const result = await generatePDFClient(
        docType as any,
        fullData,
        userId,
        'download'
      );

      if (result.success && result.pdfUrl) {
        // Téléchargement automatique
        const link = document.createElement('a');
        link.href = result.pdfUrl;
        link.download = result.filename || `document_${docType}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Nettoyer l'URL blob après un court délai
        setTimeout(() => URL.revokeObjectURL(result.pdfUrl!), 2000);
      } else {
        throw new Error(result.error || 'Échec de la génération PDF');
      }
    } catch (err: any) {
      console.error('handleDownloadPDF error:', err);
      // Le toast est géré par generatePDFClient
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleDeriveCommande = async () => {
    if (!selectedFacture) return;
    setCmdError(null);
    // 🔧 Persistance : sauver l'intention pour reprise après navigation
    saveDerivePending('commande', selectedFacture.numero);

    // Utiliser factureFullData (déjà fetché pour la validation) — contient TOUS les champs
    // Si pas encore dispo, fetch synchrone pour ne JAMAIS envoyer le fallback minimal
    let dataToSend = factureFullData;
    if (!dataToSend && selectedFacture.id) {
      try {
        const { data: msg } = await supabase.from('messages')
          .select('template_type, template_data')
          .eq('id', selectedFacture.id).single();
        if (msg) dataToSend = (msg.template_data as any)?.data;
      } catch { /* garder null → fallback */ }
    }
    
    const templateToSend = dataToSend
      ? { templateType: 'facture' as const, data: dataToSend }
      : {
          templateType: 'facture' as const,
          data: {
            factureNumero: selectedFacture.numero,
            version: selectedFacture.version,
            client: { nom: selectedFacture.client },
            total: selectedFacture.montant,
          },
        };

    const result = await deriveCmd.derive(
      'Crée la commande à partir de cette facture',
      'hermes-wari',
      ['document-derivation', 'document-create', 'document-numbers'],
      templateToSend,
      projectId,
      undefined  // Pas de sourceMessageId — on envoie déjà les données complètes
    );
    if (result.success && result.data) {
      const newCommandeNumero = result.data.commandeNumero;

      // Marquer anciennes commandes is_latest=false
      const { data: oldCommandes } = await (supabase.from('messages') as any)
        .select('id, template_data')
        .eq('template_type', 'commande')
        .filter('template_data->data->>linked_facture_id', 'eq', selectedFacture.numero);
      if (oldCommandes) {
        for (const old of oldCommandes) {
          const oldData = (old.template_data as any)?.data;
          if (oldData?.commandeNumero && oldData.commandeNumero !== newCommandeNumero && oldData.is_latest !== false) {
            const updatedData = { ...oldData, is_latest: false };
            await (supabase.from('messages') as any)
              .update({ template_data: { data: updatedData } })
              .eq('id', old.id);
          }
        }
      }

      // Persister — utiliser les données de l'agent, pas écraser avec des strings
      const cmdData = {
        commandeNumero: newCommandeNumero,
        linked_facture_id: selectedFacture.numero,
        client: result.data.client || { nom: selectedFacture.client },
        items: result.data.items || [],
        details: result.data.details || [],
        total: result.data.total || 0,
        deliveryAddress: result.data.deliveryAddress || null,
        dateLivraison: result.data.dateLivraison || '',
        recu_image_url: result.data.recu_image_url || '',
        statut: result.data.statut || 'en_attente',
        version: 1,
        is_latest: true,
        dateCommande: result.data.dateCommande || new Date().toISOString().split('T')[0],
        reduction: result.data.reduction ?? factureFullData?.reduction ?? 0,
      };

      // 🔧 BUGFIX: Insérer la commande dérivée dans messages + attacher au projet
      const cmdMessageId = crypto.randomUUID();
      const { data: insertedCmd, error: insertErr } = await supabase
        .from('messages')
        .insert({
          id: cmdMessageId,
          session_id: `derive-${projectId}`,
          user_id: userId,
          sender: 'system',
          content: `Commande ${newCommandeNumero}`,
          template_type: 'commande',
          template_data: { data: cmdData },
          project_id: projectId,
          session_type: 'project',
          timestamp: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('[deriveCmd] Insert commande failed:', insertErr);
      }

      // Attacher la commande aux templates du projet
      if (insertedCmd?.id) {
        const { data: proj } = await supabase
          .from('projects')
          .select('templates')
          .eq('id', projectId)
          .single();
        const templates = (proj?.templates as any) || {};
        const commandes = Array.isArray(templates.commandes) ? [...templates.commandes] : [];
        if (!commandes.includes(insertedCmd.id)) {
          commandes.push(insertedCmd.id);
        }
        await supabase
          .from('projects')
          .update({ templates: { ...templates, commandes } })
          .eq('id', projectId);
      }

      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['document-chain', selectedFacture?.numero] });

      const newCmd: ChainDocument = {
        id: insertedCmd?.id || cmdMessageId,
        templateType: 'commande',
        numero: result.data.commandeNumero || '',
        client: selectedFacture.client,
        montant: result.data.total || 0,
        date: new Date().toISOString(),
        version: 1,
        data: result.data,
      };
      setLocalCommande(newCmd);
      setCommandeFullData(result.data);
      clearDerivePending('commande');
    } else {
      setCmdError(result.error || 'Échec');
      clearDerivePending('commande');
    }
  };
  handleDeriveCommandeRef.current = handleDeriveCommande;

  const handleDeriveCDC = async () => {
    const cmd = localCommande || chain?.commande;
    if (!cmd) return;
    setCdcError(null);
    // 🔧 Persistance : sauver l'intention pour reprise après navigation
    saveDerivePending('cdc', selectedFacture?.numero || '', cmd.numero);

    // Utiliser commandeFullData (déjà fetché pour la validation) si dispo
    const templateToSend = commandeFullData
      ? { templateType: 'commande' as const, data: commandeFullData }
      : {
          templateType: 'commande' as const,
          data: {
            commandeNumero: cmd.numero,
            version: cmd.version,
            client: { nom: cmd.client },
            items: cmd.data?.items || [],
            total: cmd.montant,
            details: cmd.data?.details || [],
            deliveryAddress: cmd.data?.deliveryAddress,
            dateLivraison: cmd.data?.dateLivraison,
            linked_facture_id: cmd.data?.linked_facture_id,
            recu_image_url: cmd.data?.recu_image_url,
            reduction: cmd.data?.reduction ?? 0,
          },
        };

    const result = await deriveCDC.derive(
      'Crée le cahier des charges à partir de cette commande',
      'hermes-brico',
      ['cdc-generate', 'manufacturing-rules', 'material-calculator', 'enseigne-dimensions', 'product-search', 'document-derivation', 'document-numbers'],
      templateToSend,
      projectId,
      undefined  // Pas de sourceMessageId — on envoie déjà les données complètes
    );
    if (result.success && result.data) {
      const newCdcNumero = result.data.cdcNumero;

      if (newCdcNumero) {
        const { data: oldCDCs } = await (supabase.from('messages') as any)
          .select('id, template_data')
          .eq('template_type', 'cahier_des_charges')
          .filter('template_data->data->>commande_id', 'eq', cmd.numero);
        if (oldCDCs) {
          for (const old of oldCDCs) {
            const oldData = (old.template_data as any)?.data;
            if (oldData?.cdcNumero && oldData.cdcNumero !== newCdcNumero && oldData.is_latest !== false) {
              const updatedData = { ...oldData, is_latest: false };
              await (supabase.from('messages') as any)
                .update({ template_data: { data: updatedData } })
                .eq('id', old.id);
            }
          }
        }
      }

      const cdcData = {
        titre: result.data.titre || `CDC ${cmd.client}`,
        cdcNumero: newCdcNumero,
        commande_id: cmd.numero,
        statut: result.data.statut || 'Brouillon',
        enseignes: result.data.enseignes || [],
        equipe: result.data.equipe || [],
        deliveryAddress: result.data.deliveryAddress || null,
        version: 1,
        is_latest: true,
      };

      // 🔧 BUGFIX: Insérer le CDC dérivé dans messages + attacher au projet
      const cdcMessageId = crypto.randomUUID();
      const { data: insertedCdc, error: insertErr } = await supabase
        .from('messages')
        .insert({
          id: cdcMessageId,
          session_id: `derive-${projectId}`,
          user_id: userId,
          sender: 'system',
          content: `CDC ${newCdcNumero}`,
          template_type: 'cahier_des_charges',
          template_data: { data: cdcData },
          project_id: projectId,
          session_type: 'project',
          timestamp: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('[deriveCDC] Insert CDC failed:', insertErr);
      }

      // Attacher le CDC aux templates du projet
      if (insertedCdc?.id) {
        const { data: proj } = await supabase
          .from('projects')
          .select('templates')
          .eq('id', projectId)
          .single();
        const templates = (proj?.templates as any) || {};
        const cdCs = Array.isArray(templates.cahiers_des_charges) ? [...templates.cahiers_des_charges] : [];
        if (!cdCs.includes(insertedCdc.id)) {
          cdCs.push(insertedCdc.id);
        }
        await supabase
          .from('projects')
          .update({ templates: { ...templates, cahiers_des_charges: cdCs } })
          .eq('id', projectId);
      }

      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['document-chain', selectedFacture?.numero] });

      setLocalCDC({
        id: insertedCdc?.id || cdcMessageId,
        templateType: 'cahier_des_charges',
        numero: result.data.cdcNumero || '',
        client: cmd.client,
        montant: 0,
        date: new Date().toISOString(),
        version: 1,
        data: result.data,
      });
      clearDerivePending('cdc');
    } else {
      setCdcError(result.error || 'Échec');
      clearDerivePending('cdc');
    }
  };
  handleDeriveCDCRef.current = handleDeriveCDC;

  // Détacher un document
  // - Facture : retire project_id (délie sans supprimer). Cascade : supprime commande + CDC.
  // - Commande : supprime la commande ET le CDC lié de la DB
  // - CDC : supprime uniquement le CDC de la DB
  const executeDetach = async () => {
    if (!detachTarget) return;
    const { messageId, type } = detachTarget;
    if (!messageId) return;
    
    if (type === 'facture') {
      // 1a. Facture : délier uniquement (project_id = null)
      await (supabase.from('messages') as any)
        .update({ project_id: null })
        .eq('id', messageId);
    } else if (type === 'commande') {
      // 1b. Commande : supprimer la commande ET le CDC lié
      const cmdNumero = detachTarget.numero;
      // Supprimer le CDC lié à cette commande
      if (cmdNumero) {
        const { data: linkedCDCs } = await supabase
          .from('messages')
          .select('id')
          .eq('template_type', 'cahier_des_charges')
          .filter('template_data->data->>commande_id', 'eq', cmdNumero);
        if (linkedCDCs && linkedCDCs.length > 0) {
          for (const cdc of linkedCDCs) {
            await (supabase.from('messages') as any).delete().eq('id', cdc.id);
          }
        }
      }
      // Puis supprimer la commande elle-même
      await (supabase.from('messages') as any)
        .delete()
        .eq('id', messageId);
    } else {
      // 1c. CDC : supprimer de la DB
      await (supabase.from('messages') as any)
        .delete()
        .eq('id', messageId);
    }

    // 2. Nettoyer projects.templates des IDs supprimés
    try {
      const { data: proj } = await supabase
        .from('projects')
        .select('templates')
        .eq('id', projectId)
        .single();
      if (proj) {
        const templates = (proj.templates as any) || {};
        let changed = false;

        if (type === 'commande') {
          const commandes: string[] = Array.isArray(templates.commandes) ? [...templates.commandes] : [];
          const before = commandes.length;
          templates.commandes = commandes.filter((id: string) => id !== messageId);
          if (commandes.length !== before) changed = true;
        } else if (type === 'cdc') {
          const cdCs: string[] = Array.isArray(templates.cahiers_des_charges) ? [...templates.cahiers_des_charges] : [];
          const before = cdCs.length;
          templates.cahiers_des_charges = cdCs.filter((id: string) => id !== messageId);
          if (cdCs.length !== before) changed = true;
        } else if (type === 'facture') {
          // 🔧 BUGFIX: Nettoyer aussi templates.factures quand on détache une facture
          const factures: string[] = Array.isArray(templates.factures) ? [...templates.factures] : [];
          const before = factures.length;
          templates.factures = factures.filter((id: string) => id !== messageId);
          if (factures.length !== before) changed = true;
        }

        if (changed) {
          await supabase.from('projects').update({ templates }).eq('id', projectId);
          console.log(`[detach] projects.templates nettoyé: ${messageId} retiré de ${type}`);
        }
      }
    } catch (err) {
      console.error('[detach] Erreur nettoyage templates:', err);
    }

    // 3. Nettoyer l'état local SELON le type
    if (type === 'facture') {
      setFactureFullData(null);
      setLocalCommande(null);
      setLocalCDC(null);
      setCommandeFullData(null);
      setCdcFullData(null);
      deriveCmd.reset();
      deriveCDC.reset();
    } else if (type === 'commande') {
      setCommandeFullData(null);
      setLocalCommande(null);
      setLocalCDC(null);
      setCdcFullData(null);
      deriveCmd.reset();
      deriveCDC.reset();
    } else if (type === 'cdc') {
      setCdcFullData(null);
      setLocalCDC(null);
    }

    // 4. Invalider TOUTES les queries et attendre le refetch
    await queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
    await queryClient.invalidateQueries({ queryKey: ['document-chain', selectedFacture?.numero] });
    // 🔧 BUGFIX: Invalider aussi le compteur de documents pour la page Projets
    await queryClient.invalidateQueries({ queryKey: ['project-doc-count', projectId] });
    await queryClient.refetchQueries({ queryKey: ['document-chain', selectedFacture?.numero] });
    await queryClient.refetchQueries({ queryKey: ['project-documents', projectId] });

    // 5. Signaler au parent APRÈS le refetch (pour éviter la ré-auto-sélection)
    if (type === 'facture') {
      onFactureDetached?.();
    }

    setDetachTarget(null);
  };

  // Régénérer : supprimer l'ancien document + descendants, puis recréer
  const handleRegenerateCommande = async () => {
    const cmd = localCommande || chain?.commande;
    const cmdId = cmd?.id;
    const cmdNumero = cmd?.numero;

    deriveCmd.reset();
    setLocalCommande(null);
    setCmdError(null);

    // Supprimer l'ancienne commande et son CDC de la DB
    if (cmdNumero) {
      // Supprimer le CDC lié
      const { data: linkedCDCs } = await supabase
        .from('messages')
        .select('id')
        .eq('template_type', 'cahier_des_charges')
        .filter('template_data->data->>commande_id', 'eq', cmdNumero);
      if (linkedCDCs && linkedCDCs.length > 0) {
        for (const cdc of linkedCDCs) {
          await (supabase.from('messages') as any).delete().eq('id', cdc.id);
        }
      }
      setLocalCDC(null);
      setCdcFullData(null);
      deriveCDC.reset();
    }
    // Supprimer l'ancienne commande
    if (cmdId) {
      await (supabase.from('messages') as any).delete().eq('id', cmdId);
    }

    // Invalider les caches avant de régénérer
    await queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
    await queryClient.invalidateQueries({ queryKey: ['document-chain', selectedFacture?.numero] });

    setTimeout(() => handleDeriveCommande(), 100);
  };

  const handleRegenerateCDC = async () => {
    const cdc = localCDC || chain?.cahierDesCharges;
    const cdcId = cdc?.id;

    deriveCDC.reset();
    setLocalCDC(null);
    setCdcError(null);

    // Supprimer l'ancien CDC de la DB
    if (cdcId) {
      await (supabase.from('messages') as any).delete().eq('id', cdcId);
    }

    // Invalider les caches avant de régénérer
    await queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
    await queryClient.invalidateQueries({ queryKey: ['document-chain', selectedFacture?.numero] });

    setTimeout(() => handleDeriveCDC(), 100);
  };

  // Calcul verrouillage (doit précéder handleOpenDocument)
  const factureLocked = !!(localCommande || chain?.commande);
  const commandeLocked = !!(localCDC || chain?.cahierDesCharges);
  const cdcLocked = projectInitialized;

  const handleOpenDocument = async (messageId: string, fallbackType?: string) => {
    if (!messageId) return;
    setModalLoading(true);
    try {
      const { data: msg, error } = await supabase
        .from('messages')
        .select('template_type, template_data')
        .eq('id', messageId)
        .single();
      if (error || !msg) { console.error('Erreur chargement document:', error); return; }
      const type = (msg.template_type || fallbackType || 'facture') as TemplateType;
      const docData = (msg.template_data as any)?.data || {};
      setModalTemplateType(type);
      setModalData(docData);
      setModalMessageId(messageId);

      // Construire la chaîne documentaire pour le slider
      const cmd = localCommande || chain?.commande;
      const cdc = localCDC || chain?.cahierDesCharges;
      const chainEntries: any[] = [];

      // Facture (toujours présente si selectedFacture existe)
      if (selectedFacture?.id) {
        chainEntries.push({
          messageId: selectedFacture.id,
          templateType: 'facture' as TemplateType,
          label: 'Facture',
          locked: factureLocked,
          numero: selectedFacture.numero,
        });
      }

      // Commande (si elle existe)
      if (cmd?.id) {
        chainEntries.push({
          messageId: cmd.id,
          templateType: 'commande' as TemplateType,
          label: 'Commande',
          locked: commandeLocked,
          numero: cmd.numero,
        });
      }

      // CDC (s'il existe)
      if (cdc?.id) {
        chainEntries.push({
          messageId: cdc.id,
          templateType: 'cahier_des_charges' as TemplateType,
          label: 'CDC',
          locked: cdcLocked,
          numero: cdc.numero,
        });
      }

      // Déterminer l'index actif selon le type
      let activeIdx = 0;
      if (type === 'commande') activeIdx = chainEntries.findIndex((e: any) => e.templateType === 'commande');
      else if (type === 'cahier_des_charges') activeIdx = chainEntries.findIndex((e: any) => e.templateType === 'cahier_des_charges');
      if (activeIdx < 0) activeIdx = 0;

      setChainDocuments(chainEntries.length > 1 ? chainEntries : undefined);
      setChainCurrentIndex(activeIdx);
      setModalOpen(true);
    } catch (e) {
      console.error('Exception chargement document:', e);
    } finally {
      setModalLoading(false);
    }
  };

  const handleChainNavigate = (index: number, entry: any) => {
    setChainCurrentIndex(index);
    // Re-fetch full data for the validation state
    if (entry.messageId) {
      supabase.from('messages')
        .select('template_type, template_data')
        .eq('id', entry.messageId)
        .single()
        .then(({ data: msg }) => {
          if (msg) {
            const fullData = (msg.template_data as any)?.data || null;
            if (entry.templateType === 'facture') setFactureFullData(fullData);
            else if (entry.templateType === 'commande') setCommandeFullData(fullData);
            else if (entry.templateType === 'cahier_des_charges') setCdcFullData(fullData);
          }
        })
        .catch(() => {});
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setChainDocuments(undefined);
    setChainCurrentIndex(0);
    // Re-fetch les données complètes de la facture (version a pu changer)
    if (selectedFacture?.id) {
      supabase.from('messages')
        .select('template_type, template_data')
        .eq('id', selectedFacture.id)
        .single()
        .then(({ data: msg }) => {
          if (msg) setFactureFullData((msg.template_data as any)?.data || null);
        })
        .catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
    queryClient.invalidateQueries({ queryKey: ['document-chain', selectedFacture?.numero] });
  };

  // ============================================================
  // RENDU — Section garde-fou
  // ============================================================

  const renderValidationBlock = (validation: ValidationResult | null) => {
    if (!validation || validation.valid) return null;
    return (
      <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
        <div className="flex items-center gap-2 mb-2 text-amber-800 font-medium">
          <ShieldAlert className="h-4 w-4" />
          Dérivation bloquée
        </div>
        <ul className="space-y-1 text-amber-700">
          {validation.reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="text-red-500 shrink-0 mt-0.5">❌</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
        {validation.warnings.length > 0 && (
          <ul className="space-y-1 mt-2 pt-2 border-t border-amber-200 text-amber-600">
            {validation.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDU — Sections
  // ============================================================

  const sections = [
    { value: 'facture', icon: '🔵', label: 'Facture', color: 'text-blue-700' },
    { value: 'commande', icon: '🟠', label: 'Commande', color: 'text-orange-700' },
    { value: 'cdc', icon: '🟣', label: 'Cahier des charges', color: 'text-purple-700' },
  ];

  const getContent = (section: string) => {
    switch (section) {
      // ──── FACTURE ────
      case 'facture':
        return selectedFacture ? (
          <>
            <TemplateMiniCard
              numero={selectedFacture.numero}
              client={selectedFacture.client}
              montant={selectedFacture.montant}
              version={selectedFacture.version}
              date={selectedFacture.date}
              onClick={() => selectedFacture.id && handleOpenDocument(selectedFacture.id, 'facture')}
              onDetach={() => setDetachTarget({ messageId: selectedFacture.id || '', type: 'facture', label: 'Facture', numero: selectedFacture.numero })}
              onDownload={() => selectedFacture.id && handleDownloadPDF(selectedFacture.id, 'facture')}
              validationErrors={factureValidation?.reasons}
              lockedHint={factureLocked ? 'Détachez la commande pour modifier' : undefined}
            />
            {renderValidationBlock(factureValidation)}
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic py-2">
            Utilisez le bouton + pour lier une facture.
          </p>
        );

      // ──── COMMANDE ────
      case 'commande': {
        const cmd = localCommande || chain?.commande;
        if (cmd) {
          return (
            <>
              <TemplateMiniCard
                numero={cmd.numero}
                client={cmd.client}
                montant={cmd.montant}
                version={cmd.version}
                date={cmd.date}
                onClick={() => cmd.id && handleOpenDocument(cmd.id, 'commande')}
                onDetach={() => setDetachTarget({ messageId: cmd.id || '', type: 'commande', label: 'Commande', numero: cmd.numero })}
                onDownload={() => cmd.id && handleDownloadPDF(cmd.id, 'commande')}
                onRegenerate={handleRegenerateCommande}
                validationErrors={commandeValidation?.reasons}
                lockedHint={commandeLocked ? 'Détachez le CDC pour modifier' : undefined}
              />
              {renderValidationBlock(commandeValidation)}
            </>
          );
        }
        if (!selectedFacture) {
          return (
            <p className="text-sm text-muted-foreground italic py-2">
              Liez d'abord une facture.
            </p>
          );
        }
        // Bloquer si la facture n'est pas valide
        if (factureValidation && !factureValidation.valid) {
          return (
            <>
              <p className="text-sm text-muted-foreground italic py-2">
                La facture source est incomplète.
              </p>
              {renderValidationBlock(factureValidation)}
            </>
          );
        }
        return (
          <DeriveButton
            label="Générer la commande"
            onDerive={handleDeriveCommande}
            isLoading={isDerivingCmd}
            isDone={!!deriveCmd.result?.success}
            error={cmdError}
            onReset={() => {
              deriveCmd.reset();
              setLocalCommande(null);
              setCmdError(null);
              clearDerivePending('commande');
            }}
          />
        );
      }

      // ──── CDC ────
      case 'cdc': {
        const cdc = localCDC || chain?.cahierDesCharges;
        if (cdc) {
          const enseigneCount = cdcFullData?.enseignes?.length || cdc.data?.enseignes?.length || 0;
          const equipeCount = cdcFullData?.equipe?.length || cdc.data?.equipe?.length || 0;
          const cdcSubtitle = enseigneCount > 0
            ? `${cdc.client} · ${enseigneCount} enseigne${enseigneCount > 1 ? 's' : ''}${equipeCount > 0 ? ` · ${equipeCount} équipier${equipeCount > 1 ? 's' : ''}` : ''}`
            : cdc.client;
          return (
            <>
              <TemplateMiniCard
                numero={cdc.numero}
                client={cdcSubtitle}
                montant={cdc.montant}
                version={cdc.version}
                date={cdc.date}
                onClick={() => cdc.id && handleOpenDocument(cdc.id, 'cahier_des_charges')}
                onDetach={() => setDetachTarget({ messageId: cdc.id || '', type: 'cdc', label: 'Cahier des charges', numero: cdc.numero })}
                onDownload={() => cdc.id && handleDownloadPDF(cdc.id, 'cahier_des_charges')}
                onRegenerate={handleRegenerateCDC}
                lockedHint={cdcLocked ? 'Projet initialisé — lecture seule' : undefined}
              />
            </>
          );
        }
        if (!selectedFacture) {
          return (
            <p className="text-sm text-muted-foreground italic py-2">
              Liez d'abord une facture.
            </p>
          );
        }
        // Vérifier qu'une commande existe
        const cmdForCDC = localCommande || chain?.commande;
        if (!cmdForCDC) {
          return (
            <p className="text-sm text-muted-foreground italic py-2">
              Générez d'abord la commande.
            </p>
          );
        }
        // Bloquer si la commande n'est pas valide
        if (commandeValidation && !commandeValidation.valid) {
          return (
            <>
              <p className="text-sm text-muted-foreground italic py-2">
                La commande source est incomplète.
              </p>
              {renderValidationBlock(commandeValidation)}
            </>
          );
        }
        return (
          <DeriveButton
            label="Générer le cahier des charges"
            onDerive={handleDeriveCDC}
            isLoading={isDerivingCDC}
            isDone={!!deriveCDC.result?.success}
            error={cdcError}
            onReset={() => {
              deriveCDC.reset();
              setLocalCDC(null);
              setCdcError(null);
              clearDerivePending('cdc');
            }}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      {modalLoading && (
        <div className="fixed inset-0 bg-black/10 z-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
        </div>
      )}
      <TemplateModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        templateType={modalTemplateType}
        data={modalData}
        messageId={modalMessageId}
        forceReadOnly={
          chainDocuments
            ? undefined  // Le slider gère le verrouillage par document
            : (modalTemplateType === 'facture' && factureLocked) ||
              (modalTemplateType === 'commande' && commandeLocked) ||
              (modalTemplateType === 'cahier_des_charges' && cdcLocked)
        }
        chainDocuments={chainDocuments}
        currentChainIndex={chainCurrentIndex}
        onChainNavigate={handleChainNavigate}
      />
      <Accordion type="multiple" defaultValue={['facture']} className="space-y-2">
        {sections.map((s) => (
          <AccordionItem key={s.value} value={s.value} className="border rounded-lg bg-white">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <span className="flex items-center gap-2">
                <span>{s.icon}</span>
                <span className={`font-medium text-sm ${s.color}`}>{s.label}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              {getContent(s.value)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Dialogue de confirmation de détachement */}
      <Dialog open={!!detachTarget} onOpenChange={(open) => !open && setDetachTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {detachTarget?.type === 'facture' ? 'Détacher la facture' : 'Supprimer le document'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm">
              {detachTarget?.type === 'facture' ? (
                <>Vous allez détacher la facture <strong>« {detachTarget?.numero} »</strong> du projet. Le document ne sera pas supprimé.</>
              ) : detachTarget?.type === 'commande' ? (
                <>Vous allez supprimer définitivement la commande <strong>« {detachTarget?.numero} »</strong>. Cette action est irréversible.</>
              ) : (
                <>Vous allez supprimer définitivement le cahier des charges <strong>« {detachTarget?.numero} »</strong>. Cette action est irréversible.</>
              )}
            </p>
            {detachTarget?.type === 'commande' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                ⚠️ La facture source redeviendra modifiable.
              </div>
            )}
            {detachTarget?.type === 'cdc' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                ⚠️ La commande source redeviendra modifiable.
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetachTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={executeDetach} className="gap-2">
              <Trash2 className="h-4 w-4" />
              {detachTarget?.type === 'facture' ? 'Détacher' : 'Supprimer définitivement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
