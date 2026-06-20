import { useMemo } from 'react';
import { Badge, Card, Group, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { DateInput, TimeInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import { getFdps } from '../../../api/fdps';
import type { CommodityLineDraft } from './types';
import { fdpOptionLabel } from './fdpFilters';

interface FdpReceiveStepProps {
  value: CommodityLineDraft;
  onChange: (patch: Partial<CommodityLineDraft>) => void;
}

export function FdpReceiveStep({ value, onChange }: FdpReceiveStepProps) {
  const { data: fdps = [], isFetching } = useQuery({
    queryKey: ['fdps', 'dispatch-plan'],
    queryFn: () => getFdps(),
  });

  const fdpById = useMemo(() => new Map(fdps.map((fdp) => [fdp.id.toString(), fdp])), [fdps]);

  const fdpOptions = useMemo(() => {
    const options = fdps.map((fdp) => ({
      value: fdp.id.toString(),
      label: fdpOptionLabel(fdp),
    }));

    if (value.fdpId && !options.some((option) => option.value === value.fdpId) && value.fdpName) {
      options.unshift({ value: value.fdpId, label: value.fdpName });
    }

    return options;
  }, [fdps, value.fdpId, value.fdpName]);

  const selectedFdp = fdps.find((f) => f.id.toString() === value.fdpId);
  const totalQuantity = value.sourceAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  const unitLabel = value.unitLabel ?? value.sourceAllocations[0]?.unitLabel ?? '';

  const handleFdpChange = (fdpId: string | null) => {
    const fdp = fdpId ? fdpById.get(fdpId) : undefined;
    onChange({
      fdpId,
      fdpName: fdp?.name ?? value.fdpName,
    });
  };

  return (
    <Stack gap="md">
      {value.sourceAllocations.length > 0 && (
        <Card withBorder padding="md">
          <Text size="sm" fw={600} mb="sm">
            Dispatching {value.commodityLabel} from {value.sourceAllocations.length} source
            {value.sourceAllocations.length === 1 ? '' : 's'} ({totalQuantity.toLocaleString()} {unitLabel} total)
          </Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Source</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Quantity</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {value.sourceAllocations.map((allocation) => (
                <Table.Tr key={allocation.id}>
                  <Table.Td>
                    {allocation.sourceType === 'hub'
                      ? allocation.hubName || allocation.warehouseName
                      : allocation.warehouseName}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {allocation.quantity.toLocaleString()} {allocation.unitLabel ?? unitLabel}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <div>
        <Group justify="space-between" mb="xs">
          <Text size="sm" fw={600}>
            FDP Destination
          </Text>
          <Badge variant="light" color="blue">
            {fdps.length} FDPs available{isFetching ? '…' : ''}
          </Badge>
        </Group>
        <SearchableSelect
          label="Select FDP"
          placeholder={fdps.length ? 'Open to list all, or type to search by name' : 'No FDPs available'}
          description="All FDPs are listed. Type in the field to filter by FDP name."
          data={fdpOptions}
          value={value.fdpId}
          onChange={handleFdpChange}
          searchable
          disabled={fdps.length === 0 && !isFetching}
          nothingFoundMessage="No FDP name matches your search"
          filter={({ options, search }) => {
            const term = search.trim().toLowerCase();
            if (!term) return options;
            return options.filter((option) => {
              const fdp = fdpById.get(String(option.value));
              return (fdp?.name ?? '').toLowerCase().includes(term);
            });
          }}
          required
        />
      </div>

      {selectedFdp && (
        <SimpleGrid cols={{ base: 1, sm: 3 }} mt="md">
          <Text size="sm">
            <Text span c="dimmed">Location: </Text>
            {selectedFdp.location_name || '—'}
          </Text>
          <Text size="sm">
            <Text span c="dimmed">Level: </Text>
            {selectedFdp.location_type || '—'}
          </Text>
          <Text size="sm">
            <Text span c="dimmed">Families: </Text>
            {selectedFdp.number_of_families ?? '—'}
          </Text>
          <Text size="sm">
            <Text span c="dimmed">Beneficiaries: </Text>
            {selectedFdp.number_of_beneficiaries ?? '—'}
          </Text>
        </SimpleGrid>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md">
        <DateInput
          label="Expected Receive Date"
          placeholder="Select date"
          value={value.expectedReceiveAt}
          onChange={(val: string | null) =>
            onChange({ expectedReceiveAt: val ? new Date(val) : null })
          }
          required
        />
        <TimeInput
          label="Expected Receive Time"
          value={value.expectedReceiveTime}
          onChange={(e) => onChange({ expectedReceiveTime: e.currentTarget.value })}
          required
        />
      </SimpleGrid>
    </Stack>
  );
}
