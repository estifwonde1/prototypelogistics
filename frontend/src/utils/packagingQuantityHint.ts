import type { UomConversion } from '../types/referenceData';
import { findDirectedMultiplier } from './uomConversions';

/** Human-readable packaging spec, e.g. "50 kg per BAG". */
export function formatPackagingPerContainer(
  packageSize: number | null | undefined,
  unitPerPackageName: string | null | undefined,
  containerLabel: string | null | undefined
): string | null {
  if (packageSize == null || packageSize <= 0 || !containerLabel?.trim()) return null;
  const unit = unitPerPackageName?.trim();
  const container = containerLabel.trim();
  if (unit) return `${packageSize} ${unit} per ${container}`;
  return `${packageSize} per ${container}`;
}

export interface PackagingPackagesHint {
  packageSpec: string;
  packagesFormatted: string;
  containerLabel: string;
  isWholeNumber: boolean;
}

/** Package count derived from quantity in an entered unit — matches officer RO destination logic. */
export function computePackagingPackagesHint(params: {
  qty: number;
  destUnitId: number | null;
  commodityId: number | null;
  packagingSize: number | null;
  packagingUnitLabel: string | null;
  packageUnitPerPackageNumericId: number | null;
  packageUnitPerPackageName: string | null;
  fallbackBatchUnitNumericId: number | null;
  units: Array<{ id: number; name: string; abbreviation?: string | null }>;
  uomConversions: UomConversion[];
}): PackagingPackagesHint | null {
  const {
    qty,
    destUnitId,
    commodityId,
    packagingSize,
    packagingUnitLabel,
    packageUnitPerPackageNumericId,
    packageUnitPerPackageName,
    fallbackBatchUnitNumericId,
    units,
    uomConversions,
  } = params;

  if (
    !qty ||
    qty <= 0 ||
    packagingSize == null ||
    packagingSize <= 0 ||
    !packagingUnitLabel?.trim()
  ) {
    return null;
  }

  let resolvedPkgUnitId = packageUnitPerPackageNumericId;
  if (!resolvedPkgUnitId && packageUnitPerPackageName) {
    const nameUpper = packageUnitPerPackageName.toUpperCase();
    const match = units.find(
      (u) =>
        (u.abbreviation ?? '').toUpperCase() === nameUpper ||
        u.name.toUpperCase() === nameUpper
    );
    resolvedPkgUnitId = match?.id ?? null;
  }

  if (resolvedPkgUnitId == null) {
    const kgUnit = units.find((u) => (u.abbreviation ?? '').toLowerCase() === 'kg');
    resolvedPkgUnitId = kgUnit?.id ?? fallbackBatchUnitNumericId ?? null;
  }
  if (resolvedPkgUnitId == null) return null;

  let qtyInPkgUnit = qty;
  const cid = commodityId ?? 0;

  if (destUnitId != null && destUnitId !== resolvedPkgUnitId) {
    let factor = findDirectedMultiplier(destUnitId, resolvedPkgUnitId, cid, uomConversions);
    if (factor == null) {
      const reverse = findDirectedMultiplier(resolvedPkgUnitId, destUnitId, cid, uomConversions);
      if (reverse != null && reverse !== 0) factor = 1 / reverse;
    }
    if (factor == null) return null;
    qtyInPkgUnit = qty * factor;
  }

  const packages = qtyInPkgUnit / packagingSize;
  const isWholeNumber =
    Number.isInteger(packages) || Math.abs(packages - Math.round(packages)) < 0.0001;

  const spec =
    formatPackagingPerContainer(
      packagingSize,
      packageUnitPerPackageName ?? null,
      packagingUnitLabel.trim()
    ) ?? '';

  return {
    packageSpec: spec,
    packagesFormatted: packages.toLocaleString(undefined, { maximumFractionDigits: 4 }),
    containerLabel: packagingUnitLabel.trim(),
    isWholeNumber,
  };
}
