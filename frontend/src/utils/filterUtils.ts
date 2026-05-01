import React from 'react';

/**
 * Utility functions for safe and consistent filtering
 */

/**
 * Safely filter text with null/undefined handling and trimming
 */
export function safeTextFilter(
  text: string | null | undefined,
  searchTerm: string | null | undefined
): boolean {
  if (!searchTerm?.trim()) return true;
  if (!text) return false;
  
  return text.toLowerCase().includes(searchTerm.toLowerCase().trim());
}

/**
 * Filter array of items by multiple text fields
 */
export function multiFieldTextFilter<T>(
  item: T,
  searchTerm: string | null | undefined,
  fields: (keyof T)[]
): boolean {
  if (!searchTerm?.trim()) return true;
  
  const searchLower = searchTerm.toLowerCase().trim();
  
  return fields.some(field => {
    const value = item[field];
    if (typeof value === 'string') {
      return value.toLowerCase().includes(searchLower);
    }
    return false;
  });
}

/**
 * Safely filter by status with null handling
 */
export function safeStatusFilter(
  itemStatus: string | null | undefined,
  filterStatus: string | null | undefined
): boolean {
  if (!filterStatus) return true;
  if (!itemStatus) return false;
  
  return itemStatus.toLowerCase() === filterStatus.toLowerCase();
}

/**
 * Filter by status array (for multiple allowed statuses)
 */
export function statusArrayFilter(
  itemStatus: string | null | undefined,
  allowedStatuses: readonly string[]
): boolean {
  if (!itemStatus) return false;
  
  return allowedStatuses.includes(itemStatus.toLowerCase());
}

/**
 * Validate and sanitize search input
 */
export function sanitizeSearchInput(input: string | null | undefined): string {
  if (!input) return '';
  
  // Remove potentially dangerous characters and trim
  return input
    .replace(/[<>\"'&]/g, '') // Remove HTML/script injection chars
    .trim()
    .substring(0, 100); // Limit length
}

/**
 * Debounced search hook for performance
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Status constants for consistent filtering
 */
export const STATUS_CONSTANTS = {
  TRANSFER_REQUEST: {
    PENDING: 'pending',
    APPROVED: 'approved', 
    REJECTED: 'rejected',
    COMPLETED: 'completed'
  },
  ASSIGNMENT: {
    PENDING: 'pending',
    ASSIGNED: 'assigned',
    ACCEPTED: 'accepted',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed'
  },
  DOCUMENT: {
    DRAFT: 'draft',
    CONFIRMED: 'confirmed',
    ASSIGNED: 'assigned',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed'
  }
} as const;

/**
 * Get pending statuses for assignments
 */
export function getPendingAssignmentStatuses(): readonly string[] {
  return [STATUS_CONSTANTS.ASSIGNMENT.PENDING, STATUS_CONSTANTS.ASSIGNMENT.ASSIGNED];
}

/**
 * Get completed statuses for assignments  
 */
export function getCompletedAssignmentStatuses(): readonly string[] {
  return [
    STATUS_CONSTANTS.ASSIGNMENT.ACCEPTED,
    STATUS_CONSTANTS.ASSIGNMENT.IN_PROGRESS,
    STATUS_CONSTANTS.ASSIGNMENT.COMPLETED
  ];
}