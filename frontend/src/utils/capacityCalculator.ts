/** Matches backend Cats::Warehouse::CapacityCalculator */
export const REFERENCE_M3_PER_MT = 1.25;

export interface CapacityPreview {
  footprintSqm: number;
  usableFloorSqm: number;
  usableVolumeM3: number;
  capacityMt: number;
}

export function previewWarehouseCapacity(
  lengthM: number,
  widthM: number,
  heightM: number,
  usableSpacePercentage: number
): CapacityPreview | null {
  const l = Number(lengthM);
  const w = Number(widthM);
  const h = Number(heightM);
  const pct = Number(usableSpacePercentage) || 75;
  if (l <= 0 || w <= 0 || h <= 0) return null;

  const footprintSqm = l * w;
  const usableFloorSqm = footprintSqm * (pct / 100);
  const usableVolumeM3 = usableFloorSqm * h;
  const capacityMt = usableVolumeM3 / REFERENCE_M3_PER_MT;

  return {
    footprintSqm: round(footprintSqm),
    usableFloorSqm: round(usableFloorSqm),
    usableVolumeM3: round(usableVolumeM3),
    capacityMt: round(capacityMt),
  };
}

export function mtFromVolume(volumeM3: number): number {
  if (volumeM3 <= 0) return 0;
  return round(volumeM3 / REFERENCE_M3_PER_MT);
}

/** Full store volume (m³): net floor × height. Warehouse usable % is not applied here. */
export function storeUsableVolumeM3(
  length: number,
  width: number,
  height: number,
  gangwayArea: number
): number {
  const floor = Math.max(length * width - gangwayArea, 0);
  return round(floor * height);
}

export interface StackDimensionHints {
  storeLengthM: number;
  storeWidthM: number;
  storeHeightM: number;
  storeFootprintSqm: number;
  remainingFootprintSqm: number;
  maxLengthM: number;
  maxWidthM: number;
  maxHeightM: number;
}

/** Max stack dimensions allowed inside a store (footprint vs sibling stacks). */
export function stackDimensionHints(
  storeLengthM: number | undefined,
  storeWidthM: number | undefined,
  storeHeightM: number | undefined,
  siblingStacks: { id?: number; length: number; width: number }[],
  editingStackId?: number
): StackDimensionHints | null {
  const sL = Number(storeLengthM);
  const sW = Number(storeWidthM);
  const sH = Number(storeHeightM);
  if (sL <= 0 || sW <= 0 || sH <= 0) return null;

  const storeFootprintSqm = sL * sW;
  const usedByOthers = siblingStacks
    .filter((s) => s.id !== editingStackId)
    .reduce((sum, s) => sum + Number(s.length) * Number(s.width), 0);
  const remainingFootprintSqm = Math.max(storeFootprintSqm - usedByOthers, 0);

  return {
    storeLengthM: sL,
    storeWidthM: sW,
    storeHeightM: sH,
    storeFootprintSqm: round(storeFootprintSqm),
    remainingFootprintSqm: round(remainingFootprintSqm),
    maxLengthM: sL,
    maxWidthM: sW,
    maxHeightM: sH,
  };
}

export function formatStackFootprintHint(
  remainingSqm: number,
  maxL: number,
  maxW: number
): string {
  if (remainingSqm <= 0) {
    return `No floor area left in store (${maxL}×${maxW} m full)`;
  }
  return `Up to ${maxL}×${maxW} m per side; ~${remainingSqm.toLocaleString()} m² floor left in store`;
}

export function warehouseGeometricVolumeM3(
  lengthM: number,
  widthM: number,
  heightM: number
): number {
  const l = Number(lengthM);
  const w = Number(widthM);
  const h = Number(heightM);
  if (l <= 0 || w <= 0 || h <= 0) return 0;
  return round(l * w * h);
}

/** Pro-rata MT share based on geometric warehouse volume (L×W×H), scaled to usable MT budget. */
export function allocatedStoreMt(
  storeGeometricVolume: number,
  warehouseGeometricVolume: number,
  warehouseUsableMt: number
): number | null {
  if (warehouseGeometricVolume <= 0 || storeGeometricVolume <= 0 || warehouseUsableMt <= 0) return null;
  return round((storeGeometricVolume / warehouseGeometricVolume) * warehouseUsableMt);
}

