import { supabase } from "@/integrations/supabase/client";
import { appLogger } from "@/utils/logger";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";

// Helper function to ensure a storage bucket exists
export const ensureBucketExists = async (bucketName: string, isPublic = true) => {
  try {
    // Check if the bucket already exists
    const { data: existingBuckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      appLogger.error('❌ Error checking buckets', { error });
      return false;
    }
    
    // If the bucket already exists, return true
    if (existingBuckets.some(bucket => bucket.name === bucketName)) {
      appLogger.info(`✅ Bucket ${bucketName} already exists`);
      return true;
    }
    
    // Otherwise, create the bucket
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: isPublic,
      fileSizeLimit: 52428800 // 50MB limit
    });
    
    if (createError) {
      appLogger.error('❌ Error creating bucket', { 
        bucketName, 
        error: createError,
        errorMessage: createError.message
      });
      return false;
    }
    
    appLogger.info(`✅ Created bucket ${bucketName}`);
    return true;
  } catch (error) {
    appLogger.error('❌ Exception creating bucket', { 
      bucketName, 
      error,
      errorDetails: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

// Helper function to upload a file to a specified bucket
export const uploadFile = async (
  file: File, 
  bucketName: string = 'images',
  folderName: string = 'public'
): Promise<string | null> => {
  try {
    // Ensure the bucket exists
    const bucketExists = await ensureBucketExists(bucketName);
    if (!bucketExists) {
      appLogger.error(`❌ Bucket ${bucketName} doesn't exist or couldn't be created.`);
      throw new Error(`Le bucket ${bucketName} n'existe pas ou n'a pas pu être créé.`);
    }
    
    // Generate a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${folderName}/${fileName}`;
    
    appLogger.info('📤 Uploading file to Supabase storage', { 
      bucketName,
      filePath,
      fileType: file.type,
      fileSize: file.size
    });
    
    // Upload the file
    const { error: uploadError, data } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file);
    
    if (uploadError) {
      appLogger.error('❌ Error uploading file', { 
        bucketName, 
        filePath,
        error: uploadError,
        errorMessage: uploadError.message
      });
      throw uploadError;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    appLogger.info('✅ File uploaded successfully', { 
      bucketName, 
      filePath,
      publicUrl,
      fileType: file.type
    });
    
    return publicUrl;
  } catch (error) {
    appLogger.error('❌ Exception uploading file', { 
      bucketName, 
      error,
      errorDetails: error instanceof Error ? error.message : String(error),
      fileType: file?.type
    });
    return null;
  }
};

// Helper function to create all needed buckets for the application
export const initializeStorageBuckets = async () => {
  try {
    appLogger.info('🚀 Initializing storage buckets...');
    
    // Nous utilisons un seul bucket 'images' pour tous les fichiers, y compris les PDFs
    const buckets = [
      { name: 'images', isPublic: true }
    ];
    
    // Create buckets in parallel
    const results = await Promise.all(buckets.map(bucket => 
      ensureBucketExists(bucket.name, bucket.isPublic)
    ));
    
    // Check if all buckets were created successfully
    const allBucketsCreated = results.every(result => result === true);
    
    if (allBucketsCreated) {
      appLogger.info('✅ All storage buckets initialized');
    } else {
      appLogger.warning('⚠️ Some storage buckets failed to initialize');
    }
    
    return allBucketsCreated;
  } catch (error) {
    appLogger.error('❌ Error initializing storage buckets', { 
      error,
      errorDetails: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

// Function to be called at application startup
export const initializeStorage = async () => {
  try {
    appLogger.info('🔄 Initializing storage...');
    const result = await initializeStorageBuckets();
    if (result) {
      appLogger.info('✅ Storage initialization completed successfully');
    } else {
      appLogger.error('❌ Storage initialization failed');
    }
    return result;
  } catch (error) {
    appLogger.error('❌ Unexpected error during storage initialization', { 
      error,
      errorDetails: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};
