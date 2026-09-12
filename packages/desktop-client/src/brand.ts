/**
 * Product identity for this build. Kept in one place so the name appears
 * consistently and can be changed without hunting through components.
 */
export const BRAND = {
  name: 'Wayne Finance',
  /** For tight spots like the mobile header, where the full name collides. */
  short: 'Wayne',
  tagline: 'Your money, under watch.',
  domain: 'knightfall.wiki',
} as const;
