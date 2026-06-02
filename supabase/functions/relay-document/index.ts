
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Define CORS headers for cross-origin access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Check if the file is an image based on its extension or content type
function isImageType(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.endsWith(".jpg") ||
    lowerUrl.endsWith(".jpeg") ||
    lowerUrl.endsWith(".png") ||
    lowerUrl.endsWith(".gif") ||
    lowerUrl.endsWith(".webp")
  );
}

// Check if the file is a PDF
function isPdfType(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith(".pdf");
}

// Get the file extension from a URL or filename
function getFileExtension(url: string): string {
  const urlParts = url.split("?")[0].split(".");
  return urlParts.length > 1 ? urlParts.pop()?.toLowerCase() || "bin" : "bin";
}

// Get the appropriate content type based on file extension
function getContentType(extension: string): string {
  const contentTypeMap: Record<string, string> = {
    "pdf": "application/pdf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "bin": "application/octet-stream",
  };
  
  return contentTypeMap[extension] || "application/octet-stream";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request
    const url = new URL(req.url);
    const sourceUrl = url.searchParams.get("url");
    
    // Validate the source URL
    if (!sourceUrl) {
      return new Response(
        JSON.stringify({ error: "Source URL is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if the URL is from a trusted source (Google Storage)
    if (!sourceUrl.startsWith("https://storage.googleapis.com/")) {
      return new Response(
        JSON.stringify({ error: "Invalid source URL" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Make an HTTP request to fetch the file content
    console.log(`Fetching document from source: ${sourceUrl}`);
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      console.error(`Failed to fetch document: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch document: ${response.status} ${response.statusText}` 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Extract the file content as an ArrayBuffer
    const fileContent = await response.arrayBuffer();
    console.log(`Successfully fetched document, size: ${fileContent.byteLength} bytes`);

    // Determine file type and extract a meaningful filename
    const fileExtension = getFileExtension(sourceUrl);
    const filename = `document_${Date.now()}.${fileExtension}`;
    const contentType = getContentType(fileExtension);
    const contentDisposition = `attachment; filename="${filename}"`;

    // Return the file with appropriate headers for download
    return new Response(fileContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "public, max-age=31536000" // Cache for 1 year
      }
    });
  } catch (error) {
    console.error(`Error handling document relay: ${error.message}`);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
