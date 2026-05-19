import { Alert, Box, Select, Stack as MantineStack, Text, TextInput } from '@mantine/core';
import type { Stack } from '../../types/stack';
import type { useStackTransferForm } from '../../hooks/useStackTransferForm';

type TransferForm = ReturnType<typeof useStackTransferForm>;

interface StackTransferQuantitySectionProps {
  sourceStack: Stack;
  form: TransferForm;
  quantityLabel?: string;
}

export default function StackTransferQuantitySection({
  sourceStack,
  form,
  quantityLabel = 'Quantity to transfer',
}: StackTransferQuantitySectionProps) {
  const {
    selectedUnitId,
    setSelectedUnitId,
    quantity,
    setQuantity,
    unitOptions,
    availableSummary,
    transferSummary,
    remainingSummary,
    maxInSelectedUnit,
    exceedsMax,
    quantityError,
    hasPackaging,
    containerLabel,
    packageSpec,
    cappedByRequest,
  } = form;

  const selectedLabel =
    unitOptions.find((o) => o.value === selectedUnitId)?.label ?? 'selected unit';

  const quantityExceeds = exceedsMax;
  const maxHint =
    maxInSelectedUnit != null
      ? cappedByRequest
        ? `Maximum for this request: ${maxInSelectedUnit.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${selectedLabel}`
        : `Maximum: ${maxInSelectedUnit.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${selectedLabel}`
      : `Enter quantity in ${selectedLabel}`;

  const quantityErrorMessage =
    quantityExceeds && maxInSelectedUnit != null
      ? cappedByRequest
        ? `Cannot transfer more than ${maxInSelectedUnit.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${selectedLabel} (remaining on this request)`
        : `Cannot exceed ${maxInSelectedUnit.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${selectedLabel}`
      : quantityError && quantity.trim() !== '' && !quantityExceeds
        ? quantityError
        : undefined;

  return (
    <>
      <Box p="md" style={{ backgroundColor: '#f8f9fa', borderRadius: 8 }}>
        <Text size="sm" fw={700} c="dimmed" mb="xs">
          Source stack
        </Text>
        <Text size="sm">
          <strong>Code:</strong> {sourceStack.code}
        </Text>
        <Text size="sm">
          <strong>Commodity:</strong> {sourceStack.commodity_name || '—'}
        </Text>
        <Text size="sm">
          <strong>Store:</strong> {sourceStack.store_name}
        </Text>
        {packageSpec && (
          <Text size="sm">
            <strong>Packaging:</strong> {packageSpec}
          </Text>
        )}
        <Text size="sm" mt={4}>
          <strong>Available to transfer:</strong> {availableSummary?.quantityLine ?? '—'}
          {availableSummary?.packagesLine ? (
            <>
              <br />
              <Text component="span" size="sm" c="dimmed">
                ({availableSummary.packagesLine} available)
              </Text>
            </>
          ) : null}
        </Text>
      </Box>

      <Select
        label="Unit of measure"
        description="Enter the transfer quantity in the unit you are working with (e.g. kg, mt, quintal)"
        data={unitOptions}
        value={selectedUnitId}
        onChange={setSelectedUnitId}
        required
        searchable
      />

      <TextInput
        label={quantityLabel}
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
        min={0}
        max={maxInSelectedUnit ?? undefined}
        step={0.001}
        error={quantityErrorMessage}
        description={maxHint}
        styles={
          quantityExceeds
            ? {
                description: { color: 'var(--mantine-color-red-6)', fontWeight: 600 },
                input: { borderColor: 'var(--mantine-color-red-6)' },
              }
            : undefined
        }
      />

      {enteredQtyShowsPackages(quantity, transferSummary, hasPackaging, containerLabel)}

      {transferSummary && (
        <Alert
          variant="light"
          color={quantityExceeds ? 'red' : 'blue'}
          title={
            quantityExceeds
              ? cappedByRequest
                ? 'Exceeds remaining on request'
                : 'Exceeds available stock'
              : 'Transfer amount'
          }
        >
          <MantineStack gap={4}>
            <Text size="sm" c={quantityExceeds ? 'red' : undefined}>
              {transferSummary.quantityLine}
            </Text>
            {transferSummary.packagesLine ? (
              <Text size="sm" fw={600} c={quantityExceeds ? 'red' : undefined}>
                {transferSummary.packagesLine}
              </Text>
            ) : hasPackaging ? (
              <Text size="xs" c="dimmed">
                Package count could not be calculated for this unit and packaging setup.
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                No bag/carton packaging on file for this commodity (set on the officer commodity batch).
              </Text>
            )}
            {quantityExceeds ? (
              <Text size="sm" c="red" fw={600}>
                Reduce the quantity to {maxHint.replace('Maximum: ', '')} or less to continue.
              </Text>
            ) : (
              remainingSummary && (
                <Text size="sm" c="dimmed">
                  {cappedByRequest ? 'Still open on request after this transfer' : 'Remaining on source stack after transfer'}
                  : {remainingSummary.quantityLine}
                  {remainingSummary.packagesLine ? ` · ${remainingSummary.packagesLine} left` : ''}
                </Text>
              )
            )}
            {!quantityExceeds && transferSummary.packageSpec && (
              <Text size="xs" c="dimmed">
                Based on {transferSummary.packageSpec}.
              </Text>
            )}
          </MantineStack>
        </Alert>
      )}
    </>
  );
}

function enteredQtyShowsPackages(
  quantity: string,
  transferSummary: ReturnType<typeof useStackTransferForm>['transferSummary'],
  hasPackaging: boolean,
  containerLabel: string | null
) {
  const parsed = parseFloat(quantity);
  if (!Number.isFinite(parsed) || parsed <= 0 || !hasPackaging || !transferSummary?.packagesLine) {
    return null;
  }
  return (
    <Text size="sm" c="dimmed">
      {parsed.toLocaleString(undefined, { maximumFractionDigits: 4 })} entered ≈ {transferSummary.packagesLine}
      {containerLabel ? ` (${containerLabel})` : ''}
    </Text>
  );
}
