import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Select,
  Stack as MantineStack,
  Group,
  Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { Stack } from '../../types/stack';
import type { CommodityReference, UnitReference, UomConversion } from '../../types/referenceData';
import { getStacks, transferStack } from '../../api/stacks';
import { getCommodityReferences, getUnitReferences, getUomConversions } from '../../api/referenceData';
import {
  findCommodityReference,
  formatStackTransferOptionLabel,
  isStackEligibleTransferDestination,
} from '../../utils/stackPackagingDisplay';
import { useStackTransferForm } from '../../hooks/useStackTransferForm';
import StackTransferQuantitySection from './StackTransferQuantitySection';

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
  const [availableStacks, setAvailableStacks] = useState<Stack[]>([]);
  const [commodities, setCommodities] = useState<CommodityReference[]>([]);
  const [units, setUnits] = useState<UnitReference[]>([]);
  const [uomConversions, setUomConversions] = useState<UomConversion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transferForm = useStackTransferForm(sourceStack, opened);

  useEffect(() => {
    if (opened) {
      setDestinationStackId(null);
      setError(null);
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, sourceStack.id, sourceStack.store_id]);

  const loadData = async () => {
    try {
      const [stacks, commodityRefs, unitRefs, conversionRefs] = await Promise.all([
        getStacks({ store_id: sourceStack.store_id }),
        getCommodityReferences(),
        getUnitReferences(),
        getUomConversions(),
      ]);

      setCommodities(commodityRefs);
      setUnits(unitRefs);
      setUomConversions(conversionRefs);

      const filtered = stacks.filter((stack) =>
        isStackEligibleTransferDestination(stack, sourceStack)
      );
      setAvailableStacks(filtered);
    } catch (err) {
      console.error('Failed to load stacks:', err);
      setError('Failed to load available stacks');
    }
  };

  const handleSubmit = async () => {
    if (!destinationStackId) {
      setError('Please select a destination stack');
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
      await transferStack(sourceStack.id, {
        destination_id: parseInt(destinationStackId, 10),
        ...payload,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Failed to transfer stack');
    } finally {
      setLoading(false);
    }
  };

  const stackOptions = availableStacks.map((stack) => {
    const commodity = findCommodityReference(commodities, stack.commodity_id);
    return {
      value: stack.id.toString(),
      label: formatStackTransferOptionLabel(stack, commodity, units, uomConversions),
    };
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Transfer Stack" size="md" radius="xl" centered>
      <MantineStack gap="md">
        <StackTransferQuantitySection sourceStack={sourceStack} form={transferForm} />

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
            {error}
          </Alert>
        )}

        {availableStacks.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title="No Compatible Stacks" color="blue">
            No compatible destination stacks in this store. Choose an empty bay or a stack that already
            holds the same commodity.
          </Alert>
        ) : (
          <Select
            label="Destination stack"
            placeholder="Select destination stack"
            data={stackOptions}
            value={destinationStackId}
            onChange={setDestinationStackId}
            required
            searchable
            description="Empty bays and stacks with the same commodity are shown."
          />
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {transferForm.canSubmit && (
            <Button
              onClick={handleSubmit}
              loading={loading}
              disabled={availableStacks.length === 0 || !destinationStackId}
            >
              Transfer
            </Button>
          )}
        </Group>
      </MantineStack>
    </Modal>
  );
};

export default StackTransferModal;
