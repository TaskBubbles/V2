// Kuro Glass Palette 4.8
// 18 Distinct Colors arranged in a 6x3 Grid
// Refined based on user feedback: User-selected Amber Base (#ffb300) with adjusted Top/Bottom variants

export interface ColorGroup {
    name: string;
    shades: [string, string, string]; // Top (Alt), Base (Primary), Bottom (Deep/Alt)
}

export const COLOR_GROUPS: ColorGroup[] = [
    {
        name: 'Red',
        // Top: Flamingo Pink (Liked), Base: Red, Bottom: Ruby (Liked)
        shades: ['#f472b6', '#ef4444', '#be123c'] 
    },
    {
        name: 'Orange', 
        // Top: Tangerine (Liked), Base: Orange, Bottom: Burnt Orange (Liked)
        shades: ['#fb923c', '#f97316', '#c2410c']
    },
    {
        name: 'Yellow', 
        // Top: Amber 400 (#ffca28) - Lighter, sunny gold
        // Base: Amber 600 (#ffb300) - User Pick (Fixed)
        // Bottom: Amber 800 (#ff8f00) - Rich, deep gold
        shades: ['#ffca28', '#ffb300', '#ff8f00']
    },
    {
        name: 'Green', 
        // Top: Emerald 500 (New), Base: Green 500, Bottom: Green 700
        shades: ['#10b981', '#22c55e', '#15803d']
    },
    {
        name: 'Blue', 
        // Top: Sky (Liked), Base: Blue, Bottom: Cobalt (Liked)
        shades: ['#38bdf8', '#3b82f6', '#1e40af']
    },
    {
        name: 'Purple',
        // Top: Magenta (Liked), Base: Purple, Bottom: Eggplant (Liked)
        shades: ['#d946ef', '#a855f7', '#6b21a8']
    }
];

// Flat array of just the base colors for random generation
export const BASE_COLORS = COLOR_GROUPS.map(g => g.shades[1]);

// Flat array of ALL colors for lookup validation
export const ALL_COLORS = COLOR_GROUPS.flatMap(g => g.shades);

// Default export for legacy compatibility (randomizer uses this)
export const COLORS = BASE_COLORS;

export const MIN_BUBBLE_SIZE = 20; 
export const MAX_BUBBLE_SIZE = 220; 
export const CENTER_RADIUS = 50; 
export const POP_THRESHOLD_MS = 600;

/**
 * Calculates a dynamic font size to fit text within the bubble.
 * Uses strict heuristics to ensure the longest word fits without breaking.
 */
export const calculateFontSize = (radius: number, text: string): number => {
  if (!text) return radius / 3;
  
  // 1. Define safe container width (Inscribed square is ~1.41r)
  // We use 1.3r to provide a safety padding buffer so text doesn't touch edges.
  const containerWidth = radius * 1.3;
  
  const words = text.split(/\s+/);
  const longestWord = words.reduce((a, b) => (a.length > b.length ? a : b), "");
  const maxWordLen = Math.max(longestWord.length, 1);
  const totalChars = text.length;

  // 2. Character Aspect Ratio (Width / FontSize)
  // Poppins Bold is roughly 0.6, but 'm' or 'w' are wider.
  // We use 0.75 to be extremely safe, ensuring even wide words fit.
  const charWidthRatio = 0.75;
  const lineHeight = 1.1;

  // 3. Constraint A: Width
  // The longest word must fit on a single line.
  const sizeToFitWidth = containerWidth / (maxWordLen * charWidthRatio);

  // 4. Constraint B: Area
  // The total text block must fit within the square area.
  // Area = containerWidth^2
  // Text Area ≈ totalChars * (fontSize * charWidthRatio) * (fontSize * lineHeight)
  const area = containerWidth * containerWidth;
  const sizeToFitArea = Math.sqrt(area / (totalChars * charWidthRatio * lineHeight));

  // 5. Constraint C: Max aesthetic size
  // Don't let short words become huge.
  const sizeToFitRadius = radius * 0.45;

  // Take the smallest of all constraints
  let fontSize = Math.min(sizeToFitWidth, sizeToFitArea, sizeToFitRadius);

  // 6. Limits
  // We allow the font to get very small (4px) to avoid breaking words in tiny bubbles.
  // We cap the max size for readability.
  return Math.max(4, Math.min(fontSize, 50));
};