import { memo } from 'react';
import { MultiSelect, Select, type MultiSelectProps, type SelectProps } from '@mantine/core';

export const SearchableSelect = memo(function SearchableSelect(props: SelectProps) {
  return <Select searchable {...props} />;
});

export const SearchableMultiSelect = memo(function SearchableMultiSelect(props: MultiSelectProps) {
  return <MultiSelect searchable {...props} />;
});
