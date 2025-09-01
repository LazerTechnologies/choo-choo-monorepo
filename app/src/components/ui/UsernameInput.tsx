'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Input } from '@/components/base/Input';
import { cn } from '@/lib/utils';

interface User {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

interface UsernameInputProps {
  value?: string;
  onUserSelect: (user: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  helperText?: string;
}

export function UsernameInput({
  value = '',
  onUserSelect,
  placeholder = 'Enter username...',
  disabled = false,
  className,
  label,
  helperText,
}: UsernameInputProps) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isUserSelected, setIsUserSelected] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length === 0) {
      setUsers([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search-users?q=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();

      if (response.ok) {
        setUsers(data.result?.users || []);
        setShowDropdown(true);
        setSelectedIndex(-1);
      } else {
        setError(data.error || 'Failed to search users');
        setUsers([]);
        setShowDropdown(false);
      }
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
      setUsers([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (isUserSelected) {
      setIsUserSelected(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length > 0) {
        searchUsers(searchTerm.trim());
      } else {
        setUsers([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchUsers, isUserSelected]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUserSelect = useCallback(
    (user: User) => {
      setSearchTerm(user.username);
      setShowDropdown(false);
      setSelectedIndex(-1);
      setIsUserSelected(true);
      onUserSelect({
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
      });
    },
    [onUserSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || users.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < users.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < users.length) {
            handleUserSelect(users[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          setSelectedIndex(-1);
          inputRef.current?.blur();
          break;
      }
    },
    [showDropdown, users, selectedIndex, handleUserSelect]
  );

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsUserSelected(false);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          className={cn(
            'w-full pr-10 !text-black dark:!text-black',
            error && 'border-red-500',
            loading && 'opacity-75'
          )}
        />

        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {helperText && !error && <div className="text-xs text-gray-500 mt-1">{helperText}</div>}

      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}

      {showDropdown && users.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {users.map((user, index) => (
            <div
              key={user.fid}
              className={cn(
                'flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                selectedIndex === index && 'bg-gray-100 dark:bg-gray-700'
              )}
              onClick={() => handleUserSelect(user)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Image
                src={user.pfp_url}
                alt={`${user.username} avatar`}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  @{user.username}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.display_name}
                </div>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">FID: {user.fid}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
