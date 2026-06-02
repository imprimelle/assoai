
import React from 'react';

type MarkdownNode = {
  type: 'text' | 'bold' | 'italic' | 'code' | 'link';
  content: string;
  url?: string;
  children?: MarkdownNode[];
};

/**
 * A simple parser for basic Markdown syntax
 * Supports bold, italic, code, and links
 */
export const parseMarkdown = (text: string): MarkdownNode[] => {
  const nodes: MarkdownNode[] = [];
  let currentIndex = 0;
  
  // Process the entire text
  while (currentIndex < text.length) {
    let nextFormatIndex = text.length;
    let nextFormat: 'bold' | 'italic' | 'code' | 'link' | null = null;
    
    // Find the next markdown format
    const boldIndex = text.indexOf('**', currentIndex);
    if (boldIndex !== -1 && boldIndex < nextFormatIndex) {
      nextFormatIndex = boldIndex;
      nextFormat = 'bold';
    }
    
    const italicIndex = text.indexOf('*', currentIndex);
    if (italicIndex !== -1 && !text.startsWith('**', italicIndex) && italicIndex < nextFormatIndex) {
      nextFormatIndex = italicIndex;
      nextFormat = 'italic';
    }
    
    const codeIndex = text.indexOf('`', currentIndex);
    if (codeIndex !== -1 && codeIndex < nextFormatIndex) {
      nextFormatIndex = codeIndex;
      nextFormat = 'code';
    }
    
    const linkIndex = text.indexOf('[', currentIndex);
    if (linkIndex !== -1 && linkIndex < nextFormatIndex) {
      nextFormatIndex = linkIndex;
      nextFormat = 'link';
    }
    
    // Add plain text before the next format marker
    if (nextFormatIndex > currentIndex) {
      nodes.push({
        type: 'text',
        content: text.slice(currentIndex, nextFormatIndex),
      });
      currentIndex = nextFormatIndex;
    }
    
    // Process the format
    if (nextFormat) {
      switch (nextFormat) {
        case 'bold':
          if (text.indexOf('**', currentIndex + 2) !== -1) {
            const boldStart = currentIndex + 2;
            const boldEnd = text.indexOf('**', boldStart);
            nodes.push({
              type: 'bold',
              content: text.slice(boldStart, boldEnd),
            });
            currentIndex = boldEnd + 2;
          } else {
            // If no closing bold marker, treat as plain text
            nodes.push({
              type: 'text',
              content: text.slice(currentIndex, currentIndex + 2),
            });
            currentIndex += 2;
          }
          break;
          
        case 'italic':
          if (text.indexOf('*', currentIndex + 1) !== -1) {
            const italicStart = currentIndex + 1;
            const italicEnd = text.indexOf('*', italicStart);
            nodes.push({
              type: 'italic',
              content: text.slice(italicStart, italicEnd),
            });
            currentIndex = italicEnd + 1;
          } else {
            // If no closing italic marker, treat as plain text
            nodes.push({
              type: 'text',
              content: '*',
            });
            currentIndex += 1;
          }
          break;
          
        case 'code':
          if (text.indexOf('`', currentIndex + 1) !== -1) {
            const codeStart = currentIndex + 1;
            const codeEnd = text.indexOf('`', codeStart);
            nodes.push({
              type: 'code',
              content: text.slice(codeStart, codeEnd),
            });
            currentIndex = codeEnd + 1;
          } else {
            // If no closing code marker, treat as plain text
            nodes.push({
              type: 'text',
              content: '`',
            });
            currentIndex += 1;
          }
          break;
          
        case 'link':
          const textEnd = text.indexOf(']', currentIndex);
          if (textEnd !== -1 && text.startsWith('(', textEnd + 1)) {
            const urlStart = textEnd + 2;
            const urlEnd = text.indexOf(')', urlStart);
            
            if (urlEnd !== -1) {
              nodes.push({
                type: 'link',
                content: text.slice(currentIndex + 1, textEnd),
                url: text.slice(urlStart, urlEnd),
              });
              currentIndex = urlEnd + 1;
            } else {
              // If no closing parenthesis, treat as plain text
              nodes.push({
                type: 'text',
                content: '[',
              });
              currentIndex += 1;
            }
          } else {
            // If no properly formatted link, treat as plain text
            nodes.push({
              type: 'text',
              content: '[',
            });
            currentIndex += 1;
          }
          break;
      }
    } else {
      // No more formatting found, add remaining text
      if (currentIndex < text.length) {
        nodes.push({
          type: 'text',
          content: text.slice(currentIndex),
        });
      }
      break;
    }
  }
  
  return nodes;
};

/**
 * A component that renders Markdown text as formatted JSX
 */
export const MarkdownRenderer = ({ text }: { text: string }) => {
  const nodes = parseMarkdown(text);
  
  const renderNode = (node: MarkdownNode, index: number): React.ReactNode => {
    switch (node.type) {
      case 'text':
        return <React.Fragment key={index}>{node.content}</React.Fragment>;
      case 'bold':
        return <strong key={index} className="font-bold">{node.content}</strong>;
      case 'italic':
        return <em key={index} className="italic">{node.content}</em>;
      case 'code':
        return <code key={index} className="bg-gray-100 text-orange-600 px-1 py-0.5 rounded font-mono text-sm">{node.content}</code>;
      case 'link':
        return <a key={index} href={node.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{node.content}</a>;
      default:
        return null;
    }
  };

  return <>{nodes.map((node, i) => renderNode(node, i))}</>;
};

/**
 * Function to determine if a text contains markdown formatting
 */
export const containsMarkdown = (text: string): boolean => {
  // Check for common markdown patterns
  const markdownPatterns = [
    /\*\*.*?\*\*/,  // Bold
    /\*.*?\*/,      // Italic
    /`.*?`/,        // Code
    /\[.*?\]\(.*?\)/ // Links
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
};
