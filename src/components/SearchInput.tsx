
import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import UserTag from '@/components/ui/UserTag';
import UserSuggestions from '@/components/UserSuggestions';

export interface SearchInputProps {
  placeholder?: string;
  value: string;
  userTags?: { id: string; name: string }[];
  onChange: (value: string) => void;
  onUserTagsChange: (userTags: { id: string; name: string }[]) => void;
  className?: string;
  id?: string;
  isSuperAgent?: boolean;
  showUserSuggestions?: boolean; // New prop to control user suggestions visibility
}

export function SearchInput({ 
  placeholder = "Rechercher...", 
  value, 
  userTags = [],
  onChange, 
  onUserTagsChange,
  className,
  id,
  isSuperAgent = false,
  showUserSuggestions = true // Default to true for backward compatibility
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(value);
  const [isTypingMention, setIsTypingMention] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Update inner value when external value changes
  useEffect(() => {
    if (!isTypingMention) {
      setInputValue(value);
    }
  }, [value, isTypingMention]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Check if user is typing a username tag
    if (newValue.includes('@')) {
      setIsTypingMention(true);
      // Only show suggestions if allowed by props
      setShowSuggestions(showUserSuggestions);
    } else {
      setIsTypingMention(false);
      setShowSuggestions(false);
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle removal of last user tag with backspace when input is empty
    if (e.key === 'Backspace' && inputValue === '' && userTags.length > 0) {
      const newTags = [...userTags];
      newTags.pop();
      onUserTagsChange(newTags);
      inputRef.current?.focus();
    }
    
    // Allow enter to submit the current search
    if (e.key === 'Enter' && !isTypingMention) {
      onChange(inputValue);
    }
  };

  const handleBlur = () => {
    // Wait a moment before hiding suggestions to allow click events to complete
    setTimeout(() => {
      if (isTypingMention) {
        setInputValue(value);
        setIsTypingMention(false);
      }
      setShowSuggestions(false);
    }, 200);
  };

  // Focus the input when clicking on the container
  const handleContainerClick = () => {
    inputRef.current?.focus();
    // Show suggestions again if there's an @ in the input and allowed by props
    if (inputValue.includes('@') && showUserSuggestions) {
      setShowSuggestions(true);
    }
  };

  // Remove a specific user tag
  const handleRemoveUserTag = (index: number) => {
    console.log("Removing user tag at index:", index);
    const newTags = userTags.filter((_, i) => i !== index);
    console.log("New tags after removal:", newTags);
    onUserTagsChange(newTags);
    inputRef.current?.focus();
  };

  // Add a new user tag when selected from suggestions
  const handleAddUserTag = (user: { id: string; name: string }) => {
    console.log("Adding user tag:", user);
    // Check if user already exists in tags
    const tagExists = userTags.some(tag => tag.id === user.id);
    
    if (!tagExists) {
      const newTags = [...userTags, user];
      console.log("New tags after addition:", newTags);
      onUserTagsChange(newTags);
      
      // Reset the input field
      setInputValue('');
      setIsTypingMention(false);
      setShowSuggestions(false);
      onChange(''); // Update the parent component's state
    }
  };

  return (
    <div 
      className={`relative flex items-center border border-input bg-white rounded-md transition-all duration-200 hover:border-brand-orange focus-within:border-brand-orange focus-within:ring-1 focus-within:ring-brand-orange/20 shadow-sm ${className}`}
      onClick={handleContainerClick}
    >
      <Search className="absolute left-3 text-brand-orange h-4 w-4" />
      <div className="flex flex-wrap items-center gap-2 pl-10 pr-3 py-2 w-full">
        {userTags.map((tag, index) => (
          <UserTag 
            key={tag.id}
            userName={tag.name} 
            onRemove={() => handleRemoveUserTag(index)}
            isValid={isSuperAgent}
          />
        ))}
        <Input
          id={id}
          ref={inputRef}
          className="border-0 p-0 shadow-none focus-visible:ring-0 flex-1 min-w-[100px]"
          placeholder={userTags.length > 0 ? "Filtrer les résultats..." : placeholder}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </div>
      
      {showSuggestions && (
        <div className="absolute top-full left-0 z-10 mt-1 w-full">
          <UserSuggestions
            searchTerm={inputValue}
            onSelectUser={handleAddUserTag}
            onClose={() => setShowSuggestions(false)}
          />
        </div>
      )}
    </div>
  );
}

export default SearchInput;
