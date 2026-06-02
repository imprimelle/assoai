
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import TemplateRenderer from "./TemplateRenderer";
import { TemplateData, TemplateType } from "@/types";

interface TemplateModalContentProps {
  templateType: TemplateType;
  data: TemplateData;
  isEditable: boolean;
  mode: 'editable' | 'preview' | 'readonly';
  isFromChatMessage: boolean;
  isMobile: boolean;
  onDataChange: (data: TemplateData) => void;
  onSave?: () => void;
}

const TemplateModalContent: React.FC<TemplateModalContentProps> = ({
  templateType,
  data,
  isEditable,
  mode,
  isFromChatMessage,
  isMobile,
  onDataChange,
  onSave
}) => {
  return (
    <div className={`flex-1 overflow-y-auto p-0 bg-white ${isFromChatMessage && isMobile ? 'pb-20' : ''}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full bg-white rounded-md"
        >
          <TemplateRenderer
            templateType={templateType}
            data={data}
            isEditable={isEditable}
            onDataChange={onDataChange}
            onSave={onSave}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TemplateModalContent;
