import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronLeft, DollarSign, ShoppingCart, FileText, Wrench } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TemplateList from '@/components/templates/TemplateList';
import TemplateModal from '@/components/templates/TemplateModal';
import { TemplateType, Message, TemplateData } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDebounce } from '@/hooks/use-debounce';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/SearchInput';
import { UserFilter } from '@/components/UserFilter';
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel';
import UserSuggestions from '@/components/UserSuggestions';
import { saveTemplateAndSync } from '@/services/templateSaveWithVersioning';
import { appLogger } from "@/utils/logger";
import { CurrentUser } from "@/types/user";

type DateRange = { from: Date | undefined; to: Date | undefined };
type SortOrder = 'desc' | 'asc';

// statuts valides par type de template
const STATUS_SUGGESTIONS_BY_TEMPLATE: Record<TemplateType, string[]> = {
  facture:           ["Brouillon", "vérification", "Vérifié", "validé", "Payé"],
  devis:             ["Brouillon", "En attente", "Accepté", "Refusé", "Expiré"],
  commande:          ["Brouillon", "En cours", "Expédiée", "Livrée", "Terminée"],
  cahier_des_charges:["Brouillon", "infographie", "demande", "Payé", "Livré"],
  contact:          ["Brouillon", "enregistré"],
  brief:          ["Brouillon", "verification", "vérifié", "refusé", "Terminée"]
};

