import { FileInput, Stack, Text } from '@mantine/core';
import { IconFileUpload } from '@tabler/icons-react';
import type { UploadedDocument } from '../../types/warehouse';

interface RentalAgreementUploadProps {
  value: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  error?: string;
  existingDocument?: UploadedDocument | null;
}

export function RentalAgreementUpload({
  value,
  onChange,
  required = false,
  error,
  existingDocument,
}: RentalAgreementUploadProps) {
  return (
    <Stack gap={6}>
      <FileInput
        label="Rental Agreement"
        placeholder="Upload PDF or image"
        accept="application/pdf,image/*"
        value={value}
        onChange={onChange}
        required={required}
        error={error}
        clearable
        leftSection={<IconFileUpload size={16} />}
      />
      {value ? (
        <Text size="xs" c="dimmed">Selected file: {value.name}</Text>
      ) : existingDocument ? (
        <Text size="xs" c="dimmed">Current file: {existingDocument.filename}</Text>
      ) : (
        <Text size="xs" c="dimmed">Accepted formats: PDF and common image files.</Text>
      )}
    </Stack>
  );
}
