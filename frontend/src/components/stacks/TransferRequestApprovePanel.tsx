import { useEffect, useMemo } from 'react';

import { Alert, Select, Stack as MantineStack, Text, Textarea } from '@mantine/core';

import { IconAlertCircle } from '@tabler/icons-react';

import type { Stack } from '../../types/stack';

import type { TransferRequest } from '../../api/transferRequests';

import { useStackTransferForm } from '../../hooks/useStackTransferForm';

import StackTransferQuantitySection from './StackTransferQuantitySection';

import {

  convertStackQtyToUnit,

  findCommodityReference,

  formatStackTransferOptionLabel,

  quantityPackagingSummary,

} from '../../utils/stackPackagingDisplay';



interface TransferRequestApprovePanelProps {

  request: TransferRequest;

  sourceStack: Stack;

  destinationStacks: Stack[];

  destinationStackId: string | null;

  onDestinationStackIdChange: (value: string | null) => void;

  notes: string;

  onNotesChange: (value: string) => void;

  onFormReady: (form: ReturnType<typeof useStackTransferForm>, canApprove: boolean) => void;

}



const numberFormatter = new Intl.NumberFormat('en-US', {

  minimumFractionDigits: 2,

  maximumFractionDigits: 2,

});



function resolveRemaining(request: TransferRequest): number {

  if (request.remaining_quantity != null) return request.remaining_quantity;

  const fulfilled = request.fulfilled_quantity ?? 0;

  const rejected = request.rejected_quantity ?? 0;

  return Math.max(0, request.quantity - fulfilled - rejected);

}



