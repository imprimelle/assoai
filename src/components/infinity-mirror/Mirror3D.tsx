// src/components/infinity-mirror/Mirror3D.tsx
// Wrapper rétrocompatible — délègue à InfinityRenderer.
// Conserve les exports de types pour ne pas casser les imports existants.

import React from "react";
import InfinityRenderer from "../configurator/renderers/InfinityRenderer";

// Ré-export des types pour rétrocompatibilité
export type {
  LedType,
  LegStyle,
  SideMaterial,
  MirrorOptions,
} from "../configurator/renderers/InfinityRenderer";

import type {
  LedType,
  LegStyle,
  SideMaterial,
  MirrorOptions as MirrorOpts,
} from "../configurator/renderers/InfinityRenderer";

// Props legacy — conservées pour ne pas casser InfinityMirror.tsx
export interface MirrorOptions extends MirrorOpts {}

export interface Mirror3DProps {
  L: number; H: number; d: number; n: number;
  R_f: number; R_m: number;
  brightness?: number;
  ledColor?: string; ledType?: LedType; ledPower?: number;
  options?: MirrorOptions;
  onPartClick?: (part: string, screenX: number, screenY: number) => void;
}

export type ClickablePart = "topGlass" | "sideFront" | "sideBack" | "sideLeft" | "sideRight" | "leg" | "scene";

const Mirror3D: React.FC<Mirror3DProps> = (props) => {
  const { L, H, d, n, R_f, R_m, brightness, ledColor, ledType, ledPower, options: mirrorOpts, onPartClick } = props;

  return (
    <InfinityRenderer
      dimensions={{ L, H, P: d }}
      options={{
        R_f,
        R_m,
        n,
        brightness,
        ledColor,
        ledType,
        ledPower,
        mirrorOptions: mirrorOpts,
      }}
      onPartClick={onPartClick}
    />
  );
};

export default Mirror3D;
