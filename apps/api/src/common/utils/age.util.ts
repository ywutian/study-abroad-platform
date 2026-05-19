/**
 * Derive a whole-year age from a birthday.
 *
 * Returns `null` when the birthday is unknown or the computed age is
 * implausible (negative, or ≥ 150). Shared so age-gated logic (e.g. the
 * Hall peer-review under-16 protection) does not each re-implement it.
 */
export function deriveAge(birthday: Date | null | undefined): number | null {
  if (!birthday) return null;
  const now = new Date();
  let age = now.getFullYear() - birthday.getFullYear();
  const monthDiff = now.getMonth() - birthday.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < birthday.getDate())
  ) {
    age -= 1;
  }
  return age >= 0 && age < 150 ? age : null;
}