const CrmTemplates: React.FC = () => {
  
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [userTags, setUserTags] = useState<{ id: string; name: string }[]>([]);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedTab, setSelectedTab] = useState<TemplateType>('facture');
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  const [userLoaded, setUserLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    id: "",
    role: undefined,
    session_id: undefined,
  });

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');
  const [selectedFilterValue, setSelectedFilterValue] = useState<string>('ALL');
  
  // Modification ici: nous allons calculer la visibilité des suggestions en fonction du rôle
  const [showStatusSuggestions, setShowStatusSuggestions] = useState(true);
  const [templateCounts, setTemplateCounts] = useState<Record<string, number>>({
    facture: 0,
    devis: 0,
    commande: 0,
    cahier_des_charges: 0
  });
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modification: nous allons conditionner la mise à jour de l'état showStatusSuggestions
  // en fonction du rôle de l'utilisateur
  useEffect(() => {
    // Si l'utilisateur est un agent, on masque les suggestions
    // sinon, on les affiche normalement
    if (currentUser.role === "agent") {
      setShowStatusSuggestions(false);
    } else {
      setShowStatusSuggestions(true);
    }
  }, [searchTerm, currentUser.role]);

  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowUserSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchContainerRef]);

  const getUserIdsFromTags = useCallback(() => {
    if (userTags.length === 0) {
      return currentUser.role === 'super-agent' ? 'ALL' : currentUser.id;
    }
    return userTags[0]?.id || 'ALL';
  }, [userTags, currentUser]);

  useEffect(() => {
    const userId = getUserIdsFromTags();
    setSelectedUserId(userId);
    if (userId === 'ALL') {
      setSelectedSessionId('ALL');
      setSelectedFilterValue('ALL');
    }
  }, [userTags, getUserIdsFromTags]);

  useEffect(() => {
    const fetchAppUser = async () => {
      appLogger.info("🔄 fetchAppUser - lecture du session_id en localStorage");
      const storedSessionId = localStorage.getItem("persistentSessionId");
      appLogger.info("🔑 session_id trouvé en localStorage", { session_id: storedSessionId });

      if (!storedSessionId) {
        appLogger.error("❌ pas de session_id en localStorage, filtre ALL");
        setSelectedSessionId("ALL");
        setSelectedUserId("ALL");
        setSelectedFilterValue("ALL");
        setRefreshTrigger(t => t + 1);
        setUserLoaded(true);
        return;
      }

      const { data: userData, error } = await supabase
        .from("app_users")
        .select("id, role, session_id")
        .eq("session_id", storedSessionId)
        .single();
      
      if (error || !userData) {
        appLogger.error("❌ aucun app_users trouvé pour ce session_id", { error });
        setSelectedSessionId("ALL");
        setSelectedUserId("ALL");
        setSelectedFilterValue("ALL");
      } else {
        appLogger.info("✅ app_users récupéré via session_id", {
          id: userData.id,
          role: userData.role,
        });

        setCurrentUser({
          id: userData.id,
          role: userData.role as "agent" | "super-agent",
          session_id: userData.session_id ? userData.session_id.trim() : undefined,
        });
      
        if (userData.role === "super-agent") {
          appLogger.info("🛡️ super-agent → ALL");
          setSelectedSessionId("ALL");
          setSelectedUserId("ALL");
          setSelectedFilterValue("ALL");
        } else {
          appLogger.info("👤 agent → session only", { session_id: userData.session_id });
          setSelectedSessionId(userData.session_id);
          setSelectedUserId("ALL");
          setSelectedFilterValue(userData.session_id);
        }
      }

      setRefreshTrigger(t => t + 1);
      setUserLoaded(true);
      appLogger.info("🔄 fetchAppUser - terminé");
    };

    fetchAppUser();
  }, []);

  useEffect(() => {
    const searchInput = document.getElementById('template-search');
    if (searchInput) {
      searchInput.focus();
    }
  }, []);

  useEffect(() => {
    const fetchTemplateCounts = async () => {
      try {
        const templateTypes: TemplateType[] = ['facture', 'devis', 'commande', 'cahier_des_charges'];
        const counts: Record<string, number> = {
          facture: 0,
          devis: 0,
          commande: 0,
          cahier_des_charges: 0
        };

        for (const type of templateTypes) {
          let query = supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('template_type', type)
            .or('template_data->data->is_latest.eq.true,template_data->is_latest.eq.true');
            
          if (selectedSessionId !== 'ALL') {
            query = query.or(`session_id.eq.${selectedSessionId},user_id.eq.${selectedUserId}`);
          }

          const { count, error } = await query;

          if (error) {
            console.error(`Error fetching count for ${type}:`, error);
            continue;
          }

          counts[type] = count || 0;
        }

        setTemplateCounts(counts);
      } catch (err) {
        console.error("Error fetching template counts:", err);
      }
    };

    if (currentUser.id || selectedSessionId === 'ALL') {
      fetchTemplateCounts();
    }
  }, [currentUser, selectedSessionId, selectedUserId]);

  const handleSearchChange = (value: string) => {
    if (value.includes('@') && currentUser.role !== "agent") {
      setShowUserSuggestions(true);
    } 
    setSearchTerm(value);
  };

  const handleSelectUser = async (user: { id: string; name: string }) => {
    if (user.id === 'ALL') {
      setUserTags([]);
      setSelectedUserId('ALL');
      setSelectedSessionId('ALL');
      setSelectedFilterValue('ALL');
    } else {
      setUserTags([user]);
      setSelectedUserId(user.id);
      setSelectedFilterValue(user.id);
      
      const { data } = await supabase
        .from('app_users')
        .select('session_id')
        .eq('id', user.id)
        .single();
        
      if (data?.session_id) {
        setSelectedSessionId(data.session_id.trim());
      } else {
        setSelectedSessionId(user.id.trim());
      }
    }
    
    setSearchTerm('');
    setShowUserSuggestions(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleUserTagsChange = async (tags: { id: string; name: string }[]) => {
    appLogger.info("🔄 handleUserTagsChange", { tags });
    setUserTags(tags);

    if (tags.length === 0) {
      setSelectedUserId("ALL");
      if (currentUser.role === "super-agent") {
        appLogger.info("🛡️ Super-agent vide les tags → filtre ALL");
        setSelectedSessionId("ALL");
        setSelectedFilterValue("ALL");
      } else {
        const sid = currentUser.session_id!;
        appLogger.info("👤 Agent vide les tags → retour à sa session", { session_id: sid });
        setSelectedSessionId(sid);
        setSelectedFilterValue(sid);
      }
    } else {
      const userId = tags[0].id;
      appLogger.info("🔵 Tag choisi → filtrage sur cet utilisateur", { userId });
      setSelectedUserId(userId);
      setSelectedFilterValue(userId);

      const { data, error } = await supabase
        .from("app_users")
        .select("session_id")
        .eq("id", userId)
        .single();

      if (error || !data?.session_id) {
        appLogger.warning("⚠️ Pas de session_id pour user taggé, fallback sur userId", { userId, error });
        setSelectedSessionId(userId);
      } else {
        const sid = data.session_id.trim();
        appLogger.info("✅ session_id du user taggé", { sid });
        setSelectedSessionId(sid);
      }
    }

    setRefreshTrigger((t) => t + 1);
  };

  const handleSelectTemplate = async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) {
        throw error;
      }

      if (data && data.template_type) {
        const attachmentsArray = Array.isArray(data.attachments) 
          ? data.attachments.map(item => String(item))  
          : [];

        let templateData = data.template_data;

        if (typeof templateData === 'string') {
          try {
            templateData = JSON.parse(templateData);
          } catch (e) {
            templateData = {};
          }
        }
        
        if (templateData && typeof templateData === 'object' && 'data' in templateData) {
          templateData = templateData.data;
        }
        
        let clientData = { nom: "Client", adresse: "" };
        
        if (['facture', 'devis', 'commande'].includes(data.template_type)) {
          if (templateData && typeof templateData === 'object' && !Array.isArray(templateData)) {
            const templateObj = templateData as Record<string, any>;
            
            if (templateObj.client && 
                typeof templateObj.client === 'object' && 
                !Array.isArray(templateObj.client)) {
              
              const clientObj = templateObj.client as Record<string, any>;
              clientData = {
                nom: String(clientObj.nom || "Client"),
                adresse: String(clientObj.adresse || "")
              };
            }
            
            templateObj.client = clientData;
            templateData = templateObj;
          } else {
            templateData = {
              client: clientData
            };
          }
        }
        
        setSelectedMessage({
          id: data.id,
          sessionId: data.session_id,
          userId: data.user_id,
          content: data.content || '',
          timestamp: data.timestamp,
          type: 'text',
          attachments: attachmentsArray,
          isUser: data.sender === 'user',
          template: {
            templateType: data.template_type as TemplateType,
            data: templateData as any,
            metadata: {
              displayName: data.template_type === 'facture' ? 'Facture' :
                          data.template_type === 'devis' ? 'Devis' :
                          data.template_type === 'commande' ? 'Commande' :
                          data.template_type === 'cahier_des_charges' ? 'Cahier des charges' : 'Document',
              description: '',
              availableActions: ['save', 'edit', 'pdf'],
              mode: 'editable',
              source: 'library'
            }
          }
        });
        setSelectedTemplateId(templateId);
        setIsModalOpen(true);
      } else {
        toast({
          title: "Erreur",
          description: "Template introuvable ou données incomplètes",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error fetching template:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le template",
        variant: "destructive"
      });
    }
  };

  const formatDateRange = () => {
    if (!dateRange.from) return "Sélectionner une période";
    
    const fromFormatted = format(dateRange.from, 'dd/MM/yyyy');
    
    if (!dateRange.to) return `À partir du ${fromFormatted}`;
    
    const toFormatted = format(dateRange.to, 'dd/MM/yyyy');
    return `${fromFormatted} - ${toFormatted}`;
  };

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTemplateId(null);
    setSelectedMessage(null);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleUserFilterChange = (sessionId: string, userId: string) => {
    console.log(`User filter changed to: sessionId=${sessionId}, userId=${userId}`);
    
    setSelectedSessionId(sessionId);
    setSelectedUserId(userId);
    setSelectedFilterValue(userId);
    
    if (userId === 'ALL') {
      setUserTags([]);
    } else {
      supabase
        .from('app_users')
        .select('id, name')
        .eq('id', userId)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserTags([{
              id: data.id,
              name: data.name || data.id.substring(0, 8)
            }]);
          }
        });
    }
    
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSaveTemplate = async (templateData: TemplateData) => {
    if (!selectedMessage || !selectedMessage.template || !selectedTemplateId) {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le template : données manquantes",
        variant: "destructive"
      });
      return;
    }

    try {
      const updatedMessage: Message = {
        ...selectedMessage,
        template: {
          ...selectedMessage.template,
          data: templateData
        }
      };

      const jsonData = {
        data: templateData,
        ...(selectedMessage.template.metadata && { 
          metadata: selectedMessage.template.metadata 
        })
      };

      const { error } = await supabase
        .from('messages')
        .update({ template_data: JSON.parse(JSON.stringify(jsonData)) })
        .eq('id', selectedTemplateId);

      if (error) {
        throw error;
      }

      await saveTemplateAndSync(updatedMessage, selectedMessage.userId || 'unknown');

      toast({
        title: "Succès",
        description: "Template enregistré avec succès",
      });

      handleModalClose();
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement",
        variant: "destructive"
      });
    }
  };
  
  if (!userLoaded || selectedSessionId === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>Chargement des templates…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="flex items-center mb-6 gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center"
          onClick={() => navigate('/')}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold">Bibliothèque de templates</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1 rounded-lg" ref={searchContainerRef}>
          <SearchInput
            id="template-search"
            placeholder="Rechercher un numéro ou un client... (@ pour filtrer par utilisateur)"
            className="w-full"
            value={searchTerm}
            userTags={userTags}
            onChange={handleSearchChange}
            onUserTagsChange={handleUserTagsChange}
            isSuperAgent={currentUser.role === 'super-agent'}
            showUserSuggestions={currentUser.role !== 'agent'} // Only show user suggestions for non-agents
          />
          
          {searchTerm && showStatusSuggestions && !showUserSuggestions && currentUser.role !== "agent" && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow">
              {(STATUS_SUGGESTIONS_BY_TEMPLATE[selectedTab] || [])
                .filter(s =>
                  s.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map(s => (
                  <div
                    key={s}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      setSearchTerm(s);
                      setRefreshTrigger(t => t + 1);
                      setShowStatusSuggestions(false);
                    }}
                  >
                    {s}
                  </div>
                ))
              }
            </div>
          )}

          {showUserSuggestions && currentUser.role !== 'agent' && (
            <div className="absolute z-10 mt-1 w-full">
              <UserSuggestions
                searchTerm={searchTerm}
                onSelectUser={handleSelectUser}
                onClose={() => setShowUserSuggestions(false)}
              />
            </div>
          )}
        </div>
        
        {currentUser.id && (currentUser.role === 'super-agent') && userTags.length === 0 && (
          <div className="w-full md:w-auto">
            <UserFilter 
              currentUser={currentUser} 
              onSelect={handleUserFilterChange}
              selectedValue={selectedFilterValue}
            />
          </div>
        )}
      </div>

      
      <Tabs 
        value={selectedTab} 
        onValueChange={(value) => setSelectedTab(value as TemplateType)}
        className="w-full"
      >
        <div className="relative mb-6">
          <TabsList className="w-full p-0 bg-transparent">
            <Carousel className="w-full">
              <CarouselContent className="-ml-1">
                <CarouselItem className="pl-1 basis-1/4">
                  <TabsTrigger 
                    value="facture" 
                    className="w-full transition-all duration-200 h-12 flex items-center justify-center gap-2"
                  >
                    <DollarSign className={`h-5 w-5 ${selectedTab === 'facture' ? 'text-[#F97316]' : ''}`} />
                    <Badge variant="secondary" className="bg-gray-200 text-gray-800 ml-1">{templateCounts.facture}</Badge>
                  </TabsTrigger>
                </CarouselItem>
                <CarouselItem className="pl-1 basis-1/4">
                  <TabsTrigger 
                    value="commande" 
                    className="w-full transition-all duration-200 h-12 flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className={`h-5 w-5 ${selectedTab === 'commande' ? 'text-[#F97316]' : ''}`} />
                    <Badge variant="secondary" className="bg-gray-200 text-gray-800 ml-1">{templateCounts.commande}</Badge>
                  </TabsTrigger>
                </CarouselItem>
                <CarouselItem className="pl-1 basis-1/4">
                  <TabsTrigger 
                    value="devis" 
                    className="w-full transition-all duration-200 h-12 flex items-center justify-center gap-2"
                  >
                    <FileText className={`h-5 w-5 ${selectedTab === 'devis' ? 'text-[#F97316]' : ''}`} />
                    <Badge variant="secondary" className="bg-gray-200 text-gray-800 ml-1">{templateCounts.devis}</Badge>
                  </TabsTrigger>
                </CarouselItem>
                <CarouselItem className="pl-1 basis-1/4">
                  <TabsTrigger 
                    value="cahier_des_charges" 
                    className="w-full transition-all duration-200 h-12 flex items-center justify-center gap-2"
                  >
                    <Wrench className={`h-5 w-5 ${selectedTab === 'cahier_des_charges' ? 'text-[#F97316]' : ''}`} />
                    <Badge variant="secondary" className="bg-gray-200 text-gray-800 ml-1">{templateCounts.cahier_des_charges}</Badge>
                  </TabsTrigger>
                </CarouselItem>
              </CarouselContent>
              <CarouselPrevious className="-left-6" />
              <CarouselNext className="-right-6" />
            </Carousel>
          </TabsList>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full md:w-auto justify-start text-left font-normal",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <div className="flex items-center">
                  {formatDateRange()}
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange as any}
                onSelect={(range) => setDateRange(range as DateRange)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={fr}
              />
              <div className="p-3 border-t border-border">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setDateRange({ from: undefined, to: undefined })}
                >
                  Effacer
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          <Select
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as SortOrder)}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Plus récents</SelectItem>
              <SelectItem value="asc">Plus anciens</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="transition-all duration-300">
          <TabsContent value="facture" className="mt-0">
            <TemplateList 
              templateType="facture" 
              searchTerm={debouncedSearchTerm}
              dateRange={dateRange}
              sortOrder={sortOrder}
              onSelectTemplate={handleSelectTemplate}
              refreshTrigger={refreshTrigger}
              userFilter={selectedSessionId!}
            />
          </TabsContent>
          <TabsContent value="commande" className="mt-0">
            <TemplateList 
              templateType="commande" 
              searchTerm={debouncedSearchTerm}
              dateRange={dateRange}
              sortOrder={sortOrder}
              onSelectTemplate={handleSelectTemplate}
              refreshTrigger={refreshTrigger}
              userFilter={selectedSessionId!}
            />
          </TabsContent>
          <TabsContent value="devis" className="mt-0">
            <TemplateList 
              templateType="devis" 
              searchTerm={debouncedSearchTerm}
              dateRange={dateRange}
              sortOrder={sortOrder}
              onSelectTemplate={handleSelectTemplate}
              refreshTrigger={refreshTrigger}
              userFilter={selectedSessionId!}
            />
          </TabsContent>
          <TabsContent value="cahier_des_charges" className="mt-0">
            <TemplateList 
              templateType="cahier_des_charges" 
              searchTerm={debouncedSearchTerm}
              dateRange={dateRange}
              sortOrder={sortOrder}
              onSelectTemplate={handleSelectTemplate}
              refreshTrigger={refreshTrigger}
              userFilter={selectedSessionId!}
            />
          </TabsContent>
        </div>
      </Tabs>

      {selectedMessage && selectedMessage.template && (
        <TemplateModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          templateType={selectedMessage.template.templateType}
          data={selectedMessage.template.data}
          metadata={selectedMessage.template.metadata}
          messageId={selectedTemplateId || undefined}
          onSave={handleSaveTemplate}
        />
      )}
    </div>
  );
};

export default CrmTemplates;
