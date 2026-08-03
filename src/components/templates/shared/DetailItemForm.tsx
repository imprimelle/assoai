
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Trash2, Download, Upload, X, Image as ImageIcon, Loader2, Package } from "lucide-react";
import type { DetailItemFormProps as BaseDetailItemFormProps } from "@/types";
import { formatCFA } from "@/utils/format";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { smartSearch } from "@/utils/productSearch";
import { v4 as uuidv4 } from "uuid";

interface DetailItemFormProps extends BaseDetailItemFormProps {
  /** index de l'article dans la liste (pour data-highlight-key) */
  detailIndex?: number;
}

const DetailItemForm: React.FC<DetailItemFormProps> = ({
  id,
  description,
  quantite,
  prix,
  sousTotal,
  image_url,
  onDelete,
  onChange,
  isEditable = false,
  disableAmountEdit = false,
  detailIndex,
}) => {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Édition locale Qté/PU : évite le bug du fallback numérique pendant la saisie ──
  const [localQté, setLocalQté] = useState<string | null>(null);
  const [localPU, setLocalPU] = useState<string | null>(null);
  const qtéInputRef = useRef<HTMLInputElement>(null);
  const puInputRef = useRef<HTMLInputElement>(null);

  // Sync props → local quand l'input n'est pas focus
  useEffect(() => {
    if (document.activeElement !== qtéInputRef.current) {
      setLocalQté(null);
    }
  }, [quantite]);
  useEffect(() => {
    if (document.activeElement !== puInputRef.current) {
      setLocalPU(null);
    }
  }, [prix]);

  // ── ContentEditable + @produit ──
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const productWrapperRef = useRef<HTMLDivElement>(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [activeProductIdx, setActiveProductIdx] = useState(0);

  const { products, isLoading: productsLoading } = useProducts("", "ALL");

  const flatProducts = useMemo(() => {
    const items: { id: string; label: string; price: number; imageUrl?: string | null; variant?: string }[] = [];
    for (const p of products) {
      if (!p) continue;
      items.push({ id: p.id, label: p.name || "", price: p.variants?.[0]?.price || 0, imageUrl: p.main_image_url });
      if (Array.isArray(p.variants)) {
        for (const v of p.variants) {
          if (!v) continue;
          items.push({ id: v.id || "", label: `${p.name} — ${v.name}`, price: v.price || 0, imageUrl: (v as any).image_url || p.main_image_url, variant: v.name });
        }
      }
    }
    return items;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.toLowerCase().trim();
    if (!q) return flatProducts.slice(0, 12);
    const scored = smartSearch(q, products);
    const result = new Map<string, typeof flatProducts[0]>();
    for (const s of scored.slice(0, 8)) {
      result.set(s.product.id, { id: s.product.id, label: s.product.name || "", price: s.product.variants?.[0]?.price || 0, imageUrl: s.product.main_image_url });
    }
    return Array.from(result.values());
  }, [productQuery, products, flatProducts]);

  // ── Initialiser le contenteditable avec la description ──
  useEffect(() => {
    const el = contentEditableRef.current;
    if (!el || !isEditable) return;
    // Ne pas écraser si l'utilisateur est en train d'éditer
    if (document.activeElement === el) return;
    // Comparer avec le contenu actuel
    const currentText = el.innerText || "";
    if (currentText !== description && description) {
      el.textContent = description;
    }
  }, [description, isEditable]);

  // Réinitialiser l'index actif quand la query change
  useEffect(() => { setActiveProductIdx(0); }, [productQuery]);

  // Click outside dropdown
  useEffect(() => {
    if (!showProductDropdown) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!productWrapperRef.current?.contains(t) && !productDropdownRef.current?.contains(t)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProductDropdown]);

  // ── Émettre la description (innerText du contenteditable) ──
  const emitDescription = useCallback(() => {
    const el = contentEditableRef.current;
    if (!el) return;
    const text = el.innerText || "";
    onChange({ description: text });
  }, [onChange]);

  // ── Détecter @ ──
  const handleContentEditableInput = useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !contentEditableRef.current) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) { setShowProductDropdown(false); setProductQuery(""); return; }
    const text = textNode.textContent || "";
    const cursorPos = range.startOffset;
    const beforeCursor = text.slice(0, cursorPos);
    const atIdx = beforeCursor.lastIndexOf("@");
    if (atIdx >= 0) {
      const charBefore = atIdx > 0 ? beforeCursor[atIdx - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || atIdx === 0) {
        setProductQuery(beforeCursor.slice(atIdx + 1).split(/\s/)[0]);
        setShowProductDropdown(true);
        return;
      }
    }
    setShowProductDropdown(false);
    setProductQuery("");
  }, []);

  // ── Insérer une chip produit ──
  const insertProductChip = useCallback((prod: { id: string; label: string; price: number; imageUrl?: string | null }) => {
    const el = contentEditableRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    const text = textNode.textContent || "";
    const cursorPos = range.startOffset;
    const beforeCursor = text.slice(0, cursorPos);
    const atIdx = beforeCursor.lastIndexOf("@");
    if (atIdx < 0) return;

    const charBeforeAt = atIdx > 0 ? text[atIdx - 1] : " ";
    if (charBeforeAt !== " " && charBeforeAt !== "\n" && atIdx > 0) return;

    // Supprimer @query du nœud texte
    textNode.textContent = text.slice(0, atIdx) + text.slice(cursorPos);

    // Créer la chip
    const chip = document.createElement("span");
    chip.textContent = prod.label;
    chip.setAttribute("data-product-id", prod.id);
    chip.setAttribute("data-product-name", prod.label);
    chip.setAttribute("data-product-price", String(prod.price));
    chip.contentEditable = "false";
    chip.className =
      "inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-medium " +
      "bg-orange-100 text-orange-700 border border-orange-200 select-none cursor-default " +
      "align-middle whitespace-nowrap";

    // Insérer la chip + espace après
    const space = document.createTextNode("\u00A0");
    const newRange = document.createRange();
    newRange.setStart(textNode, atIdx);
    newRange.collapse(true);
    newRange.insertNode(chip);
    chip.after(space);

    // Curseur après l'espace
    const afterRange = document.createRange();
    afterRange.setStartAfter(space);
    afterRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(afterRange);

    setShowProductDropdown(false);
    setProductQuery("");
    el.focus();

    // Émettre description + prix en UN SEUL appel (anti-batching)
    const descText = el.innerText || "";
    const updates: any = { description: descText };
    if (prod.price) updates.prixUnitaire = prod.price;
    onChange(updates);
  }, [onChange, emitDescription]);

  // ── KeyDown : nav dropdown + Backspace suppression chip ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Navigation dropdown
    if (showProductDropdown && filteredProducts.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveProductIdx((p) => (p + 1) % filteredProducts.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveProductIdx((p) => (p - 1 + filteredProducts.length) % filteredProducts.length); return; }
      if (e.key === "Enter") { e.preventDefault(); const fp = filteredProducts[activeProductIdx]; if (fp) insertProductChip(fp); return; }
      if (e.key === "Escape") { setShowProductDropdown(false); return; }
    }

    // Backspace : supprimer chip précédente
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer;
        const offset = range.startOffset;
        if (offset === 0) {
          const prev = textNode.previousSibling;
          if (prev && prev.nodeType === Node.ELEMENT_NODE) {
            const el = prev as HTMLElement;
            if (el.hasAttribute("data-product-id")) {
              e.preventDefault();
              el.remove();
              if (textNode.textContent?.startsWith("\u00A0")) {
                textNode.textContent = textNode.textContent.slice(1);
              }
              emitDescription();
              return;
            }
          }
        }
      }
    }
  };

  // ── Position dropdown ──
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (showProductDropdown && contentEditableRef.current) {
      const rect = contentEditableRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.bottom + 4}px`,
        minWidth: `${Math.max(rect.width, 250)}px`,
        zIndex: 9999,
      });
    }
  }, [showProductDropdown, productQuery]);

  // ── Upload ──
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `public/${fileName}`;
      const { error: uploadErr } = await supabase.storage.from("images").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from("images").getPublicUrl(filePath);
      onChange({ image_url: data.publicUrl });
    } catch {
      console.error("Erreur upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadImage = () => {
    if (!image_url) return;
    const a = document.createElement("a");
    a.href = image_url;
    a.download = `article_${id}.jpg`;
    a.click();
  };

  return (
    <div
      data-highlight-key={detailIndex !== undefined ? `detail-${detailIndex}` : undefined}
      className="relative bg-white border border-gray-300 rounded-lg px-3 py-2 space-y-2 shadow-sm transition-colors duration-1000">
      {/* ── Ligne 1 : Description + Supprimer ── */}
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0" ref={productWrapperRef}>
          {isEditable ? (
            <>
              <div
                ref={contentEditableRef}
                contentEditable
                suppressContentEditableWarning
                onKeyDown={handleKeyDown}
                onInput={handleContentEditableInput}
                onBlur={emitDescription}
                data-placeholder="Description… @ pour chercher un produit"
                className="w-full min-h-[36px] max-h-[80px] overflow-y-auto px-3 py-1.5 rounded-lg
                           border border-gray-300 bg-gray-50/60 text-sm text-gray-800
                           focus:ring-2 focus:ring-orange-500/60 focus:border-orange-400 focus:bg-white outline-none
                           whitespace-pre-wrap break-words
                           empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400
                           transition-shadow"
              />

              {/* Dropdown @produit */}
              {showProductDropdown && filteredProducts.length > 0 && createPortal(
                <div
                  ref={productDropdownRef}
                  style={dropdownStyle}
                  className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1"
                >
                  {productsLoading && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                      <Loader2 size={12} className="animate-spin" /> Chargement…
                    </div>
                  )}
                  {filteredProducts.map((fp, idx) => (
                    <button
                      key={fp.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); insertProductChip(fp); }}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        idx === activeProductIdx ? "bg-orange-50 text-orange-700" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                        {fp.imageUrl ? (
                          <img src={fp.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-gray-400" />
                        )}
                      </span>
                      <span className="font-medium flex-1 truncate">{fp.label}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{formatCFA(fp.price)}</span>
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </>
          ) : (
            <div className="text-sm text-gray-900 min-h-[36px] flex items-center px-2">
              {description || <span className="text-gray-400 text-xs">Sans description</span>}
            </div>
          )}
        </div>
        {isEditable && (
          <button
            type="button"
            onClick={onDelete}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-md transition-colors shrink-0 mt-1"
            title="Supprimer l'article"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* ── Ligne 2 : Qté + PU ── */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium shrink-0">Qté</span>
          {isEditable && !disableAmountEdit ? (
            <input
              ref={qtéInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={localQté !== null ? localQté : String(quantite)}
              onFocus={() => { setLocalQté(String(quantite)); }}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                setLocalQté(raw);
              }}
              onBlur={() => {
                const val = localQté !== null ? (Number(localQté) || 1) : quantite;
                setLocalQté(null);
                if (val !== quantite) onChange({ quantite: Math.max(1, val) });
              }}
              className="w-14 h-7 border border-gray-300 bg-white rounded-lg px-1.5 text-xs text-center font-medium focus:ring-2 focus:ring-orange-500/60 focus:border-orange-400 outline-none"
            />
          ) : (
            <span className="text-xs font-medium w-14 text-center">{quantite}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium shrink-0">PU</span>
          {isEditable && !disableAmountEdit ? (
            <input
              ref={puInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={localPU !== null ? localPU : String(prix)}
              onFocus={() => { setLocalPU(String(prix)); }}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                setLocalPU(raw);
              }}
              onBlur={() => {
                const val = localPU !== null ? (Number(localPU) || 0) : prix;
                setLocalPU(null);
                if (val !== prix) onChange({ prixUnitaire: val });
              }}
              className="w-24 h-7 border border-gray-300 bg-white rounded-lg px-1.5 text-xs text-right font-medium focus:ring-2 focus:ring-orange-500/60 focus:border-orange-400 outline-none"
            />
          ) : (
            <span className="text-xs text-right w-24">{formatCFA(prix)}</span>
          )}
        </div>
      </div>

      {/* ── Ligne 3 : Miniature + Total ── */}
      <div className="flex items-center gap-2">
        {image_url ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setImageModalOpen(true); }}
            className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-sm
                       hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer"
            title="Voir l'image"
          >
            <img src={image_url} alt="Article" className="w-full h-full object-cover" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (isEditable) fileInputRef.current?.click(); }}
            className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 border border-gray-200
                       flex items-center justify-center hover:bg-gray-200 transition-colors"
            title={isEditable ? "Ajouter une image" : "Pas d'image"}
          >
            <ImageIcon size={15} className="text-gray-400" />
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <div className="flex-1" />
        <div className="text-right shrink-0">
          <span className="text-[11px] text-gray-500 font-medium block">Total</span>
          <span className="text-sm font-bold text-green-700">{formatCFA(sousTotal)}</span>
        </div>
      </div>

      {/* ── Modal image ── */}
      {imageModalOpen && image_url && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setImageModalOpen(false)}>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]">{description || "Article"}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={handleDownloadImage} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Télécharger"><Download size={18} /></button>
                <button type="button" onClick={() => { fileInputRef.current?.click(); setImageModalOpen(false); }} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Changer l'image"><Upload size={18} /></button>
                <button type="button" onClick={() => { onChange({ image_url: "" }); setImageModalOpen(false); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer l'image"><Trash2 size={18} /></button>
                <button type="button" onClick={() => setImageModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-2" title="Fermer"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-900/5">
              <img src={image_url} alt={description || "Article"} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md" />
            </div>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center z-10">
          <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
        </div>
      )}
    </div>
  );
};

export default DetailItemForm;
