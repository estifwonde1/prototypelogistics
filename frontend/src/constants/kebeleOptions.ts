/** Kebele numbers allowed on hubs and warehouses (inclusive). */
export const KEBELE_MIN = 1;
export const KEBELE_MAX = 40;

export function formatKebeleOptionValue(n: number): string {
  return String(n).padStart(2, '0');
}

export const KEBELE_DROPDOWN_OPTIONS = Array.from(
  { length: KEBELE_MAX - KEBELE_MIN + 1 },
  (_, index) => {
    const value = formatKebeleOptionValue(KEBELE_MIN + index);
    return { value, label: value };
  }
);

export function kebeleNumberFromName(name?: string): number | undefined {
  if (!name) return undefined;

  const match = name.match(/\d+/);
  if (!match) return undefined;

  const value = Number(match[0]);
  return value >= KEBELE_MIN && value <= KEBELE_MAX ? value : undefined;
}

export function kebeleValueFromNumber(n?: number | string | null): string {
  if (n === '' || n === null || n === undefined) return '';
  const num = Number(n);
  if (!Number.isFinite(num) || num < KEBELE_MIN || num > KEBELE_MAX) return '';
  return formatKebeleOptionValue(num);
}

export function resolveKebeleIdForNumber(
  kebeles: { id: number; name: string }[] | undefined,
  kebeleNumber: number
): number | undefined {
  if (!kebeles?.length) return undefined;

  const padded = formatKebeleOptionValue(kebeleNumber);
  const candidates = new Set(
    [padded, String(kebeleNumber), `Kebele ${padded}`, `Kebele ${kebeleNumber}`].map((s) =>
      s.toLowerCase()
    )
  );

  const byName = kebeles.find((kebele) => candidates.has(kebele.name.trim().toLowerCase()));
  if (byName) return byName.id;

  return kebeles.find((kebele) => kebeleNumberFromName(kebele.name) === kebeleNumber)?.id;
}
