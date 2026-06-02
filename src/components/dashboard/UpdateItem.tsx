
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { FileText, RefreshCw } from 'lucide-react';
import { getStatusLineState } from '@/utils/status-utils';
import { TemplateType } from '@/types';

interface UpdateItemProps {
  id: string;
  userName: string;
  timestamp: string;
  templateType?: string;
  documentNumber?: string;
  content: string;
  isTemplate: boolean;
  isQuoteCard: boolean;
  isStatusChange?: boolean;
  oldStatus?: string;
  newStatus?: string;
  isMobile: boolean;
  formattedTime: string;
  onDocumentClick: () => void;
}

export const UpdateItem: React.FC<UpdateItemProps> = ({
  userName,
  templateType,
  documentNumber,
  content,
  isTemplate,
  isQuoteCard,
  isStatusChange,
  oldStatus,
  newStatus,
  isMobile,
  formattedTime,
  onDocumentClick,
}) => {
  // Helper function to get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  // Helper function to get template type display name
  const getTemplateTypeName = (type?: string) => {
    if (!type) return '';
    const names: Record<string, string> = {
      facture: 'Facture',
      devis: 'Devis',
      commande: 'Commande',
      cahier_des_charges: 'Cahier des charges'
    };
    return names[type] || type;
  };

  // Helper function to get template badge color
  const getTemplateTypeColor = (type?: string, isQuoteCard: boolean = false): string => {
    if (!type) return 'bg-gray-500 text-white';
    
    // For quote cards, use gray background
    if (isQuoteCard) {
      return 'bg-gray-400 text-black';
    }
    
    switch (type) {
      case 'facture': return 'bg-[#FF6B6B] text-white';
      case 'devis': return 'bg-[#4ECDC4] text-white';
      case 'commande': return 'bg-[#FFD166] text-black';
      case 'cahier_des_charges': return 'bg-[#9B87F5] text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  // Helper function to get status badge color
  const getStatusBadgeColor = (status?: string): string => {
    if (!status) return 'bg-gray-400 text-black';
    
    const statusType = getStatusLineState(status);
    switch (statusType) {
      case 'success': return 'bg-green-500 text-white';
      case 'error': return 'bg-red-500 text-white';
      case 'warning': return 'bg-yellow-500 text-black';
      case 'loading': return 'bg-blue-500 text-white';
      case 'draft': return 'bg-gray-400 text-black';
      default: return 'bg-gray-400 text-black';
    }
  };

  return (
    <div className="flex items-start space-x-4">
      <Avatar>
        <AvatarFallback>{getInitials(userName || '')}</AvatarFallback>
      </Avatar>
      <div className={`flex-1 ${isMobile ? "max-w-[calc(100%-56px)]" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{userName}</span>
          <span className="text-xs text-gray-500">
            {formattedTime}
          </span>
        </div>
        
        {/* Status Change Update */}
        {isStatusChange && (
          <div className="flex flex-wrap items-center mt-1">
            <RefreshCw className="h-3 w-3 mr-1 text-gray-500" />
            <span className="text-sm text-gray-700">
              a changé le statut de {getTemplateTypeName(templateType).toLowerCase()} 
            </span>
            {documentNumber && (
              <Badge 
                className={`ml-2 ${getTemplateTypeColor(templateType)} cursor-pointer hover:shadow-md hover:brightness-110 transition-all`}
                variant="outline"
                onClick={onDocumentClick}
              >
                {documentNumber}
              </Badge>
            )}
            <span className="text-sm text-gray-700 ml-2">
              de
            </span>
            {oldStatus && (
              <Badge 
                className={`ml-2 ${getStatusBadgeColor(oldStatus)}`}
                variant="outline"
              >
                {oldStatus}
              </Badge>
            )}
            <span className="text-sm text-gray-700 ml-2">
              à
            </span>
            {newStatus && (
              <Badge 
                className={`ml-2 ${getStatusBadgeColor(newStatus)}`}
                variant="outline"
              >
                {newStatus}
              </Badge>
            )}
          </div>
        )}
        
        {/* Template or Quote Card Update */}
        {(isTemplate || isQuoteCard) && !isStatusChange && (
          <div className="flex flex-wrap items-center mt-1">
            <FileText className="h-3 w-3 mr-1 text-gray-500" />
            <span className="text-sm text-gray-700">
              a créé {getTemplateTypeName(templateType).toLowerCase()} 
            </span>
            {documentNumber && (
              <Badge 
                className={`ml-2 ${getTemplateTypeColor(templateType, isQuoteCard)} ${templateType ? "cursor-pointer hover:shadow-md hover:brightness-110 transition-all" : ""}`}
                variant="outline"
                onClick={onDocumentClick}
              >
                {documentNumber}
              </Badge>
            )}
          </div>
        )}
        
        {/* Regular Message Update */}
        {!isTemplate && !isQuoteCard && !isStatusChange && (
          <p className="text-sm text-gray-700 mt-1 break-words">
            {content.length > (isMobile ? 60 : 100) 
              ? `${content.substring(0, isMobile ? 60 : 100)}...` 
              : content}
          </p>
        )}
      </div>
    </div>
  );
};
