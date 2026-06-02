
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type GenerationStatus = 'idle' | 'generating' | 'success' | 'error' | 'retrying';

interface TemplateGenerationCardProps {
  sourceType: string;
  targetType: string;
  status: GenerationStatus;
  progress?: number;
  attempt?: number;
  maxAttempts?: number;
  error?: string;
  onGenerate: () => void;
  onRetry?: () => void;
  className?: string;
}

const TemplateGenerationCard: React.FC<TemplateGenerationCardProps> = ({
  sourceType,
  targetType,
  status,
  progress = 0,
  attempt = 0,
  maxAttempts = 3,
  error,
  onGenerate,
  onRetry,
  className
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'generating':
      case 'retrying':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'generating':
        return 'Génération en cours...';
      case 'retrying':
        return `Nouvelle tentative (${attempt}/${maxAttempts})...`;
      case 'success':
        return 'Généré avec succès';
      case 'error':
        return 'Erreur de génération';
      default:
        return 'Prêt à générer';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'generating':
      case 'retrying':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ');
  };

  return (
    <Card className={cn('transition-all duration-200', getStatusColor(), className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <CardTitle className="text-sm font-medium">
              {capitalizeFirst(sourceType)} → {capitalizeFirst(targetType)}
            </CardTitle>
          </div>
          {status === 'retrying' && (
            <span className="text-xs text-muted-foreground">
              {attempt}/{maxAttempts}
            </span>
          )}
        </div>
        <CardDescription className="text-xs">
          {getStatusText()}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0">
        {(status === 'generating' || status === 'retrying') && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Traitement en cours...
            </p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="space-y-3">
            {error && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </p>
            )}
            <div className="flex space-x-2">
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="flex-1"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Réessayer
                </Button>
              )}
              <Button
                size="sm"
                onClick={onGenerate}
                className="flex-1"
              >
                Générer
              </Button>
            </div>
          </div>
        )}
        
        {status === 'idle' && (
          <Button
            size="sm"
            onClick={onGenerate}
            className="w-full"
          >
            Générer {capitalizeFirst(targetType)}
          </Button>
        )}
        
        {status === 'success' && (
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-xs">Template disponible dans le projet</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TemplateGenerationCard;
