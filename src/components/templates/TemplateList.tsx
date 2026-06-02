import React, { useEffect, useMemo } from 'react';
import { useLatestTemplates } from '@/hooks/useLatestTemplates';
import TemplatePreview from './TemplatePreview';
import { TemplateType } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type DateRange = { from: Date | undefined; to: Date | undefined };
type SortOrder = 'desc' | 'asc';

interface TemplateListProps {
  templateType: TemplateType;
  searchTerm: string;
  dateRange?: DateRange;
  sortOrder?: SortOrder;
  onSelectTemplate: (templateId: string) => void;
  refreshTrigger?: number;
  userFilter?: string;
}

export function TemplateList({ 
  templateType,
  searchTerm,
  dateRange,
  sortOrder = 'desc',
  onSelectTemplate,
  refreshTrigger = 0,
  userFilter = 'ALL'
}: TemplateListProps) {
  // Use destructuring to get the templates, isLoading, and the refresh function
  const { templates: originalTemplates, isLoading, refetch } = useLatestTemplates(
    templateType, 
    searchTerm, 
    userFilter
  );

  // Trigger a refresh whenever the refreshTrigger prop changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log(`Refreshing template list for ${templateType} (trigger: ${refreshTrigger})`);
      console.log(`Current user filter: ${userFilter}`);
      refetch();
    }
  }, [refreshTrigger, templateType, refetch, userFilter]);

  // Apply date range filter and sorting
  const templates = useMemo(() => {
    console.log(`Applying filters to ${originalTemplates.length} templates`);
    let filteredTemplates = [...originalTemplates];

    // Apply date filter if provided
    if (dateRange?.from || dateRange?.to) {
      filteredTemplates = filteredTemplates.filter(message => {
        const messageDate = new Date(message.timestamp);
        
        if (dateRange.from && dateRange.to) {
          // Set the time of dateRange.to to 23:59:59 to include the entire day
          const endDate = new Date(dateRange.to);
          endDate.setHours(23, 59, 59, 999);
          
          return messageDate >= dateRange.from && messageDate <= endDate;
        } else if (dateRange.from) {
          return messageDate >= dateRange.from;
        } else if (dateRange.to) {
          // Set the time to 23:59:59 to include the entire day
          const endDate = new Date(dateRange.to);
          endDate.setHours(23, 59, 59, 999);
          
          return messageDate <= endDate;
        }
        return true;
      });
    }

    // Apply sorting
    filteredTemplates.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return sortOrder === 'desc' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
    });

    console.log(`After date filtering & sorting, showing ${filteredTemplates.length} templates`);
    return filteredTemplates;
  }, [originalTemplates, dateRange, sortOrder]);

  if (isLoading) {
    return (
      <div className="space-y-4 w-full">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[100px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    const isUserFiltered = userFilter !== 'ALL';
    
    return (
      <div className="p-8 text-center">
        {isUserFiltered ? (
          <Alert variant="warning" className="mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>
              Aucun template associé à cet utilisateur trouvé. Les templates peuvent être associés à différentes sessions utilisateur.
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-muted-foreground">Aucun template trouvé</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {templates.map((message) => (
        <div
          key={message.id}
          className="cursor-pointer transition-all hover:scale-[1.01]"
          onClick={() => onSelectTemplate(message.id)}
        >
          {message.template && (
            <TemplatePreview
              templateType={message.template.templateType}
              data={message.template.data}
              metadata={message.template.metadata}
              onClick={() => onSelectTemplate(message.id)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default TemplateList;
