export interface CuratedFont {
  id: string;
  name: string;
  stack: string;
  category: 'sans' | 'mono';
}

export const CURATED_FONTS: CuratedFont[] = [
  {
    id: 'plus-jakarta-sans',
    name: 'Plus Jakarta Sans',
    stack: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    category: 'sans',
  },
  {
    id: 'inter',
    name: 'Inter',
    stack: "'Inter', system-ui, -apple-system, sans-serif",
    category: 'sans',
  },
  {
    id: 'geist',
    name: 'Geist',
    stack: "'Geist', system-ui, -apple-system, sans-serif",
    category: 'sans',
  },
  {
    id: 'manrope',
    name: 'Manrope',
    stack: "'Manrope', system-ui, -apple-system, sans-serif",
    category: 'sans',
  },
];

export const DEFAULT_FONT_ID = 'plus-jakarta-sans';

export function getFontById(id: string): CuratedFont {
  return CURATED_FONTS.find((f) => f.id === id) ?? CURATED_FONTS[0];
}

export const FONT_SCALE_VALUES: Record<'sm' | 'md' | 'lg', number> = {
  sm: 0.9375,  // 15px base
  md: 1,       // 16px base
  lg: 1.0625,  // 17px base
};
