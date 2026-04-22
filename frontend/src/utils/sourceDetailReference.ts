/** Matches backend Cats::Warehouse::SourceDetailReference.generate_unique pattern (SD + 10 chars). */
const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSourceDetailReference(): string {
  let s = 'SD';
  for (let i = 0; i < 10; i += 1) {
    s += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
  }
  return s;
}
