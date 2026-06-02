
import { appLogger } from "@/utils/logger";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

// Base URL of our Supabase Edge Function for document relay
const DOCUMENT_RELAY_URL = "https://szficuyofonohgrwxpco.supabase.co/functions/v1/relay-document";

/**
 * Generates a direct download URL for a document via our edge function
 * @param sourceUrl The original Google Storage URL provided by n8n
 * @returns A URL that will trigger a direct browser download
 */
export const getDirectDownloadUrl = (
  sourceUrl: string,
  options?: {
    userId?: string;
    templateType?: string;
    filename?: string;
  }
): string => {
  if (!sourceUrl) {
    appLogger.error("❌ Cannot generate direct download URL: sourceUrl is empty");
    return "";
  }

  try {
    // Create a URL object for our relay function
    const relayUrl = new URL(DOCUMENT_RELAY_URL);
    
    // Add the source URL as a query parameter
    relayUrl.searchParams.append("url", sourceUrl);
      if (options?.userId) {
    relayUrl.searchParams.append("userId", options.userId);
  }
  if (options?.templateType) {
    relayUrl.searchParams.append("templateType", options.templateType);
  }
  if (options?.filename) {
    relayUrl.searchParams.append("filename", options.filename);
  }

    
    appLogger.info("✅ Generated direct download URL", { 
      originalUrl: sourceUrl.substring(0, 100) + "...",
      relayUrl: relayUrl.toString().substring(0, 100) + "..."
    });
    
    return relayUrl.toString();
  } catch (error) {
    appLogger.error("❌ Error generating direct download URL", { 
      sourceUrl, 
      error: error instanceof Error ? error.message : String(error)
    });
    return sourceUrl; // Fall back to the original URL if there's an error
  }
};

/**
 * Determines if a URL is from Google Storage (provided by n8n)
 * @param url The URL to check
 * @returns True if the URL is from Google Storage
 */
export const isGoogleStorageUrl = (url: string): boolean => {
  return url.startsWith("https://storage.googleapis.com/");
};

/**
 * Archives a document in Supabase storage for future reference
 * @param url The URL of the document to archive
 * @param metadata Additional metadata about the document
 * @returns Promise resolving to the public URL of the archived document
 */
export const archiveDocument = async (
  url: string, 
  metadata: {
    templateType: string;
    documentNumber?: string;
    fileName?: string;
    userId?: string;
  }
): Promise<string | null> => {
  try {
    const bucketName = "documents";
    const fileName = metadata.fileName || `${metadata.templateType}_${metadata.documentNumber || uuidv4()}.pdf`;
    
    // Attempt to fetch the document from the source URL
    const response = await fetch(url);
    
    if (!response.ok) {
      appLogger.error("❌ Failed to fetch document for archiving", { 
        url, 
        status: response.status, 
        statusText: response.statusText 
      });
      return null;
    }
    
    // Get the file content as a blob
    const blob = await response.blob();
    
    // Generate a file path with folder structure
    const userId = metadata.userId || "anonymous";
    const templateType = metadata.templateType || "document";
    const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const filePath = `${userId}/${templateType}/${timestamp}/${fileName}`;
    
    appLogger.info("🔄 Archiving document in Supabase storage", {
      bucketName,
      filePath,
      originalUrl: url.substring(0, 100) + "...",
      fileSize: blob.size
    });
    
    // Upload the file to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
        contentType: blob.type,
        upsert: true
      });
    
    if (error) {
      appLogger.error("❌ Failed to archive document", {
        bucketName,
        filePath,
        error: error.message
      });
      return null;
    }
    
    // Get the public URL of the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    appLogger.info("✅ Document archived successfully", {
      bucketName,
      filePath,
      publicUrl
    });
    
    return publicUrl;
  } catch (error) {
    appLogger.error("❌ Exception archiving document", {
      url,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
};
