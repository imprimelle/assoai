
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { TemplateType } from '@/types';
import { getTemplateIcon, getTemplateDisplayName } from '@/utils/template-hierarchy';

interface TemplateNodeData {
  id: string;
  label: string;
  templateType: TemplateType;
  identifier: string;
  onClick: () => void;
}

interface TemplateNodeProps {
  data: TemplateNodeData;
  selected: boolean;
}

const TemplateNode: React.FC<TemplateNodeProps> = ({ data, selected }) => {
  const IconComponent = getTemplateIcon(data.templateType);
  const backgroundColor = getTemplateBackgroundColor(data.templateType);
  
  return (
    <div 
      className={`p-3 rounded-lg shadow-md cursor-pointer transition-all ${selected ? 'ring-2 ring-brand-orange' : ''}`} 
      style={{ background: backgroundColor, minWidth: '180px', minHeight: '90px' }}
      onClick={data.onClick}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', background: '#fff' }}
      />
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center mb-2 text-white">
          <IconComponent size={24} className="mr-2" />
          <span className="font-medium text-sm">{getTemplateDisplayName(data.templateType)}</span>
        </div>
        <div className="text-xs text-white font-bold">{data.identifier}</div>
        <div className="text-xs text-white mt-1 opacity-80">{data.label}</div>
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', background: '#fff' }}
      />
    </div>
  );
};

// Helper function to get background color based on template type
const getTemplateBackgroundColor = (templateType: TemplateType): string => {
  switch (templateType) {
    case 'facture':
      return '#4CAF50'; // green
    case 'devis':
      return '#2196F3'; // blue
    case 'commande':
      return '#FF9800'; // orange
    case 'cahier_des_charges':
      return '#9C27B0'; // purple
    case 'brief':
      return '#795548'; // brown
    case 'contact':
      return '#607D8B'; // blue-grey
    default:
      return '#607D8B'; // default blue-grey
  }
};

export default TemplateNode;
