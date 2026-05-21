import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Stack } from '../types/stack';
import {
  convertEnteredQtyToStackUnit,
  convertStackQtyToUnit,
  findCommodityReference,
  getConvertibleUnitOptions,
  packagingContextFromCommodity,
  quantityPackagingSummary,
} from '../utils/stackPackagingDisplay';
import { getCommodityReferences, getUnitReferences, getUomConversions } from '../api/referenceData';

export interface StackTransferSubmitPayload {
  quantity: number;
  entered_unit_id: number;
  entered_quantity: number;
  package_count?: number;
}

export interface StackTransferFormInitial {
  selectedUnitId?: string;
  quantity?: string;
}

export interface StackTransferFormLimits {
  /** Max quantity in source stack unit (e.g. remaining on transfer request). */
  maxCanonicalQty?: number | null;
  maxCanonicalLabel?: string;
}

export function useStackTransferForm(
  sourceStack: Stack | null,
  enabled = true,
  initial?: StackTransferFormInitial,
  limits?: StackTransferFormLimits
) {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');

  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
    enabled: enabled && sourceStack != null,
    staleTime: 5 * 60 * 1000,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: getUnitReferences,
    enabled: enabled && sourceStack != null,
    staleTime: 5 * 60 * 1000,
  });

  const { data: uomConversions = [] } = useQuery({
    queryKey: ['reference-data', 'uom_conversions'],
    queryFn: getUomConversions,
    enabled: enabled && sourceStack != null,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!sourceStack) return;
    const unitId = initial?.selectedUnitId ?? (sourceStack.unit_id ? String(sourceStack.unit_id) : null);
    setSelectedUnitId(unitId);
    setQuantity(initial?.quantity ?? '');
  }, [sourceStack?.id, sourceStack?.unit_id, initial?.selectedUnitId, initial?.quantity]);

  const commodity = useMemo(
    () => (sourceStack ? findCommodityReference(commodities, sourceStack.commodity_id) : undefined),
    [commodities, sourceStack]
  );

  const unitOptions = useMemo(
    () => (sourceStack ? getConvertibleUnitOptions(sourceStack, units, uomConversions) : []),
    [sourceStack, units, uomConversions]
  );

  const selectedUnitNumericId = selectedUnitId ? parseInt(selectedUnitId, 10) : null;

  const availableQtyStack = sourceStack ? Number(sourceStack.quantity) || 0 : 0;

  const effectiveMaxCanonical = useMemo(() => {
    const stackCap = availableQtyStack;
    const requestCap = limits?.maxCanonicalQty;
    if (requestCap == null || !Number.isFinite(requestCap)) return stackCap;
    return Math.min(stackCap, requestCap);
  }, [availableQtyStack, limits?.maxCanonicalQty]);

  const availableSummary = useMemo(() => {
    if (!sourceStack || availableQtyStack <= 0 || !selectedUnitNumericId) return null;
    return quantityPackagingSummary({
      qty: availableQtyStack,
      stack: sourceStack,
      commodity,
      units,
      uomConversions,
      displayUnitId: selectedUnitNumericId,
    });
  }, [sourceStack, availableQtyStack, commodity, units, uomConversions, selectedUnitNumericId]);

  const enteredQty = useMemo(() => {
    const parsed = parseFloat(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [quantity]);

  const canonicalQty = useMemo(() => {
    if (!sourceStack || enteredQty == null || !selectedUnitNumericId) return null;
    return convertEnteredQtyToStackUnit(
      enteredQty,
      selectedUnitNumericId,
      sourceStack,
      uomConversions
    );
  }, [sourceStack, enteredQty, selectedUnitNumericId, uomConversions]);

  const transferSummary = useMemo(() => {
    if (!sourceStack || enteredQty == null || !selectedUnitNumericId) return null;
    return quantityPackagingSummary({
      qty: enteredQty,
      stack: { ...sourceStack, quantity: enteredQty, unit_id: selectedUnitNumericId },
      commodity,
      units,
      uomConversions,
      displayUnitId: selectedUnitNumericId,
    });
  }, [sourceStack, enteredQty, commodity, units, uomConversions, selectedUnitNumericId]);

  const cappedByRequest = limits?.maxCanonicalQty != null;

  const remainingSummary = useMemo(() => {
    if (!sourceStack || canonicalQty == null || !selectedUnitNumericId) return null;
    const remainingQty = cappedByRequest
      ? Math.max(0, (limits?.maxCanonicalQty ?? 0) - canonicalQty)
      : Math.max(0, availableQtyStack - canonicalQty);
    if (remainingQty < 0) return null;
    return quantityPackagingSummary({
      qty: remainingQty,
      stack: sourceStack,
      commodity,
      units,
      uomConversions,
      displayUnitId: selectedUnitNumericId,
    });
  }, [
    sourceStack,
    canonicalQty,
    availableQtyStack,
    cappedByRequest,
    limits?.maxCanonicalQty,
    commodity,
    units,
    uomConversions,
    selectedUnitNumericId,
  ]);

  const { packagingSize, containerLabel, packageSpec } = packagingContextFromCommodity(commodity);
  const hasPackaging = packagingSize != null && packagingSize > 0 && Boolean(containerLabel);

  const maxInSelectedUnit = useMemo(() => {
    if (!sourceStack || !selectedUnitNumericId || effectiveMaxCanonical <= 0) return null;
    if (selectedUnitNumericId === sourceStack.unit_id) return effectiveMaxCanonical;
    return convertStackQtyToUnit(
      effectiveMaxCanonical,
      sourceStack,
      selectedUnitNumericId,
      uomConversions
    );
  }, [sourceStack, effectiveMaxCanonical, selectedUnitNumericId, uomConversions]);

  const exceedsMax = useMemo(() => {
    if (enteredQty == null || maxInSelectedUnit == null) return false;
    return enteredQty > maxInSelectedUnit + 1e-6;
  }, [enteredQty, maxInSelectedUnit]);

  const validate = (): string | null => {
    if (!sourceStack) return 'No source stack';
    if (!selectedUnitNumericId) return 'Select a unit of measure';
    if (enteredQty == null) return 'Enter a positive quantity';
    if (canonicalQty == null) {
      return 'No unit conversion is configured between the selected unit and the stack storage unit';
    }
    if (canonicalQty <= 0) return 'Quantity must be greater than zero';
    if (canonicalQty > effectiveMaxCanonical + 1e-6) {
      const capLabel = limits?.maxCanonicalLabel ?? 'available stock';
      return `Quantity exceeds ${capLabel} (${effectiveMaxCanonical} in stack unit)`;
    }
    return null;
  };

  const quantityError = useMemo(() => validate(), [
    sourceStack,
    selectedUnitNumericId,
    enteredQty,
    canonicalQty,
    effectiveMaxCanonical,
    limits?.maxCanonicalLabel,
  ]);

  const canSubmit = quantityError === null;

  const buildSubmitPayload = (): StackTransferSubmitPayload | null => {
    const err = validate();
    if (err || canonicalQty == null || !selectedUnitNumericId || enteredQty == null) return null;

    const pkg = transferSummary?.packageCount;

    return {
      quantity: canonicalQty,
      entered_unit_id: selectedUnitNumericId,
      entered_quantity: enteredQty,
      ...(pkg != null && Number.isFinite(pkg) && pkg > 0 ? { package_count: pkg } : {}),
    };
  };

  return {
    selectedUnitId,
    setSelectedUnitId,
    quantity,
    setQuantity,
    unitOptions,
    commodity,
    commodities,
    units,
    uomConversions,
    availableSummary,
    transferSummary,
    remainingSummary,
    canonicalQty,
    maxInSelectedUnit,
    exceedsMax,
    quantityError,
    canSubmit,
    hasPackaging,
    containerLabel,
    packageSpec,
    validate,
    buildSubmitPayload,
    cappedByRequest,
  };
}
