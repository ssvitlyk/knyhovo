/** Resolve after `ms` milliseconds (plain `setTimeout`; fake-timer friendly). */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
