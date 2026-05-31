import React, { useState, useEffect } from 'react';
import { Modal, Button, Textarea, Stack as MantineStack, Group, Alert } from '@mantine/core';
import { SearchableSelect } from '../common/SearchableSelect';
import { IconAlertCircle } from '@tabler/icons-react';
import type { Stack } from '../../types/stack';
import type { Store } from '../../types/store';
import { getStores } from '../../api/stores';
import { createTransferRequest } from '../../api/transferRequests';
import { useAuthStore } from '../../store/authStore';
import { useStackTransferForm } from '../../hooks/useStackTransferForm';
import StackTransferQuantitySection from './StackTransferQuantitySection';

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
  const [reason, setReason] = useState<string>('');
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transferForm = useStackTransferForm(sourceStack, opened);

  useEffect(() => {
    if (opened) {
      setDestinationStoreId(null);
      setReason('');
      setError(null);
      loadAvailableStores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const loadAvailableStores = async () => {
    try {
      const activeAssignment = useAuthStore.getState().activeAssignment;
      const userWarehouseId = activeAssignment?.warehouse?.id;

      const stores = userWarehouseId
        ? await getStores({ warehouse_id: userWarehouseId })
        : await getStores();

      const filtered = stores.filter(
        (store) =>
          store.id !== sourceStack.store_id &&
          store.warehouse_id === sourceStack.warehouse_id
      );
      setAvailableStores(filtered);
    } catch (err) {
      console.error('Failed to load stores:', err);
      setError('Failed to load available stores');
    }
  };

  const handleSubmit = async () => {
    if (!destinationStoreId || !reason.trim()) {
      setError('Please fill in all fields');
      return;
    }

    const validationError = transferForm.validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = transferForm.buildSubmitPayload();
    if (!payload) {
      setError('Unable to build transfer payload');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createTransferRequest({
        source_stack_id: sourceStack.id,
        destination_store_id: parseInt(destinationStoreId, 10),
        reason: reason.trim(),
        ...payload,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Failed to create transfer request');
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
        <StackTransferQuantitySection sourceStack={sourceStack} form={transferForm} />

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
            <SearchableSelect
              label="Destination store"
              placeholder="Select destination store"
              data={storeOptions}
              value={destinationStoreId}
              onChange={setDestinationStoreId}
              required
              searchable
            />

            <Textarea
              label="Reason for transfer"
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
          {transferForm.canSubmit && (
            <Button
              onClick={handleSubmit}
              loading={loading}
              disabled={availableStores.length === 0 || !destinationStoreId || !reason.trim()}
            >
              Submit Request
            </Button>
          )}
        </Group>
      </MantineStack>
    </Modal>
  );
};

export default TransferRequestModal;
