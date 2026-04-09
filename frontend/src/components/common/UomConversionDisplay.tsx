import { Group, Text } from '@mantine/core';

interface UomConversionDisplayProps {
  enteredQuantity: number;
  enteredUnit: string;
  baseQuantity: number;
  baseUnit: string;
}

export function UomConversionDisplay({
  enteredQuantity,
  enteredUnit,
  baseQuantity,
  baseUnit,
}: UomConversionDisplayProps) {
  return (
    <Group gap="xs">
      <Text size="sm">
        {enteredQuantity} {enteredUnit}
      </Text>
      <Text size="sm" c="dimmed">
        =
      </Text>
      <Text size="sm" fw={600}>
        {baseQuantity} {baseUnit}
      </Text>
    </Group>
  );
}
