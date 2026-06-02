
import { useState, useEffect, useRef } from 'react';

interface UseStreamTextOptions {
  text: string;
  isStreaming?: boolean;
  speed?: number;
  delay?: number;
  chunkSize?: number;
}

/**
 * A hook that provides text streaming functionality
 * Uses a queue of timeouts instead of intervals for better reliability
 */
export const useStreamText = ({ 
  text, 
  isStreaming = true, 
  speed = 20,
  delay = 0,
  chunkSize = 1 // Add characters in chunks of this size (default: 1 character at a time)
}: UseStreamTextOptions) => {
  const [streamedText, setStreamedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  // Use refs to track timeouts and mounted state
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const isMountedRef = useRef(true);
  
  // Clear all pending timeouts
  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current = [];
  };

  useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true;
    
    return () => {
      // Mark component as unmounted
      isMountedRef.current = false;
      // Clean up any pending timeouts when unmounting
      clearAllTimeouts();
    };
  }, []);

  useEffect(() => {
    // Reset when text changes
    setStreamedText('');
    setIsComplete(false);
    clearAllTimeouts();
    
    // If no text or streaming is disabled, show full text immediately
    if (!text || !isStreaming) {
      setStreamedText(text || '');
      setIsComplete(true);
      return;
    }

    // Convert string to array for safer handling
    const characters = Array.from(text);
    let position = 0;
    
    // Schedule the initial delay
    const initialDelayTimeout = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      // Create a function for recursive timeouts
      const appendNextChunk = () => {
        if (!isMountedRef.current) return;
        
        if (position < characters.length) {
          // Calculate how many characters to add in this chunk 
          // (but don't exceed remaining text length)
          const chunkEnd = Math.min(position + chunkSize, characters.length);
          
          // Get the chunk of characters to add
          const chunk = characters.slice(position, chunkEnd).join('');
          
          // Update state with new chunk
          setStreamedText(current => current + chunk);
          
          // Move position forward
          position = chunkEnd;
          
          // Schedule the next chunk
          const timeout = setTimeout(appendNextChunk, speed);
          timeoutsRef.current.push(timeout);
        } else {
          // We've reached the end of the text
          setIsComplete(true);
        }
      };
      
      // Start the recursive chain
      appendNextChunk();
      
    }, delay);
    
    // Store the initial delay timeout
    timeoutsRef.current.push(initialDelayTimeout);
    
    // Clean up on re-render or unmount
    return () => {
      clearAllTimeouts();
    };
  }, [text, isStreaming, speed, delay, chunkSize]);

  return { streamedText, isComplete };
};

export default useStreamText;