export default function TransferRequestApprovePanel({

  request,

  sourceStack,

  destinationStacks,

  destinationStackId,

  onDestinationStackIdChange,

  notes,

  onNotesChange,

  onFormReady,

}: TransferRequestApprovePanelProps) {

  const remainingQty = resolveRemaining(request);

  const fulfilledQty = request.fulfilled_quantity ?? 0;

  const rejectedQty = request.rejected_quantity ?? 0;



  const initial = useMemo(
    () => ({
      selectedUnitId: String(request.entered_unit?.id ?? request.unit.id),
      quantity: remainingQty > 0 ? String(remainingQty) : '',
    }),
    [
      request.id,
      request.fulfilled_quantity,
      request.rejected_quantity,
      remainingQty,
      request.entered_unit?.id,
      request.unit.id,
    ]
  );

  const transferForm = useStackTransferForm(sourceStack, true, initial, {
    maxCanonicalQty: remainingQty,
    maxCanonicalLabel: 'remaining on this request',
  });

  const { units, uomConversions, canonicalQty, commodities } = transferForm;



  const selectedDestStack = useMemo(

    () =>

      destinationStackId

        ? destinationStacks.find((s) => s.id === parseInt(destinationStackId, 10))

        : undefined,

    [destinationStackId, destinationStacks]

  );



  const destCreditPreview = useMemo(() => {

    if (!selectedDestStack?.unit_id || canonicalQty == null) return null;



    const creditQty = convertStackQtyToUnit(

      canonicalQty,

      sourceStack,

      selectedDestStack.unit_id,

      uomConversions

    );

    if (creditQty == null) {

      return { error: 'No unit conversion is configured between the transfer amount and the destination stack unit.' };

    }



    const destCommodity = findCommodityReference(commodities, selectedDestStack.commodity_id ?? request.commodity.id);

    const summary = quantityPackagingSummary({

      qty: creditQty,

      stack: { ...selectedDestStack, quantity: creditQty },

      commodity: destCommodity,

      units,

      uomConversions,

      displayUnitId: selectedDestStack.unit_id,

    });



    return { creditQty, summary, error: null as string | null };

  }, [selectedDestStack, canonicalQty, sourceStack, uomConversions, commodities, units, request.commodity.id]);



  const canApprove =

    remainingQty > 0 &&

    transferForm.canSubmit &&

    (!destinationStackId || (destCreditPreview != null && !destCreditPreview.error));



  useEffect(() => {

    onFormReady(transferForm, canApprove);

  }, [transferForm, canApprove, onFormReady]);



  const stackOptions = destinationStacks.map((stack) => {

    const stackCommodity = findCommodityReference(commodities, stack.commodity_id ?? request.commodity.id);

    return {

      value: stack.id.toString(),

      label: formatStackTransferOptionLabel(stack, stackCommodity, units, uomConversions),

    };

  });



  const storekeeperQty =

    request.entered_quantity != null

      ? `${numberFormatter.format(request.entered_quantity)} ${request.entered_unit?.abbreviation || request.entered_unit?.name || request.unit.abbreviation}`

      : `${numberFormatter.format(request.quantity)} ${request.unit.abbreviation}`;



  return (

    <MantineStack gap="md">

      <Alert icon={<IconAlertCircle size={16} />} title="Request progress" color="blue" variant="light">

        <Text size="sm">

          <strong>Requested:</strong> {numberFormatter.format(request.quantity)} {request.unit.abbreviation}

        </Text>

        <Text size="sm">

          <strong>Transferred so far:</strong> {numberFormatter.format(fulfilledQty)} {request.unit.abbreviation}

        </Text>

        {rejectedQty > 0 && (

          <Text size="sm">

            <strong>Rejected:</strong> {numberFormatter.format(rejectedQty)} {request.unit.abbreviation}

          </Text>

        )}

        <Text size="sm" fw={600}>

          <strong>Remaining open:</strong> {numberFormatter.format(remainingQty)} {request.unit.abbreviation}

        </Text>

        <Text size="xs" c="dimmed" mt={4}>

          The request stays pending until the remaining quantity is transferred or rejected.

        </Text>

      </Alert>



      <Alert icon={<IconAlertCircle size={16} />} title="Original request" color="gray" variant="light">

        <Text size="sm">

          <strong>From:</strong> {request.source_store.name} (Stack: {request.source_stack.code})

        </Text>

        <Text size="sm">

          <strong>To:</strong> {request.destination_store.name}

        </Text>

        <Text size="sm">

          <strong>Commodity:</strong> {request.commodity.name}

        </Text>

        <Text size="sm">

          <strong>Storekeeper requested:</strong> {storekeeperQty}

          {request.package_count != null && request.package_count > 0

            ? ` · ${numberFormatter.format(request.package_count)} packages`

            : ''}

        </Text>

        <Text size="sm">

          <strong>Reason:</strong> {request.reason}

        </Text>

      </Alert>



      {request.allocations && request.allocations.length > 0 && (

        <Alert title="History" color="gray" variant="outline">

          <MantineStack gap={4}>

            {request.allocations.map((row) => (

              <Text key={row.id} size="xs">

                {row.action === 'fulfillment' ? 'Transferred' : 'Rejected'}{' '}

                {numberFormatter.format(row.quantity)} {request.unit.abbreviation}

                {row.destination_stack ? ` → ${row.destination_stack.code}` : ''}

                {row.notes ? ` — ${row.notes}` : ''}

              </Text>

            ))}

          </MantineStack>

        </Alert>

      )}



      <StackTransferQuantitySection

        sourceStack={sourceStack}

        form={transferForm}

        quantityLabel="Quantity for this transfer"

      />



      <Select

        label="Destination stack (optional)"

        placeholder="Auto-select empty bay or create stack if not selected"

        data={stackOptions}

        value={destinationStackId}

        onChange={onDestinationStackIdChange}

        searchable

        clearable

        description="Empty bays and stacks with the same commodity are shown. Leave blank to auto-pick."

      />



      {selectedDestStack && destCreditPreview?.error && (

        <Alert color="red" title="Destination unit conversion">

          {destCreditPreview.error}

        </Alert>

      )}



      {selectedDestStack && destCreditPreview && !destCreditPreview.error && destCreditPreview.summary && (

        <Alert color="teal" variant="light" title="Destination will receive">

          <MantineStack gap={4}>

            <Text size="sm">{destCreditPreview.summary.quantityLine}</Text>

            {destCreditPreview.summary.packagesLine && (

              <Text size="sm" fw={600}>

                {destCreditPreview.summary.packagesLine}

              </Text>

            )}

            {destCreditPreview.summary.packageSpec && (

              <Text size="xs" c="dimmed">

                In destination stack unit ({selectedDestStack.unit_abbreviation || selectedDestStack.unit_name}).

                {destCreditPreview.summary.packageSpec ? ` Based on ${destCreditPreview.summary.packageSpec}.` : ''}

              </Text>

            )}

          </MantineStack>

        </Alert>

      )}



      {!destinationStackId && (

        <Text size="xs" c="dimmed">

          If no stack is selected, the system will use an empty bay or create a new stack in the destination

          store using the source unit.

        </Text>

      )}



      <Textarea

        label="Notes for this action (optional)"

        value={notes}

        onChange={(e) => onNotesChange(e.target.value)}

        minRows={2}

        placeholder="Notes for this transfer tranche..."

      />

    </MantineStack>

  );

}

