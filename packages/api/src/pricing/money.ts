/**
 * Monetary amount as exposed by the API: whole kopiyky (the smallest currency
 * unit). Formatting to a display value is the UI's responsibility.
 *
 * `C` defaults to `string`; slices that only ever emit UAH (collections) narrow
 * it with `MoneyDto<'UAH'>`.
 */
export interface MoneyDto<C extends string = string> {
  /** Amount in the smallest currency unit (kopiyky). */
  readonly amount: number;
  readonly currency: C;
}
