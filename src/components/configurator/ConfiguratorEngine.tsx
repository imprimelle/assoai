// src/components/configurator/ConfiguratorEngine.tsx
// Orchestrateur — sélectionne le renderer 3D selon la famille géométrique du produit.

import React from "react";
import type { ProductRendererProps, ProductFamily } from "./types";
import { detectFamily } from "./types";
import InfinityRenderer from "./renderers/InfinityRenderer";
import RectPlanRenderer from "./renderers/RectPlanRenderer";
import DiscRenderer from "./renderers/DiscRenderer";

// Mapping famille → composant renderer
const RENDERER_BY_FAMILY: Record<ProductFamily, React.FC<ProductRendererProps>> = {
  A: RectPlanRenderer,
  B: DiscRenderer,
  C: RectPlanRenderer,   // TODO: VolumeRenderer
  D: RectPlanRenderer,   // TODO: NeonRenderer
  E: InfinityRenderer,
  F: RectPlanRenderer,   // TODO: CompositeRenderer (fallback)
};

interface ConfiguratorEngineProps {
  /** Nom du produit (utilisé pour détecter la famille). */
  productName: string;
  /** Description des règles de fabrication (aide à la classification). */
  rulesDescription?: string;
  /** Props passées au renderer sélectionné. */
  rendererProps: ProductRendererProps;
}

/**
 * ConfiguratorEngine — choisit le bon renderer 3D pour un produit donné.
 *
 * Usage :
 * ```tsx
 * <ConfiguratorEngine
 *   productName="Caisson Lumineux rectangle"
 *   rendererProps={{
 *     dimensions: { L: 1.0, H: 0.7 },
 *     options: { ledColor: "#ffffff", showFrame: true },
 *   }}
 * />
 * ```
 */
const ConfiguratorEngine: React.FC<ConfiguratorEngineProps> = ({
  productName,
  rulesDescription,
  rendererProps,
}) => {
  const family = detectFamily(productName, rulesDescription);
  const Renderer = RENDERER_BY_FAMILY[family] || RectPlanRenderer;

  return <Renderer {...rendererProps} />;
};

export default ConfiguratorEngine;
export { detectFamily, RENDERER_BY_FAMILY };
