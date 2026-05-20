import type { Stack } from '../types/stack';
import type { CommodityReference, UnitReference, UomConversion } from '../types/referenceData';
import {
  conversionCommodityId,
  convertQuantityToTargetUnit,
  findDirectedMultiplier,
} from './uomConversions';
import {
  computePackagingPackagesHint,
  formatPackagingPerContainer,
} from './packagingQuantityHint';

export function formatUnitReferenceLabel(unit: UnitReference): string {
  const name = (unit.name ?? '').trim();
  const abbr = (unit.abbreviation ?? '').trim();
  if (name && abbr && name.toLowerCase() !== abbr.toLowerCase()) {
    return `${name} (${abbr})`;
  }
  return name || abbr || `Unit ${unit.id}`;
}

export function formatStackUnitLabel(stack: Stack): string {
  const name = (stack.unit_name ?? '').trim();
  const abbr = (stack.unit_abbreviation ?? '').trim();
  if (name && abbr && name.toLowerCase() !== abbr.toLowerCase()) {
    return `${name} (${abbr})`;
  }
  return name || abbr || 'units';
}

export function findCommodityReference(
  commodities: CommodityReference[],
  commodityId: number | null | undefined
): CommodityReference | undefined {
  if (commodityId == null) return undefined;
  return commodities.find((c) => c.id === Number(commodityId));
}

export function getConvertibleUnitOptions(
  stack: Stack,
  units: UnitReference[],
  uomConversions: UomConversion[]
): { value: string; label: string }[] {
  const stackUnitId = stack.unit_id;
  const commodityId = conversionCommodityId(stack.commodity_id);

  const stackUnit = units.find((u) => u.id === stackUnitId);
  const stackOption = {
    value: String(stackUnitId),
    label: stackUnit ? formatUnitReferenceLabel(stackUnit) : formatStackUnitLabel(stack),
  };

  const convertible = units
    .filter((unit) => {
      if (unit.id === stackUnitId) return true;
      return (
        findDirectedMultiplier(unit.id, stackUnitId, commodityId, uomConversions) != null ||
        findDirectedMultiplier(stackUnitId, unit.id, commodityId, uomConversions) != null
      );
    })
    .map((unit) => ({
      value: String(unit.id),
      label: formatUnitReferenceLabel(unit),
    }));

  const seen = new Set<string>();
  return [stackOption, ...convertible].filter((opt) => {
    if (seen.has(opt.value)) return false;
    seen.add(opt.value);
    return true;
  });
}

export function convertStackQtyToUnit(
  qtyInStackUnit: number,
  stack: Stack,
  targetUnitId: number,
  uomConversions: UomConversion[]
): number | null {
  if (!stack.unit_id) return null;
  if (stack.unit_id === targetUnitId) return qtyInStackUnit;
  const commodityId = conversionCommodityId(stack.commodity_id);
  return convertQuantityToTargetUnit(
    qtyInStackUnit,
    stack.unit_id,
    targetUnitId,
    commodityId,
    uomConversions
  );
}

export function convertEnteredQtyToStackUnit(
  enteredQty: number,
  enteredUnitId: number,
  stack: Stack,
  uomConversions: UomConversion[]
): number | null {
  if (!stack.unit_id) return null;
  if (enteredUnitId === stack.unit_id) return enteredQty;
  const commodityId = conversionCommodityId(stack.commodity_id);
  return convertQuantityToTargetUnit(
    enteredQty,
    enteredUnitId,
    stack.unit_id,
    commodityId,
    uomConversions
  );
}

export function packagingContextFromCommodity(commodity: CommodityReference | undefined) {
  if (!commodity) {
    return {
      packagingSize: null as number | null,
      containerLabel: null as string | null,
      perPackageUnitName: null as string | null,
      packageSpec: null as string | null,
    };
  }

  const packagingSize =
    commodity.package_size != null && Number(commodity.package_size) > 0
      ? Number(commodity.package_size)
      : null;
  const containerLabel =
    (commodity.package_unit_name ?? '').trim() ||
    (commodity.unit_abbreviation ?? '').trim() ||
    null;
  const perPackageUnitName = (commodity.package_unit_per_package_name ?? '').trim() || null;

  const packageSpec = formatPackagingPerContainer(
    packagingSize,
    perPackageUnitName,
    containerLabel
  );

  return { packagingSize, containerLabel, perPackageUnitName, packageSpec };
}

/** Weight/volume unit that one package_size refers to (e.g. 50 kg per bag). */
export function resolvePackagingBasisUnitId(
  commodity: CommodityReference | undefined,
  units: UnitReference[]
): number | null {
  if (commodity?.package_unit_per_package_id) {
    return commodity.package_unit_per_package_id;
  }
  if (commodity?.package_unit_per_package_name) {
    const nameUpper = commodity.package_unit_per_package_name.toUpperCase();
    const match = units.find(
      (u) =>
        (u.abbreviation ?? '').toUpperCase() === nameUpper ||
        u.name.toUpperCase() === nameUpper
    );
    if (match) return match.id;
  }
  const kg = units.find((u) => (u.abbreviation ?? '').toLowerCase() === 'kg');
  return kg?.id ?? commodity?.unit_id ?? null;
}

