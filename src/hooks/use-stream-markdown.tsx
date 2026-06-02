
import React, { useState, useEffect } from 'react';
import { useStreamText } from './use-stream-text';
import { parseMarkdown, MarkdownRenderer } from '@/utils/markdown-parser';

interface UseStreamMarkdownOptions {
  text: string;
  isStreaming?: boolean;
  speed?: number;
  delay?: number;
  chunkSize?: number;
  disableMarkdown?: boolean;
}

/**
 * A hook that extends useStreamText to provide markdown formatting
 * while preserving text streaming functionality
 */
export const useStreamMarkdown = ({
  text,
  isStreaming = true,
  speed = 20,
  delay = 0,
  chunkSize = 1,
  disableMarkdown = false
}: UseStreamMarkdownOptions) => {
  // Use the existing useStreamText hook for the basic streaming functionality
  const { streamedText, isComplete } = useStreamText({
    text,
    isStreaming,
    speed,
    delay, 
    chunkSize
  });

  // Create a component that wraps the MarkdownRenderer
  const StreamedComponent = () => {
    // Only render markdown if the user hasn't disabled it and we actually have text to render
    if (disableMarkdown || !streamedText) {
      return <>{streamedText}</>;
    }
    
    return <MarkdownRenderer text={streamedText} />;
  };

  return {
    streamedText,
    isComplete,
    StreamedComponent
  };
};

export default useStreamMarkdown;
