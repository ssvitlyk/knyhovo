/**
 * Opaque brand utility. Wraps a primitive type T with a unique phantom tag TBrand
 * so TypeScript treats each branded alias as a distinct type — prevents accidentally
 * passing an arbitrary string where a CanonicalBookId is expected.
 */
type Brand<T, TBrand extends string> = T & { readonly _brand: TBrand };

/** Identifier for a CanonicalBook — the deduplicated, provider-agnostic record. */
export type CanonicalBookId = Brand<string, 'CanonicalBookId'>;
