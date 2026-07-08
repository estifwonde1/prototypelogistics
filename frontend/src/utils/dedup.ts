/**
 * Deduplication utilities for Mantine UI Select, MultiSelect, and Autocomplete components.
 * These utilities ensure that duplicate options never crash the UI in production.
 */

/**
 * Deduplicates a simple array of strings (e.g. for Autocomplete data).
 * Keeps the first occurrence of each string and maintains original order.
 * 
 * @param arr Array of strings to deduplicate
 * @returns Deduplicated array of strings
 */
export function dedupStrings(arr: string[] | null | undefined): string[] {
  if (!arr) return [];
  return Array.from(new Set(arr));
}

/**
 * Deduplicates an array of objects by a specific property (default is 'value').
 * Keeps the first occurrence and maintains original order.
 * 
 * @param arr Array of objects to deduplicate
 * @param key The property to deduplicate by (default is 'value')
 * @returns Deduplicated array of objects
 */
export function dedupOptions<T extends Record<string, any>>(
  arr: T[] | null | undefined,
  key: keyof T = 'value'
): T[] {
  if (!arr) return [];
  const seen = new Set<any>();
  return arr.filter((item) => {
    if (item === null || item === undefined) return false;
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

/**
 * Deduplicates any array of items by a custom key extractor function.
 * Extremely flexible and useful for nested or complex data structures.
 * 
 * @param arr Array of items to deduplicate
 * @param keyExtractor Function to extract the unique key for each item
 * @returns Deduplicated array
 */
export function dedupBy<T>(
  arr: T[] | null | undefined,
  keyExtractor: (item: T) => any
): T[] {
  if (!arr) return [];
  const seen = new Set<any>();
  return arr.filter((item) => {
    if (item === null || item === undefined) return false;
    const key = keyExtractor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * A highly defensive, bulletproof helper that accepts any Mantine Combobox/Select data
 * (flat strings, flat objects with 'value', or grouped objects with 'items')
 * and returns it completely deduplicated.
 * 
 * This ensures that Mantine Select, MultiSelect, or Autocomplete will NEVER crash with
 * "Duplicate options are not supported" error, even if the source data is malformed.
 * 
 * @param data The raw data passed to Mantine's data prop
 * @returns A guaranteed duplicate-free array suitable for Mantine
 */
export function safeMantineData<T extends string | Record<string, any>>(
  data: T[] | null | undefined
): T[] {
  if (!data || !Array.isArray(data)) return [];

  const seenValues = new Set<string>();
  const result: T[] = [];

  for (const item of data) {
    if (item === null || item === undefined) continue;

    if (typeof item === 'string') {
      if (!seenValues.has(item)) {
        seenValues.add(item);
        result.push(item);
      }
    } else if (typeof item === 'object') {
      // Handle Mantine Grouped data: { group: string, items: (string | ComboboxItem)[] }
      if ('group' in item && Array.isArray(item.items)) {
        const deduplicatedItems: any[] = [];
        for (const subItem of item.items) {
          if (subItem === null || subItem === undefined) continue;

          if (typeof subItem === 'string') {
            if (!seenValues.has(subItem)) {
              seenValues.add(subItem);
              deduplicatedItems.push(subItem);
            }
          } else if (typeof subItem === 'object' && 'value' in subItem) {
            const val = String(subItem.value);
            if (!seenValues.has(val)) {
              seenValues.add(val);
              deduplicatedItems.push(subItem);
            }
          }
        }
        
        // Only include the group if it contains items after deduplication
        if (deduplicatedItems.length > 0) {
          result.push({
            ...item,
            items: deduplicatedItems,
          } as unknown as T);
        }
      } else if ('value' in item) {
        const val = String(item.value);
        if (!seenValues.has(val)) {
          seenValues.add(val);
          result.push(item);
        }
      } else if ('label' in item) {
        // Fallback for object without 'value' but has 'label'
        const val = String(item.label);
        if (!seenValues.has(val)) {
          seenValues.add(val);
          result.push({
            ...item,
            value: val,
          } as unknown as T);
        }
      }
    }
  }

  return result;
}
