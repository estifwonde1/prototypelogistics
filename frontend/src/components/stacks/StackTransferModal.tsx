import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Select,
  TextInput,
  Stack as MantineStack,
  Text,
  Box,
  Group,
  Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { Stack } from '../../types/stack';
import { getStacks, transferStack } from '../../api/stacks';

interface StackTransferModalProps {
  opened: boolean;
  onClose: () => void;
  sourceStack: Stack;
  onSuccess: () => void;
}

const StackTransferModal: React.FC<StackTransferModalProps> = ({
  opened,
  onClose,
  sourceStack,
  onSuccess,
}) => {
  const [destinationStackId, setDestinationStackId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [availableStacks, setAvailableStacks] = useState<Stack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setQuantity('');
      setDestinationStackId(null);
      setError(null);
      loadAvailableStacks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, sourceStack.id, sourceStack.store_id]);

  const loadAvailableStacks = async () => {
    try {
      // Load stacks in the source store only (authoritative destination list — avoids mismatched WM vs store scope).
      const stacks = await getStacks({ store_id: sourceStack.store_id });

      const cid = (v: Stack['commodity_id']) =>
        v != null && v !== '' ? Number(v) : null;
      const sourceCid = cid(sourceStack.commodity_id);

      const nameMatch = (a?: string | null, b?: string | null) => {
        const na = (a ?? '').trim().toLowerCase();
        const nb = (b ?? '').trim().toLowerCase();
        return Boolean(na && nb && na === nb);
      };

      const qty = (stack: Stack) => Number(stack.quantity) || 0;

      /** Stack already carries the same commodity (by ID or resolved name). */
      const isCompatibleDestination = (stack: Stack) => {
        if (stack.id === sourceStack.id) return false;

        const destCid = cid(stack.commodity_id);

        if (sourceCid != null && destCid != null) return destCid === sourceCid;
        return nameMatch(stack.commodity_name, sourceStack.commodity_name);
      };

      /** Reserved / vacant bay with no SKU on file — backend assigns commodity + unit from source on transfer-in. */
      const isEmptyBay = (stack: Stack) =>
        qty(stack) <= 0 && (stack.commodity_id == null || stack.commodity_id === '' || cid(stack.commodity_id) == null);

      const filtered = stacks.filter(
        (stack) =>
          stack.id !== sourceStack.id &&
          stack.store_id === sourceStack.store_id &&
          (isCompatibleDestination(stack) || isEmptyBay(stack))
      );
      setAvailableStacks(filtered);
    } catch (err) {
      console.error('Failed to load stacks:', err);
      setError('Failed to load available stacks');
    }
  };

  const handleSubmit = async () => {
    if (!destinationStackId || !quantity) {
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
      await transferStack(sourceStack.id, {
        destination_id: parseInt(destinationStackId),
        quantity: quantityNum,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to transfer stack');
    } finally {
      setLoading(false);
    }
  };

  const stackOptions = availableStacks.map((stack) => {
    const qtyN = Number(stack.quantity) || 0;
    const head = `${stack.code} — ${stack.commodity_name?.trim() || 'Empty bay'}`;
    const u = stack.unit_abbreviation?.trim();
    const tail = qtyN > 0 && u ? `${qtyN.toLocaleString()} ${u}` : qtyN > 0 ? String(qtyN) : '0 (available)';
    return { value: stack.id.toString(), label: `${head} (${tail})` };
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Transfer Stack" size="md" radius="xl" centered>
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

        {availableStacks.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title="No Compatible Stacks" color="blue">
            No compatible destination stacks in this store. Choose a stack that is empty (no stock / reserved bay) or already
            holds the same commodity. If you expected another Beans stack here, refresh the list or confirm it is under the same store.
          </Alert>
        ) : (
          <>
            <Select
              label="Destination Stack"
              placeholder="Select destination stack"
              data={stackOptions}
              value={destinationStackId}
              onChange={setDestinationStackId}
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
          </>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={availableStacks.length === 0}
          >
            Transfer
          </Button>
        </Group>
      </MantineStack>
    </Modal>
  );
};

export default StackTransferModal;
