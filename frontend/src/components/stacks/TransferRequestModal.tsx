import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Select,
  TextInput,
  Textarea,
  Stack as MantineStack,
  Text,
  Box,
  Group,
  Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { Stack } from '../../types/stack';
import type { Store } from '../../types/store';
import { getStores } from '../../api/stores';
import { createTransferRequest } from '../../api/transferRequests';
import { useAuthStore } from '../../store/authStore';

interface TransferRequestModalProps {
  opened: boolean;
  onClose: () => void;
  sourceStack: Stack;
  onSuccess: () => void;
}

const TransferRequestModal: React.FC<TransferRequestModalProps> = ({
  opened,
  onClose,
  sourceStack,
  onSuccess,
}) => {
  const [destinationStoreId, setDestinationStoreId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setQuantity('');
      setDestinationStoreId(null);
      setReason('');
      setError(null);
      loadAvailableStores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const loadAvailableStores = async () => {
    try {
      // Get stores filtered by warehouse context if user is a warehouse manager
      const activeAssignment = useAuthStore.getState().activeAssignment;
      const userWarehouseId = activeAssignment?.warehouse?.id;
      
      const stores = userWarehouseId 
        ? await getStores({ warehouse_id: userWarehouseId })
        : await getStores();
        
      console.log('All stores:', stores);
      console.log('Source stack:', sourceStack);
      console.log('Source stack store_id:', sourceStack.store_id);
      console.log('Source stack warehouse_id:', sourceStack.warehouse_id);
      
      // Filter: different store, same warehouse
      const filtered = stores.filter(
        (store) => {
          const isDifferentStore = store.id !== sourceStack.store_id;
          const isSameWarehouse = store.warehouse_id === sourceStack.warehouse_id;
          console.log(`Store ${store.name}: isDifferentStore=${isDifferentStore}, isSameWarehouse=${isSameWarehouse}`);
          return isDifferentStore && isSameWarehouse;
        }
      );
      console.log('Filtered stores:', filtered);
      setAvailableStores(filtered);
    } catch (err) {
      console.error('Failed to load stores:', err);
      setError('Failed to load available stores');
    }
  };

  const handleSubmit = async () => {
    if (!destinationStoreId || !quantity || !reason.trim()) {
      setError('Please fill in all fields');
      return;
    }

    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      setError('Quantity must be a positive number');
      return;
    }

    if (quantityNum > sourceStack.quantity) {
      setError(`Quantity cannot exceed available quantity (${sourceStack.quantity})`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createTransferRequest({
        source_stack_id: sourceStack.id,
        destination_store_id: parseInt(destinationStoreId),
        quantity: quantityNum,
        reason: reason.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create transfer request');
    } finally {
      setLoading(false);
    }
  };

  const storeOptions = availableStores.map((store) => ({
    value: store.id.toString(),
    label: `${store.name} (${store.code})`,
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Request Store-to-Store Transfer"
      size="md"
      radius="xl"
      centered
    >
      <MantineStack gap="md">
        {/* Source Stack Info */}
        <Box p="md" style={{ backgroundColor: '#f8f9fa', borderRadius: 8 }}>
          <Text size="sm" fw={700} c="dimmed" mb="xs">
            Source Stack
          </Text>
          <Text size="sm">
            <strong>Code:</strong> {sourceStack.code}
          </Text>
          <Text size="sm">
            <strong>Commodity:</strong> {sourceStack.commodity_name}
          </Text>
          <Text size="sm">
            <strong>Store:</strong> {sourceStack.store_name}
          </Text>
          <Text size="sm">
            <strong>Available Quantity:</strong> {sourceStack.quantity} {sourceStack.unit_abbreviation}
          </Text>
        </Box>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
            {error}
          </Alert>
        )}

        {availableStores.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title="No Other Stores" color="blue">
            No other stores available in this warehouse for transfer.
          </Alert>
        ) : (
          <>
            <Select
              label="Destination Store"
              placeholder="Select destination store"
              data={storeOptions}
              value={destinationStoreId}
              onChange={setDestinationStoreId}
              required
              searchable
            />

            <TextInput
              label="Quantity to Transfer"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              min={0}
              max={sourceStack.quantity}
              step={0.001}
              description={`Maximum: ${sourceStack.quantity} ${sourceStack.unit_abbreviation}`}
            />

            <Textarea
              label="Reason for Transfer"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minRows={3}
              placeholder="Explain why this transfer is needed..."
            />
          </>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={availableStores.length === 0}
          >
            Submit Request
          </Button>
        </Group>
      </MantineStack>
    </Modal>
  );
};

export default TransferRequestModal;
