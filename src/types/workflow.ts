
import { Node, Edge } from '@xyflow/react';
import { TemplateType } from './template';

export interface WorkflowTemplateNode extends Node {
  data: {
    id: string;
    label: string;
    templateType: TemplateType;
    identifier: string;
    onClick: () => void;
  };
  type: 'template';
}

export interface WorkflowRelationEdge extends Edge {
  type: 'relation';
  data?: {
    relationship: string;
  };
}

export interface WorkflowData {
  nodes: WorkflowTemplateNode[];
  edges: WorkflowRelationEdge[];
}
