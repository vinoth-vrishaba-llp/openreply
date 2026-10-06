/**
 * Hourly private-reply cap.
 *
 * Meta's documented ceiling is 750 private replies per hour per Instagram
 * professional account. That stays the hard maximum: neither the environment
 * default nor a per-account value can raise it, only lower it.
 *
 * Resolution order: the account's own hourlyDmCap, then DM_HOURLY_CAP from the
 * environment, then the ceiling itself.
 */

export const HOURLY_CAP_CEILING = 750;

function parseCap(value: unknown): number | null {
  // Strings must be plain digits: parseInt("250abc") would quietly give 250.
  const parsed =
    typeof value === "number"
      ? value
      : /^\d+$/.test(String(value ?? "").trim())
        ? Number.parseInt(String(value).trim(), 10)
        : NaN;
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, HOURLY_CAP_CEILING);
}

export function getDefaultHourlyCap(): number {
  return parseCap(process.env.DM_HOURLY_CAP) ?? HOURLY_CAP_CEILING;
}

export function resolveHourlyCap(accountCap: number | null | undefined): number {
  return parseCap(accountCap) ?? getDefaultHourlyCap();
}

/** Strict check for user input: a whole number from 1 to the ceiling. */
export function isValidHourlyCap(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= HOURLY_CAP_CEILING
  );
}
