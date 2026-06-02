
import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
  ConnectionLineType,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TemplateType } from '@/types';
import { Project } from '@/types/project';
import TemplateNode from './TemplateNode';
import RelationEdge from './RelationEdge';
import './workflow.css';
import { appLogger } from '@/utils/logger';

// Define node types
const nodeTypes = {
  template: TemplateNode,
};

// Define edge types
const edgeTypes = {
  relation: RelationEdge,
};

// Define layout direction constants
const HORIZONTAL_SPACING = 300;
const VERTICAL_SPACING = 150;

interface ProjectWorkflowProps {
  project: Project;
  factures: any[];
  commandes: any[];
  devis: any[];
  cahiersDesCharges: any[];
  isLoading: boolean;
  handleOpenTemplate: (template: any) => void;
}

const ProjectWorkflow: React.FC<ProjectWorkflowProps> = ({
  project,
  factures,
  commandes,
  devis,
  cahiersDesCharges,
  isLoading,
  handleOpenTemplate
}) => {
  // Initialize nodes and edges states
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [templates, setTemplates] = useState<any[]>([]);

  // Create a flattened array of all templates
  useEffect(() => {
    if (isLoading) return;
    const allTemplates = [...factures, ...commandes, ...devis, ...cahiersDesCharges];
    setTemplates(allTemplates);
  }, [factures, commandes, devis, cahiersDesCharges, isLoading]);

  // Create nodes and edges based on templates
  useEffect(() => {
    if (templates.length === 0) return;

    // Create template maps by type and ID for quick lookup
    const templateMaps = {
      facture: factures.reduce((map, t) => {
        const id = t.template_data?.data?.factureNumero;
        if (id) map[id] = t;
        return map;
      }, {} as Record<string, any>),
      
      commande: commandes.reduce((map, t) => {
        const id = t.template_data?.data?.commandeNumero;
        if (id) map[id] = t;
        return map;
      }, {} as Record<string, any>),
      
      devis: devis.reduce((map, t) => {
        const id = t.template_data?.data?.devisNumero;
        if (id) map[id] = t;
        return map;
      }, {} as Record<string, any>),
      
      cahier_des_charges: cahiersDesCharges.reduce((map, t) => {
        const id = t.template_data?.data?.titre;
        if (id) map[id] = t;
        return map;
      }, {} as Record<string, any>)
    };

    // Create nodes array
    const newNodes: Node[] = [];
    let nodeId = 1;
    
    // Calculate columns for each template type
    const columns = {
      facture: { x: 0, y: 0, count: 0 },
      commande: { x: HORIZONTAL_SPACING, y: 0, count: 0 },
      cahier_des_charges: { x: HORIZONTAL_SPACING * 2, y: 0, count: 0 },
      devis: { x: HORIZONTAL_SPACING * 3, y: 0, count: 0 }
    };

    // Helper to get node position
    const getNodePosition = (type: keyof typeof columns) => {
      const column = columns[type];
      const position = { x: column.x, y: column.y + (column.count * VERTICAL_SPACING) };
      column.count++;
      return position;
    };

    // Create nodes for each template type
    factures.forEach(template => {
      if (template.template_data?.data) {
        const data = template.template_data.data;
        newNodes.push({
          id: `node-${nodeId++}`,
          type: 'template',
          position: getNodePosition('facture'),
          data: {
            id: template.id,
            label: data.client?.nom || 'Client non spécifié',
            templateType: 'facture' as TemplateType,
            identifier: data.factureNumero,
            onClick: () => handleOpenTemplate(template)
          }
        });
      }
    });

    commandes.forEach(template => {
      if (template.template_data?.data) {
        const data = template.template_data.data;
        newNodes.push({
          id: `node-${nodeId++}`,
          type: 'template',
          position: getNodePosition('commande'),
          data: {
            id: template.id,
            label: data.client?.nom || 'Client non spécifié',
            templateType: 'commande' as TemplateType,
            identifier: data.commandeNumero,
            onClick: () => handleOpenTemplate(template)
          }
        });
      }
    });

    cahiersDesCharges.forEach(template => {
      if (template.template_data?.data) {
        const data = template.template_data.data;
        newNodes.push({
          id: `node-${nodeId++}`,
          type: 'template',
          position: getNodePosition('cahier_des_charges'),
          data: {
            id: template.id,
            label: data.titre,
            templateType: 'cahier_des_charges' as TemplateType,
            identifier: data.titre,
            onClick: () => handleOpenTemplate(template)
          }
        });
      }
    });

    devis.forEach(template => {
      if (template.template_data?.data) {
        const data = template.template_data.data;
        newNodes.push({
          id: `node-${nodeId++}`,
          type: 'template',
          position: getNodePosition('devis'),
          data: {
            id: template.id,
            label: data.client?.nom || 'Client non spécifié',
            templateType: 'devis' as TemplateType,
            identifier: data.devisNumero,
            onClick: () => handleOpenTemplate(template)
          }
        });
      }
    });

    // Create edges for related templates
    const newEdges: Edge[] = [];
    let edgeId = 1;

    // Helper function to find node ID by template identifier and type
    const findNodeId = (identifier: string, type: TemplateType) => {
      return newNodes.find(
        node => node.data.templateType === type && node.data.identifier === identifier
      )?.id;
    };

    // Connect factures to commandes based on linked_facture_id
    commandes.forEach(commande => {
      if (commande.template_data?.data?.linked_facture_id) {
        const factureId = commande.template_data.data.linked_facture_id;
        const factureNode = newNodes.find(
          node => node.data.templateType === 'facture' && node.data.identifier === factureId
        );
        const commandeNode = newNodes.find(
          node => node.data.templateType === 'commande' && node.data.identifier === commande.template_data.data.commandeNumero
        );
        
        if (factureNode && commandeNode) {
          newEdges.push({
            id: `edge-${edgeId++}`,
            source: factureNode.id,
            target: commandeNode.id,
            type: 'relation',
            label: 'Commande associée',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
            },
            style: { stroke: '#FF9800' }
          });
        }
      }
    });

    // Improved connection between commandes and cahier_des_charges
    // This will try to create connections even when the relationship isn't perfect
    cahiersDesCharges.forEach(cahier => {
      // Check if cahier has a commande_id that matches any commande in the list
      if (cahier.template_data?.data?.commande_id) {
        const commandeId = cahier.template_data.data.commande_id;
        // Log debug information
        appLogger.info('ProjectWorkflow - Cherche connexion commande et cahier', {
          cahierId: cahier.id,
          cahierTitre: cahier.template_data.data.titre,
          commandeId: commandeId
        });
        
        // Find matching commande node - try different formats
        let commandeNode = newNodes.find(
          node => node.data.templateType === 'commande' && node.data.identifier === commandeId
        );
        
        // If not found, try to find any commande with a matching number pattern
        if (!commandeNode) {
          for (const node of newNodes) {
            if (node.data.templateType === 'commande') {
              // Fix the TypeScript error by ensuring the identifier is a string before using includes
              const nodeIdentifier = node.data.identifier;
              const cmdId = String(commandeId || '');
              
              // Try to match with more flexible patterns, ensuring we work with strings
              if (
                (typeof nodeIdentifier === 'string' && nodeIdentifier.includes(cmdId)) || 
                (cmdId && typeof nodeIdentifier === 'string' && cmdId.includes(nodeIdentifier))
              ) {
                commandeNode = node;
                appLogger.info('ProjectWorkflow - Connexion approximative trouvée', {
                  nodeIdentifier,
                  requestedCommandeId: commandeId
                });
                break;
              }
            }
          }
        }
        
        const cahierNode = newNodes.find(
          node => node.data.templateType === 'cahier_des_charges' && 
                 node.data.identifier === cahier.template_data.data.titre
        );
        
        if (commandeNode && cahierNode) {
          appLogger.info('ProjectWorkflow - Création de connexion entre commande et cahier', {
            commandeNode: commandeNode.id,
            cahierNode: cahierNode.id
          });
          
          newEdges.push({
            id: `edge-${edgeId++}`,
            source: commandeNode.id,
            target: cahierNode.id,
            type: 'relation',
            label: 'Cahier des charges',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
            },
            style: { stroke: '#9C27B0' }
          });
        } else {
          appLogger.warning('ProjectWorkflow - Impossible de créer la connexion', {
            hasCommandeNode: !!commandeNode,
            hasChahierNode: !!cahierNode,
            commandeId: commandeId,
            cahierId: cahier.id
          });
        }
      }
    });
    
    setNodes(newNodes);
    setEdges(newEdges);
    
  }, [templates, handleOpenTemplate]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges(eds => addEdge({
      ...connection, 
      type: 'relation',
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
    }, eds)),
    [setEdges]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <p className="text-muted-foreground mb-4">Ce projet ne contient encore aucun document</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '650px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitView
        proOptions={{ hideAttribution: true }}
        connectionLineType={ConnectionLineType.Bezier}
      >
        <Controls position="bottom-right" />
        <MiniMap 
          nodeColor={(node) => {
            const type = node.data?.templateType as TemplateType | undefined;
            return getTemplateBackgroundColor(type || 'facture');
          }}
          maskColor="rgba(240, 240, 240, 0.6)"
          style={{ height: 120 }}
        />
        <Background gap={12} size={1} />
        <Panel position="top-right" className="bg-white p-2 rounded-md shadow-md">
          <div className="text-xs">
            <div className="flex items-center mb-1">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span>Facture</span>
            </div>
            <div className="flex items-center mb-1">
              <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
              <span>Commande</span>
            </div>
            <div className="flex items-center mb-1">
              <div className="w-3 h-3 rounded-full bg-purple-600 mr-2"></div>
              <span>Cahier des charges</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
              <span>Devis</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
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

export default ProjectWorkflow;