export interface WarehouseCapacityDimensions {
  length_m?: number;
  width_m?: number;
  height_m?: number;
}

export interface StoreDimensions {
  length: number;
  width: number;
  height: number;
  has_gangway?: boolean;
}

const DIMENSION_EPS = 1e-4;

/** True when store matches warehouse L×W×H with no gangway (occupies entire warehouse). */
export function storeFullyOccupiesWarehouse(
  store: StoreDimensions,
  capacity: WarehouseCapacityDimensions | null | undefined
): boolean {
  if (!capacity?.length_m || !capacity?.width_m || !capacity?.height_m) return false;
  if (store.has_gangway) return false;

  return (
    Math.abs(Number(store.length) - Number(capacity.length_m)) <= DIMENSION_EPS &&
    Math.abs(Number(store.width) - Number(capacity.width_m)) <= DIMENSION_EPS &&
    Math.abs(Number(store.height) - Number(capacity.height_m)) <= DIMENSION_EPS
  );
}

/** Formatted MT label for full-warehouse capacity messaging. */
export function formatFullWarehouseCapacityLabel(usableMt: number, usablePct?: number): string {
  const mt = usableMt.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (usablePct == null) return `${mt} MT`;
  return `${mt} MT at ${usablePct}% usable floor`;
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export interface StoreDimensionHints {
  warehouseLengthM: number;
  warehouseWidthM: number;
  warehouseHeightM: number;
  warehouseFootprintSqm: number;
  remainingFootprintSqm: number;
  maxLengthM: number;
  maxWidthM: number;
  maxHeightM: number;
}

/** Max store footprint allowed given warehouse size and sibling stores. */
export function storeDimensionHints(
  warehouseLengthM: number | undefined,
  warehouseWidthM: number | undefined,
  warehouseHeightM: number | undefined,
  siblingStores: { id?: number; length: number; width: number }[],
  editingStoreId?: number
): StoreDimensionHints | null {
  const whL = Number(warehouseLengthM);
  const whW = Number(warehouseWidthM);
  const whH = Number(warehouseHeightM);
  if (whL <= 0 || whW <= 0 || whH <= 0) return null;

  const warehouseFootprintSqm = whL * whW;
  const usedByOthers = siblingStores
    .filter((s) => s.id !== editingStoreId)
    .reduce((sum, s) => sum + Number(s.length) * Number(s.width), 0);
  const remainingFootprintSqm = Math.max(warehouseFootprintSqm - usedByOthers, 0);

  return {
    warehouseLengthM: whL,
    warehouseWidthM: whW,
    warehouseHeightM: whH,
    warehouseFootprintSqm: round(warehouseFootprintSqm),
    remainingFootprintSqm: round(remainingFootprintSqm),
    maxLengthM: whL,
    maxWidthM: whW,
    maxHeightM: whH,
  };
}

export function formatFootprintHint(remainingSqm: number, maxL: number, maxW: number): string {
  if (remainingSqm <= 0) {
    return `No floor area left (warehouse ${maxL}×${maxW} m full)`;
  }
  return `Up to ${maxL}×${maxW} m per side; ~${remainingSqm.toLocaleString()} m² floor left`;
}

/** Visual validation state for dimension inputs */
export type DimensionFieldStatus = 'empty' | 'valid' | 'invalid';

export function dimensionAxisStatus(value: number, max: number): DimensionFieldStatus {
  const v = Number(value);
  if (!v || v <= 0) return 'empty';
  if (max > 0 && v > max + 1e-6) return 'invalid';
  return 'valid';
}

export function footprintStatus(
  storeFootprintSqm: number,
  remainingFootprintSqm: number
): DimensionFieldStatus {
  const fp = Number(storeFootprintSqm);
  if (fp <= 0) return 'empty';
  if (remainingFootprintSqm <= 0) return 'invalid';
  if (fp > remainingFootprintSqm + 1e-6) return 'invalid';
  return 'valid';
}

export function dimensionInputBorderStyle(status: DimensionFieldStatus): Record<string, unknown> | undefined {
  if (status === 'valid') {
    return {
      input: {
        borderColor: 'var(--mantine-color-green-6)',
        borderWidth: 2,
      },
    };
  }
  return undefined;
}

export function dimensionValidLabel(status: DimensionFieldStatus): string | undefined {
  if (status === 'valid') return 'Within limit';
  return undefined;
}
