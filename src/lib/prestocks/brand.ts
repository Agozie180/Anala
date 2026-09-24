// Brand colors for PreStocks token badges.
//
// The named markets render in their official brand color; any other current or
// future symbol gets a stable, saturated color derived from its name. Nothing
// falls back to black-and-white — every token reads as a branded chip.

export type BrandColor = { bg: string; fg: string };

// High-confidence, non-monochrome brand colors. Kept small and recognizable.
// For logos that are officially black/white (OpenAI, SpaceX) we use the
// company's most recognizable accent color instead of a flat black chip.
const BRAND: Record<string, string> = {
  ANTHROPIC: '#CC785C', // Anthropic clay
  OPENAI: '#10A37F', // OpenAI / ChatGPT green
  SPACEX: '#005288', // SpaceX blue
  STRIPE: '#635BFF',
  DATABRICKS: '#FF3621',
  CANVA: '#00C4CC',
  DISCORD: '#5865F2',
  PERPLEXITY: '#20808D',
  KRAKEN: '#7132F5',
  REVOLUT: '#6516FF',
  POLYMARKET: '#1652F0',
};

// Relative luminance (WCAG) → pick ink or white text for readable contrast.
function readableFg(hex: string): string {
  const h = hex.replace('#', '');
  const toLin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(h.slice(0, 2), 16));
  const g = toLin(parseInt(h.slice(2, 4), 16));
  const b = toLin(parseInt(h.slice(4, 6), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#101518' : '#ffffff';
}

// Stable hue from the symbol so a given token always renders the same color.
function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function brandColor(symbol: string): BrandColor {
  const key = (symbol || '').toUpperCase();
  const known = BRAND[key];
  if (known) return { bg: known, fg: readableFg(known) };
  // Deterministic, saturated, mid-dark color for any unmapped token — white text.
  return { bg: `hsl(${hashHue(key)} 62% 42%)`, fg: '#ffffff' };
}

// Convenience for inline React styles.
export function brandStyle(symbol: string): { background: string; color: string } {
  const { bg, fg } = brandColor(symbol);
  return { background: bg, color: fg };
}
