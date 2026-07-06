import { Button, Group, Stack, Table, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { DispatchPlanLineDraft } from './types';

interface LinesReviewStepProps {
  lines: DispatchPlanLineDraft[];
  onAddAnother: () => void;
  onContinue: () => void;
  onRemoveLine: (id: string) => void;
}

export function LinesReviewStep({ lines, onAddAnother, onContinue, onRemoveLine }: LinesReviewStepProps) {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Review the commodity lines added to this dispatch plan. Use <strong>Add Another Commodity</strong> to
        include more items, or continue to final review. If you started a new commodity by mistake, use{' '}
        <strong>Back to Plan Lines</strong> at the bottom to return here without losing your plan.
      </Text>

      {lines.length === 0 ? (
        <Text c="dimmed" ta="center" py="lg">
          No commodity lines added yet.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={800}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Commodity</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Qty</Table.Th>
                <Table.Th>FDP</Table.Th>
                <Table.Th>Receive At</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lines.map((line) => (
                <Table.Tr key={line.id}>
                  <Table.Td>{line.commodityLabel}</Table.Td>
                  <Table.Td>
                    {line.sourceType === 'hub'
                      ? line.hubName || line.warehouseName
                      : line.warehouseName}
                  </Table.Td>
                  <Table.Td>
                    {line.quantity.toLocaleString()} {line.unitLabel ?? ''}
                  </Table.Td>
                  <Table.Td>{line.fdpName}</Table.Td>
                  <Table.Td>{line.expectedReceiveAt.toLocaleString()}</Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="subtle" color="red" onClick={() => onRemoveLine(line.id)}>
                      Remove
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Group justify="space-between">
        <Button leftSection={<IconPlus size={16} />} variant="light" onClick={onAddAnother}>
          Add Another Commodity
        </Button>
        <Button onClick={onContinue} disabled={lines.length === 0}>
          Continue to Final Review
        </Button>
      </Group>
    </Stack>
  );
}
