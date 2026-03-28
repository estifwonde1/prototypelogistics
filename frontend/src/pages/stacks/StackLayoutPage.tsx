import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Stack, Title, Text, Group, Select, Card, Badge } from '@mantine/core';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

export default function StackLayoutPage() {
  const [storeId, setStoreId] = useState<string | null>(null);

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const { data: stacks, isLoading, error, refetch } = useQuery({
    queryKey: ['stacks'],
    queryFn: getStacks,
  });

  const storeOptions = useMemo(
    () => stores?.map((s) => ({ value: String(s.id), label: s.name })) || [],
    [stores]
  );

  const selectedStore = stores?.find((s) => s.id.toString() === storeId);
  const storeStacks = stacks?.filter((s) => s.store_id?.toString() === storeId) || [];

  const scale = useMemo(() => {
    if (!selectedStore) return 1;
    const maxDim = Math.max(selectedStore.length || 1, selectedStore.width || 1);
    return 420 / maxDim;
  }, [selectedStore]);

  if (isLoading) return <LoadingState message="Loading stacks..." />;
  if (error) return <ErrorState message="Failed to load stacks" onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Stack Layout</Title>
        <Text c="dimmed" size="sm">
          Visual layout of stacks inside a store
        </Text>
      </div>

      <Group>
        <Select
          label="Store"
          placeholder="Select store"
          data={storeOptions}
          value={storeId}
          onChange={setStoreId}
          w={280}
          clearable
        />
      </Group>

      {!selectedStore ? (
        <Text c="dimmed">Select a store to view stack layout.</Text>
      ) : (
        <Card withBorder padding="md">
          <Text size="sm" mb="sm">
            {selectedStore.name} - {selectedStore.length}m x {selectedStore.width}m
          </Text>

          <div
            style={{
              position: 'relative',
              width: selectedStore.length * scale,
              height: selectedStore.width * scale,
              border: '1px solid #D0D0D0',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #fafafa 0%, #f2f2f2 100%)',
              overflow: 'hidden',
            }}
          >
            {storeStacks.map((stack) => {
              const left = (stack.start_x || 0) * scale;
              const top = (stack.start_y || 0) * scale;
              const width = (stack.length || 1) * scale;
              const height = (stack.width || 1) * scale;
              const filled = stack.quantity > 0;
              return (
                <div
                  key={stack.id}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width,
                    height,
                    border: '1px solid #1c7ed6',
                    background: filled ? 'rgba(28, 126, 214, 0.18)' : 'rgba(173, 181, 189, 0.2)',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: '#1c1c1c',
                    padding: 4,
                    textAlign: 'center',
                  }}
                  title={`${stack.code} (${stack.quantity})`}
                >
                  <Badge size="xs" variant="light">
                    {stack.code}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </Stack>
  );
}
