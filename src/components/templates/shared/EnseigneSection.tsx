
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ProductSuggestions from "@/components/shared/ProductSuggestions";
import ImageUpload from "./ImageUpload";
import MaterialSection from "./MaterialSection";
import type { Enseigne, ProductReference, MaterialItem } from "@/types";

interface EnseigneSectionProps {
  enseigne: Enseigne;
  isEditable?: boolean;
  onDelete: () => void;
  onChange: (changes: Partial<Enseigne>) => void;
  defaultOpen?: boolean;
}

const DEFAULT_SECTIONS = ["Découpe", "Éclairage", "Outillage", "Métal", "Vinyl"];

const EnseigneSection: React.FC<EnseigneSectionProps> = ({
  enseigne,
  isEditable = false,
  onDelete,
  onChange,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const sections = enseigne.materiauxSections || {};

  const handleDetailsChange = (field: string, value: any) => {
    const newDetails = { ...enseigne.details, [field]: value };
    onChange({ details: newDetails });
  };

  const handleDimensionsChange = (field: string, value: any) => {
    const newDimensions = { ...enseigne.details.dimensions, [field]: value };
    handleDetailsChange("dimensions", newDimensions);
  };

  const handleTechniqueChange = (field: string, value: any) => {
    const newTechnique = { ...enseigne.details.technique, [field]: value };
    handleDetailsChange("technique", newTechnique);
  };

  const addProduct = (product: { description: string; image_url?: string }) => {
    const newProduct: ProductReference = {
      id: crypto.randomUUID?.() || `prod-${Date.now()}`,
      nom: product.description,
      description: product.description,
      image_url: product.image_url
    };
    onChange({ produits: [...enseigne.produits, newProduct] });
  };

  const removeProduct = (productId: string) => {
    onChange({ 
      produits: enseigne.produits.filter(p => p.id !== productId) 
    });
  };

  // Gestion des matériaux
  const addSection = (name: string) => {
    if (!sections[name]) {
      const updated = { ...sections, [name]: [] };
      onChange({ materiauxSections: updated });
    }
  };

  const addItem = (section: string) => {
    const newItem: MaterialItem = {
      id: crypto.randomUUID?.() || `mat-${Date.now()}-${Math.random()}`,
      nom: "",
      quantite: 1,
      unite: "",
      section
    };
    const updated = { ...sections, [section]: [...(sections[section] || []), newItem] };
    onChange({ materiauxSections: updated });
  };

  const deleteItem = (section: string, idx: number) => {
    const arr = [...(sections[section] || [])];
    arr.splice(idx, 1);
    const updated = { ...sections, [section]: arr };
    onChange({ materiauxSections: updated });
  };

  const changeItem = (section: string, idx: number, changes: Partial<MaterialItem>) => {
    const arr = [...(sections[section] || [])];
    arr[idx] = { ...arr[idx], ...changes };
    const updated = { ...sections, [section]: arr };
    onChange({ materiauxSections: updated });
  };

  const nonVides = DEFAULT_SECTIONS.filter(name => (sections[name] || []).length > 0);
  const disponibles = DEFAULT_SECTIONS.filter(name => (sections[name] || []).length === 0);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-gray-200 rounded-lg bg-white mb-4 overflow-hidden shadow-sm"
    >
      <CollapsibleTrigger className="flex justify-between items-center w-full p-3 sm:p-4 text-left bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150 transition-colors">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate break-words max-w-[120px] sm:max-w-none leading-tight">
            {enseigne.nom}
          </h3>
          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
            {enseigne.produits.length} produit{enseigne.produits.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {isEditable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {isOpen ? <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5" /> : <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="p-4 sm:p-6 space-y-4 sm:space-y-6"
            >
              {/* Nom de l'enseigne */}
              <div>
                <Label htmlFor={`enseigne-nom-${enseigne.id}`} className="text-sm font-medium">
                  Nom de l'enseigne
                </Label>
                {isEditable ? (
                  <Input
                    id={`enseigne-nom-${enseigne.id}`}
                    value={enseigne.nom}
                    onChange={(e) => onChange({ nom: e.target.value })}
                    className="mt-1 text-sm"
                    maxLength={50}
                  />
                ) : (
                  <p className="mt-1 text-gray-800 text-sm break-words">{enseigne.nom}</p>
                )}
              </div>

              {/* Produits */}
              <div>
                <h4 className="text-sm sm:text-md font-semibold mb-3 text-gray-700">
                  Produits référencés
                </h4>
                {isEditable && (
                  <div className="mb-4">
                    <ProductSuggestions
                      onSelectProduct={addProduct}
                      placeholder="Ajouter un produit à cette enseigne..."
                    />
                  </div>
                )}
                
                {enseigne.produits.length > 0 ? (
                  <div className="space-y-3">
                    {enseigne.produits.map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          {product.image_url && (
                            <img 
                              src={product.image_url} 
                              alt={product.nom}
                              className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded flex-shrink-0"
                            />
                          )}
                          <span className="font-medium text-sm break-words leading-tight">
                            {product.nom}
                          </span>
                        </div>
                        {isEditable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeProduct(product.id)}
                            className="text-red-500 hover:text-red-700 h-8 w-8 p-0 flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Aucun produit référencé</p>
                )}
              </div>

              {/* Détails du projet pour cette enseigne */}
              <div className="border-t pt-4 sm:pt-6">
                <h4 className="text-sm sm:text-md font-semibold mb-4 text-gray-700">
                  Détails du projet
                </h4>
                
                {/* Image */}
                <div className="mb-6">
                  <ImageUpload
                    imageUrl={enseigne.details.image_url}
                    onChange={(url) => handleDetailsChange("image_url", url)}
                    isEditable={isEditable}
                    label="Image du projet"
                    placeholder="Ajouter une image spécifique à cette enseigne"
                  />
                </div>

                {/* Dimensions */}
                <div className="mb-6">
                  <h5 className="text-sm font-medium mb-3 text-gray-600">Dimensions</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`largeur-${enseigne.id}`} className="text-xs">Largeur</Label>
                      {isEditable ? (
                        <Input
                          id={`largeur-${enseigne.id}`}
                          type="number"
                          value={enseigne.details.dimensions.largeur}
                          onChange={(e) => handleDimensionsChange("largeur", Number(e.target.value))}
                          className="h-9 text-sm"
                        />
                      ) : (
                        <p className="text-gray-800 text-sm">{enseigne.details.dimensions.largeur}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`hauteur-${enseigne.id}`} className="text-xs">Hauteur</Label>
                      {isEditable ? (
                        <Input
                          id={`hauteur-${enseigne.id}`}
                          type="number"
                          value={enseigne.details.dimensions.hauteur}
                          onChange={(e) => handleDimensionsChange("hauteur", Number(e.target.value))}
                          className="h-9 text-sm"
                        />
                      ) : (
                        <p className="text-gray-800 text-sm">{enseigne.details.dimensions.hauteur}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`profondeur-${enseigne.id}`} className="text-xs">Profondeur</Label>
                      {isEditable ? (
                        <Input
                          id={`profondeur-${enseigne.id}`}
                          type="number"
                          value={enseigne.details.dimensions.profondeur || 0}
                          onChange={(e) => handleDimensionsChange("profondeur", Number(e.target.value))}
                          className="h-9 text-sm"
                        />
                      ) : (
                        <p className="text-gray-800 text-sm">{enseigne.details.dimensions.profondeur || 0}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Technique */}
                <div className="mb-6">
                  <h5 className="text-sm font-medium mb-3 text-gray-600">Informations techniques</h5>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor={`type-structure-${enseigne.id}`} className="text-xs">
                        Type de structure
                      </Label>
                      {isEditable ? (
                        <Input
                          id={`type-structure-${enseigne.id}`}
                          value={enseigne.details.technique.type_structure}
                          onChange={(e) => handleTechniqueChange("type_structure", e.target.value)}
                          className="h-9 text-sm"
                        />
                      ) : (
                        <p className="text-gray-800 text-sm break-words">
                          {enseigne.details.technique.type_structure}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`method-fab-${enseigne.id}`} className="text-xs">
                        Méthode de fabrication
                      </Label>
                      {isEditable ? (
                        <Textarea
                          id={`method-fab-${enseigne.id}`}
                          value={enseigne.details.technique.method_fabrication}
                          onChange={(e) => handleTechniqueChange("method_fabrication", e.target.value)}
                          rows={2}
                          className="text-sm resize-none"
                        />
                      ) : (
                        <p className="whitespace-pre-line text-gray-800 text-sm break-words">
                          {enseigne.details.technique.method_fabrication}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Matériaux spécifiques à cette enseigne */}
                <div>
                  <h5 className="text-sm font-medium mb-3 text-gray-600">Matériaux spécifiques</h5>
                  {nonVides.map(name => (
                    <MaterialSection
                      key={name}
                      name={name}
                      items={sections[name]}
                      isEditable={isEditable}
                      onAddItem={addItem}
                      onDeleteItem={deleteItem}
                      onChangeItem={changeItem}
                    />
                  ))}

                  {isEditable && disponibles.length > 0 && (
                    <div className="mt-4 flex items-center space-x-2">
                      <select
                        defaultValue=""
                        onChange={e => {
                          const sel = e.target.value;
                          if (!sel) return;
                          addSection(sel);
                          addItem(sel); 
                          e.target.value = "";
                        }}
                        className="p-2 border rounded bg-white text-sm w-full max-w-xs"
                      >
                        <option value="" disabled>+ Ajouter une section…</option>
                        {disponibles.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default EnseigneSection;
