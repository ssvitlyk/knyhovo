import type { Money, Availability, ProviderName } from '@knyhovo/shared';
import { parseYakabooProduct } from './yakaboo/yakaboo.parser.js';
import { parseVivatProduct } from './vivat/vivat.parser.js';
import { parseBookYeProduct } from './book-ye/book-ye.parser.js';
import { parseBookChefProduct } from './bookchef/bookchef.parser.js';

export interface ParsedProductState {
  readonly price: Money | null;
  readonly availability: Availability;
}

export type SingleProductParser = (html: string) => ParsedProductState;

// Keyed by the three real scraper providers. ProviderName also includes
// 'book-club' which has no scraper; it is intentionally absent here.
export const SINGLE_PRODUCT_PARSERS: Partial<Record<ProviderName, SingleProductParser>> = {
  yakaboo: parseYakabooProduct,
  vivat: parseVivatProduct,
  'book-ye': parseBookYeProduct,
  bookchef: parseBookChefProduct,
};
