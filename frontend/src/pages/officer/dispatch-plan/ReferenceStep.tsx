import { SimpleGrid, TextInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import type { DispatchPlanReferenceDraft } from './types';

interface ReferenceStepProps {
  jurisdictionLabel: string;
  value: DispatchPlanReferenceDraft;
  onChange: (patch: Partial<DispatchPlanReferenceDraft>) => void;
}

const responseTypeOptions = [
  { value: 'Emergency', label: 'Emergency' },
  { value: 'Development', label: 'Development' },
  { value: 'Other', label: 'Other' },
];

export function ReferenceStep({ jurisdictionLabel, value, onChange }: ReferenceStepProps) {
  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput label="Jurisdiction" value={jurisdictionLabel} disabled description="Based on your role" />
        <TextInput
          label="Response Plan Reference Number"
          placeholder="Enter reference number"
          value={value.responsePlanRef}
          onChange={(e) => onChange({ responsePlanRef: e.target.value })}
          required
        />
        <DateInput
          label="Approval Date"
          placeholder="Select date"
          value={value.approvalDate}
          onChange={(val: string | null) => onChange({ approvalDate: val ? new Date(val) : null })}
          required
        />
        <SearchableSelect
          label="Response Type"
          placeholder="Optional"
          data={responseTypeOptions}
          value={value.responseType}
          onChange={(val) => onChange({ responseType: val })}
          clearable
        />
      </SimpleGrid>
      <Textarea
        label="Description"
        placeholder="Optional plan description"
        value={value.description}
        onChange={(e) => onChange({ description: e.target.value })}
        mt="md"
        rows={3}
      />
    </>
  );
}
