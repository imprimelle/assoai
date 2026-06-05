
export interface PDFGenerationResponse {
  success: boolean;
  url?: string;
  error?: string;
  status?: "ok" | "error" | "success";
  pdfUrl?: string;
  downloadUrl?: string; // New field for direct download URL
  errorMessage?: string;
  filename?: string; // Corrected to be consistent
  templateType?: string;
  message?: string;
  documentNumber?: string;
  imageUrl?: string;
  // Enhanced error information
  errorType?: string; // TIMEOUT, NETWORK_ERROR, SERVICE_ERROR, etc.
  responseTime?: number; // Response time in milliseconds
}

export interface PDFAction {
  id: string;
  templateType: import("./template").TemplateType;
  status: "pending" | "success" | "error" | "ready";
  pdfUrl?: string;
  imageUrl?: string;
  downloadUrl?: string; // New field for direct download URL
  timestamp: string;
  sessionId?: string;
  filename?: string; // Consistent property name
  documentNumber?: string; // Document number (e.g. invoice number)
  userId?: string; // UserId for API calls
  templateData?: import("./template-data").TemplateData; // Template data for API calls
}
