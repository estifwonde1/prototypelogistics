import { Card, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import type { DispatchPlanLineDraft, DispatchPlanReferenceDraft } from './types';

interface ExecuteStepProps {
  reference: DispatchPlanReferenceDraft;
  jurisdictionLabel: string;
  lines: DispatchPlanLineDraft[];
}

export function ExecuteStep({ reference, jurisdictionLabel, lines }: ExecuteStepProps) {
  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Text size="sm" fw={600} mb="sm">
          Response Plan
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Text size="sm">
            <Text span c="dimmed">Jurisdiction: </Text>
            {jurisdictionLabel}
          </Text>
          <Text size="sm">
            <Text span c="dimmed">Reference: </Text>
            {reference.responsePlanRef}
          </Text>
          <Text size="sm">
            <Text span c="dimmed">Approval Date: </Text>
            {reference.approvalDate ? reference.approvalDate.toLocaleDateString() : '—'}
          </Text>
          <Text size="sm">
            <Text span c="dimmed">Response Type: </Text>
            {reference.responseType || '—'}
          </Text>
        </SimpleGrid>
        {reference.description && (
          <Text size="sm" mt="sm">
            <Text span c="dimmed">Description: </Text>
            {reference.description}
          </Text>
        )}
      </Card>

      <Card withBorder padding="md">
        <Text size="sm" fw={600} mb="sm">
          Commodity Lines ({lines.length})
        </Text>
        <Table.ScrollContainer minWidth={800}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Commodity</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>FDP</Table.Th>
                <Table.Th>Expected Receive</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lines.map((line) => (
                <Table.Tr key={line.id}>
                  <Table.Td>{line.commodityLabel}</Table.Td>
                  <Table.Td>
                    {line.sourceType === 'hub'
                      ? `${line.hubName} (${line.warehouseName})`
                      : line.warehouseName}
                  </Table.Td>
                  <Table.Td>
                    {line.quantity.toLocaleString()} {line.unitLabel ?? ''}
                  </Table.Td>
                  <Table.Td>{line.fdpName}</Table.Td>
                  <Table.Td>{line.expectedReceiveAt.toLocaleString()}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}
