
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DBMessage } from '@/types/database';
import { dbMessageToUiMessage } from '@/utils/conversion';
import { Message, TemplateType } from '@/types';
import { appLogger } from '@/utils/logger';

/**
 * Hook pour obtenir les dernières versions des templates d'un type spécifique
 * Standardisé pour utiliser exclusivement le format avec wrapper 'data'
 */
export function useLatestTemplates(
  templateType: TemplateType, 
  searchTerm: string = '', 
  userFilter: string = 'ALL'
) {
  const [templates, setTemplates] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  // Fonction pour récupérer les templates qui peut être appelée à la demande
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      appLogger.info(`Fetching ${templateType} templates with search: "${searchTerm}" and session filter: ${userFilter}`);
      
      // Construire la requête pour les messages
      let query = supabase
        .from('messages')
        .select('*')
        .eq('template_type', templateType);
      
      // Appliquer le filtrage session_id si pas ALL
      if (userFilter !== 'ALL') {
        // Log précis de la requête filtrée
        appLogger.info('useLatestTemplates - Requête filtrée par session', {
          userFilter,
          templateType
        });
        query = query.eq('session_id', userFilter);
      }
        
      // Standardisé: toujours utiliser la structure avec wrapper data
      // Syntaxe corrigée pour accéder aux champs JSONB
      const { data: messagesData, error: messagesError } = await query
        .filter('template_data->data->>is_latest', 'eq', 'true')
        .order('timestamp', { ascending: false });

      if (messagesError) {
        appLogger.error('useLatestTemplates - Erreur de requête', {
          error: messagesError,
          templateType,
          userFilter
        });
        throw messagesError;
      }

      appLogger.info(`Fetched ${messagesData?.length || 0} ${templateType} templates with session filter: ${userFilter}`);
      
      // Debug: afficher le premier élément récupéré
      if (messagesData && messagesData.length > 0) {
        const firstTemplate = messagesData[0];
        appLogger.info('useLatestTemplates - Premier message reçu:', {
          id: firstTemplate.id,
          user_id: firstTemplate.user_id,
          session_id: firstTemplate.session_id,
          template_type: firstTemplate.template_type,
          has_data_wrapper: !!(firstTemplate.template_data as any)?.data,
          raw_template_data: JSON.stringify(firstTemplate.template_data).substring(0, 200) + '...',
        });
        
        // Vérifier la structure des données du template
        if (firstTemplate.template_data) {
          if ((firstTemplate.template_data as any)?.data) {
            const data = (firstTemplate.template_data as any).data;
            let idValue = '';
            
            // Extraire l'identifiant selon le type
            switch (templateType) {
              case 'facture':
                idValue = data.factureNumero;
                break;
              case 'commande':
                idValue = data.commandeNumero;
                break;
              case 'devis':
                idValue = data.devisNumero;
                break;
              case 'cahier_des_charges':
                idValue = data.titre;
                break;
            }
            
            appLogger.info('useLatestTemplates - Identifiant extrait', {
              templateType,
              identifierField: idValue ? 'trouvé' : 'manquant',
              idValue
            });
          } else {
            appLogger.warning('useLatestTemplates - Structure sans wrapper data', {
              templateId: firstTemplate.id
            });
          }
        }
      } else {
        appLogger.info('No templates found matching the criteria', {
          templateType,
          userFilter,
          searchTerm
        });
      }
      
      // Convertir les messages DB en messages UI avec conversion standardisée
      const uiMessages = messagesData ? messagesData.map((msg: DBMessage) => dbMessageToUiMessage(msg)) : [];
      
      // Log des messages convertis
      if (uiMessages.length > 0) {
        appLogger.info('useLatestTemplates - Messages convertis', {
          count: uiMessages.length,
          firstMessage: {
            id: uiMessages[0].id,
            hasTemplate: !!uiMessages[0].template,
            templateType: uiMessages[0].template?.templateType
          }
        });
      }
      
      // Filtrer en fonction du terme de recherche s'il est fourni
      const filteredMessages = searchTerm && !searchTerm.includes('@')
        ? uiMessages.filter(msg => {
            if (!msg.template?.data) return false;
            
            const data = msg.template.data;
            const searchTermLower = searchTerm.toLowerCase();
            
            // Créer un objet aplati de champs recherchables
            let searchableFields: Record<string, string> = {};
            
            // Informations client
            if ('client' in data && data.client && typeof data.client === 'object') {
              const client = data.client as Record<string, any>;
              if ('nom' in client) searchableFields.clientNom = (client.nom || '').toString().toLowerCase();
              if ('adresse' in client) searchableFields.clientAdresse = (client.adresse || '').toString().toLowerCase();
              if ('telephone' in client) searchableFields.clientTelephone = (client.telephone || '').toString().toLowerCase();
            }
            
            // Numéros de document
            if ('factureNumero' in data) searchableFields.numero = (data.factureNumero || '').toString().toLowerCase();
            if ('devisNumero' in data) searchableFields.numero = (data.devisNumero || '').toString().toLowerCase();
            if ('commandeNumero' in data) searchableFields.numero = (data.commandeNumero || '').toString().toLowerCase();
            if ('titre' in data) searchableFields.titre = (data.titre || '').toString().toLowerCase();
            
            // Dates
            if ('dateEmission' in data) searchableFields.dateEmission = (data.dateEmission || '').toString().toLowerCase();
            if ('dateCommande' in data) searchableFields.dateCommande = (data.dateCommande || '').toString().toLowerCase();
            if ('dateLivraison' in data) searchableFields.dateLivraison = (data.dateLivraison || '').toString().toLowerCase();
            
            // Statut
            if ('statut' in data) searchableFields.statut = (data.statut || '').toString().toLowerCase();
            
            // Recherche dans les champs aplatis
            return Object.values(searchableFields).some(value => 
              value.includes(searchTermLower)
            );
          })
        : uiMessages;
        
      appLogger.info(`After filtering, showing ${filteredMessages.length} templates`);
      
      // Si le nombre de templates a beaucoup diminué avec le filtre, loguer l'impact
      if (uiMessages.length > 0 && filteredMessages.length < uiMessages.length * 0.5) {
        appLogger.info('useLatestTemplates - Filtrage avec impact significatif', {
          beforeFilter: uiMessages.length,
          afterFilter: filteredMessages.length,
          searchTerm
        });
      }
      
      setTemplates(filteredMessages);
      setError(null);
    } catch (err) {
      console.error("Error in useLatestTemplates:", err);
      appLogger.error('useLatestTemplates - Exception', { error: err });
      setError(err as Error);
      toast({
        title: "Erreur de chargement des templates",
        description: (err as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [templateType, searchTerm, userFilter, toast]);

  // Récupération initiale et lorsque les dépendances changent
  useEffect(() => {
    appLogger.info('useLatestTemplates - Initialisation', {
      templateType,
      searchTerm,
      userFilter
    });
    fetchTemplates();
  }, [fetchTemplates]);

  return { 
    templates, 
    isLoading, 
    error,
    refetch: fetchTemplates
  };
}