export function quantityPackagingSummary(params: {
  qty: number;
  stack: Stack;
  commodity?: CommodityReference;
  units: UnitReference[];
  uomConversions: UomConversion[];
  displayUnitId?: number;
}): {
  quantityLine: string;
  packagesLine: string | null;
  packageSpec: string | null;
  packageCount: number | null;
} {
  const { qty, stack, commodity, units, uomConversions, displayUnitId } = params;
  const targetUnitId = displayUnitId ?? stack.unit_id;
  const displayUnit = units.find((u) => u.id === targetUnitId);
  const unitLabel = displayUnit
    ? formatUnitReferenceLabel(displayUnit)
    : formatStackUnitLabel(stack);

  let qtyInDisplayUnit = qty;
  if (targetUnitId && stack.unit_id && targetUnitId !== stack.unit_id) {
    const converted = convertStackQtyToUnit(qty, stack, targetUnitId, uomConversions);
    if (converted == null) {
      return {
        quantityLine: `${qty.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${formatStackUnitLabel(stack)}`,
        packagesLine: null,
        packageSpec: null,
        packageCount: null,
      };
    }
    qtyInDisplayUnit = converted;
  }

  const quantityLine =
    qtyInDisplayUnit > 0
      ? `${qtyInDisplayUnit.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${unitLabel}`
      : `0 ${unitLabel}`;

  const { packagingSize, containerLabel, perPackageUnitName, packageSpec } =
    packagingContextFromCommodity(commodity);

  if (!packagingSize || !containerLabel || qtyInDisplayUnit <= 0) {
    return { quantityLine, packagesLine: null, packageSpec, packageCount: null };
  }

  const packagingBasisUnitId = resolvePackagingBasisUnitId(commodity, units);

  const hint = computePackagingPackagesHint({
    qty: qtyInDisplayUnit,
    destUnitId: targetUnitId ?? stack.unit_id ?? commodity?.unit_id ?? null,
    commodityId: conversionCommodityId(stack.commodity_id ?? commodity?.id),
    packagingSize,
    packagingUnitLabel: containerLabel,
    packageUnitPerPackageNumericId: packagingBasisUnitId,
    packageUnitPerPackageName: perPackageUnitName,
    fallbackBatchUnitNumericId: packagingBasisUnitId ?? commodity?.unit_id ?? null,
    units,
    uomConversions,
  });

  if (!hint) {
    return { quantityLine, packagesLine: null, packageSpec, packageCount: null };
  }

  const packageCount = Number(hint.packagesFormatted.replace(/,/g, ''));
  const packagesLine = hint.isWholeNumber
    ? `${packageCount.toLocaleString()} ${hint.containerLabel}`
    : `≈ ${hint.packagesFormatted} ${hint.containerLabel}`;

  return {
    quantityLine,
    packagesLine,
    packageSpec,
    packageCount: Number.isFinite(packageCount) ? packageCount : null,
  };
}

export function formatStackTransferOptionLabel(
  stack: Stack,
  commodity: CommodityReference | undefined,
  units: UnitReference[],
  uomConversions: UomConversion[]
): string {
  const qty = Number(stack.quantity) || 0;
  const head = `${stack.code} — ${stack.commodity_name?.trim() || 'Empty bay'}`;
  if (qty <= 0) {
    return `${head} (empty bay — available)`;
  }

  const { quantityLine, packagesLine } = quantityPackagingSummary({
    qty,
    stack,
    commodity,
    units,
    uomConversions,
  });

  if (packagesLine) {
    return `${head} · ${quantityLine} · ${packagesLine}`;
  }
  return `${head} · ${quantityLine}`;
}

export function isStackEligibleTransferDestination(
  stack: Stack,
  sourceStack: Stack
): boolean {
  if (stack.id === sourceStack.id) return false;
  if (stack.store_id !== sourceStack.store_id) return false;

  const qty = Number(stack.quantity) || 0;
  if (qty <= 0) return true;

  const sourceCid =
    sourceStack.commodity_id != null ? Number(sourceStack.commodity_id) : null;
  const destCid = stack.commodity_id != null ? Number(stack.commodity_id) : null;

  if (sourceCid != null && destCid != null) return destCid === sourceCid;

  const na = (sourceStack.commodity_name ?? '').trim().toLowerCase();
  const nb = (stack.commodity_name ?? '').trim().toLowerCase();
  return Boolean(na && nb && na === nb);
}
