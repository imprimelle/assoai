import { useState, useCallback, useEffect } from "react";

/**
 * Hook : calcule la hauteur max disponible pour une liste dans un Popover.
 *
 * Problème résolu : Radix Popover.Content utilise `position: fixed` + `transform`
 * dans un portail React. Les contraintes CSS (max-height, overflow) ne fonctionnent
 * pas de manière fiable sur mobile (iOS Safari notamment) car l'élément est hors flux.
 *
 * Solution : mesurer `window.innerHeight` à l'ouverture et fournir une valeur en px
 * explicite à appliquer en `style` inline sur le conteneur de la liste.
 *
 * Usage :
 *   const { listMaxHeight, recalc } = usePopoverMaxHeight(open, inputHeightPx);
 *   // inputHeightPx = hauteur de la barre de recherche (~40px par défaut)
 *
 *   <CommandList style={{ maxHeight: listMaxHeight, overflowY: 'auto' }} />
 */
export function usePopoverMaxHeight(
  open: boolean,
  inputHeightPx: number = 40,
  maxVhRatio: number = 0.55
) {
  const [listMaxHeight, setListMaxHeight] = useState<number>(300);

  const recalc = useCallback(() => {
    // 55% de la hauteur du viewport, moins la hauteur de l'input et un padding
    const viewportH = window.innerHeight;
    const available = Math.floor(viewportH * maxVhRatio);
    const computed = available - inputHeightPx - 16; // 16px padding
    // Plancher à 150px, plafond à 500px
    setListMaxHeight(Math.max(150, Math.min(500, computed)));
  }, [inputHeightPx, maxVhRatio]);

  useEffect(() => {
    if (open) {
      // Petit délai pour laisser Radix positionner le popover
      const t = setTimeout(recalc, 50);
      return () => clearTimeout(t);
    }
  }, [open, recalc]);

  return { listMaxHeight, recalc };
}
