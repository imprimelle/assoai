
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCFA } from '@/utils/format';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface FinancialMetricCardProps {
  title: string;
  value: string | number;
  percentChange?: string | number;
  isMonetary?: boolean;
  isPercentage?: boolean;
  changeType?: 'positive' | 'negative' | 'neutral';
}

const FinancialMetricCard: React.FC<FinancialMetricCardProps> = ({
  title,
  value,
  percentChange,
  isMonetary = false,
  isPercentage = false,
  changeType = 'neutral'
}) => {
  // Formater la valeur selon son type
  const formattedValue = React.useMemo(() => {
    if (value === null || value === undefined) return '0';
    
    if (isMonetary) {
      return formatCFA(Number(value));
    }
    
    if (isPercentage) {
      // S'assurer que la valeur est un nombre et arrondir à 1 décimale
      const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
      return `${isNaN(numValue) ? 0 : numValue.toFixed(1)}%`;
    }
    
    return value.toString();
  }, [value, isMonetary, isPercentage]);

  return (
    <Card className="shadow-md">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs md:text-sm font-medium">{title}</p>
          
          {percentChange !== undefined && percentChange !== null && (
            <div className={`px-1 md:px-2 py-1 rounded-full text-xs font-medium flex items-center ${
              changeType === 'positive' ? 'bg-green-100 text-green-800' : 
              changeType === 'negative' ? 'bg-red-100 text-red-800' : 
              'bg-gray-100 text-gray-800'
            }`}>
              {changeType === 'positive' ? <TrendingUp className="h-3 w-3 mr-1" /> : 
               changeType === 'negative' ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
              {percentChange}%
            </div>
          )}
        </div>
        
        <p className="text-xl md:text-3xl font-bold mt-2">
          {formattedValue}
        </p>
      </CardContent>
    </Card>
  );
};

export default FinancialMetricCard;
