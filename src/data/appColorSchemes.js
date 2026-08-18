export const APP_COLOR_SCHEMES = [
  // Signature FamOS — warm coral accent
  { id: "famos", label: "FamOS Pop", note: "Purple, guava and tangerine", emoji: "🌈", colors: ["#E85D3D", "#E0448F", "#F97316"] },

  // Ocean & Sky — cool, calming
  { id: "ocean", label: "Electric Coast", note: "Deep teal, sky blue and mint", emoji: "🌊", colors: ["#0D47A1", "#2196F3", "#90CAF9"] },
  { id: "lagoon", label: "Lagoon Breeze", note: "Aqua, teal and seafoam", emoji: "🏝️", colors: ["#006064", "#26C6DA", "#80DEEA"] },
  { id: "horizon", label: "Horizon", note: "Navy, cobalt and ice", emoji: "🌅", colors: ["#0D1B3A", "#1E3A8A", "#3B82F6"] },

  // Warm & Earthy — grounded, cozy
  { id: "sunset", label: "Golden Hour", note: "Papaya, coral and amber", emoji: "🌅", colors: ["#E73F1E", "#FB6C00", "#F9B637"] },
  { id: "terracotta", label: "Terracotta", note: "Clay, rust and sand", emoji: "🏺", colors: ["#8B4513", "#CD5C5C", "#DDB892"] },
  { id: "autumn", label: "Autumn Walk", note: "Burnt orange, ochre and sage", emoji: "🍂", colors: ["#C85C1E", "#D4A843", "#8F9B6E"] },
  { id: "desert", label: "Desert Dusk", note: "Warm sand, rose and charcoal", emoji: "🏜️", colors: ["#524646", "#A8A492", "#EC5B38"] },

  // Fresh & Green — nature-inspired
  { id: "forest", label: "Forest Deep", note: "Emerald, pine and moss", emoji: "🌲", colors: ["#1B5E20", "#66BB6A", "#A5D6A7"] },
  { id: "meadow", label: "Meadow", note: "Fresh green, lime and cream", emoji: "🌿", colors: ["#2E7D32", "#8BC34A", "#DCEDC8"] },
  { id: "eucalyptus", label: "Eucalyptus", note: "Sage, silver and mint", emoji: "🌱", colors: ["#4A6B4F", "#8FA28A", "#C7D3C0"] },

  // Soft & Pastel — gentle, playful
  { id: "berry", label: "Berry Punch", note: "Raspberry, violet and mango", emoji: "🍓", colors: ["#C11574", "#7C3AED", "#EA580C"] },
  { id: "peach", label: "Peach Blossom", note: "Soft peach, coral and rose", emoji: "🍑", colors: ["#FFDAB9", "#FFB3A7", "#F59E8E"] },
  { id: "lavender", label: "Lavender Fields", note: "Lilac, mauve and cream", emoji: "🪻", colors: ["#B8A9E6", "#D8C3F0", "#EDE7F6"] },
  { id: "cotton", label: "Cotton Candy", note: "Pink, mint and butter", emoji: "🍭", colors: ["#FFB6C1", "#A8E6CF", "#FFD93D"] },

  // Rich & Jewel — sophisticated
  { id: "jewel", label: "Jewel Tones", note: "Amethyst, emerald and sapphire", emoji: "💎", colors: ["#6A1B9A", "#00695C", "#1565C0"] },
  { id: "midnight", label: "Midnight", note: "Deep indigo, navy and gold", emoji: "🌙", colors: ["#0D1B3A", "#1E3A8A", "#C8A96B"] },
  { id: "velvet", label: "Velvet", note: "Burgundy, plum and champagne", emoji: "🍷", colors: ["#5E3122", "#CF4173", "#F9D2BA"] },

  // Monochrome & Minimal — clean, modern
  { id: "charcoal", label: "Charcoal", note: "Slate, graphite and pearl", emoji: "⚫", colors: ["#1E1E1E", "#3F3F3F", "#E0E0E0"] },
  { id: "warm-gray", label: "Warm Stone", note: "Taupe, greige and ivory", emoji: "🪨", colors: ["#4E4943", "#8E857A", "#F5F0E8"] },
  { id: "noir", label: "Noir", note: "Obsidian, steel and silver", emoji: "🖤", colors: ["#0A0A0A", "#2D2D2D", "#A8A8A8"] },

  // Vibrant & Energetic — bold, fun
  { id: "neon", label: "Neon Dreams", note: "Electric pink, cyan and lime", emoji: "⚡", colors: ["#FF006E", "#00F5D4", "#CCFF00"] },
  { id: "retro", label: "Retro Wave", note: "Hot pink, teal and purple", emoji: "📼", colors: ["#FF1493", "#00CED1", "#9932CC"] },
  { id: "tropical", label: "Tropical", note: "Parrot green, flamingo and sun", emoji: "🦜", colors: ["#00FF7F", "#FF4500", "#FFD700"] },

  // Seasonal favorites
  { id: "spring", label: "Spring Bloom", note: "Fresh green, blossom and sky", emoji: "🌸", colors: ["#4CAF50", "#FF69B4", "#87CEEB"] },
  { id: "summer", label: "Summer Vibes", note: "Ocean, coral and sunshine", emoji: "☀️", colors: ["#0077BE", "#FF6F61", "#FFD700"] },
  { id: "winter", label: "Winter Frost", note: "Ice blue, silver and pine", emoji: "❄️", colors: ["#A8D0E6", "#C0C0C0", "#2C5F2D"] },
  { id: "cozy", label: "Cozy Fireside", note: "Cocoa, cream and cranberry", emoji: "🔥", colors: ["#4A2C2A", "#F5E6D3", "#C41E3A"] },
];

// Helper to get scheme by ID
export function getColorScheme(id) {
  return APP_COLOR_SCHEMES.find(s => s.id === id) || APP_COLOR_SCHEMES[0];
}

// Helper to get CSS custom properties for a scheme
export function getSchemeCSSVars(scheme) {
  return {
    '--color-accent': scheme.colors[0],
    '--color-accent-secondary': scheme.colors[1],
    '--color-accent-tertiary': scheme.colors[2],
    '--color-accent-soft': `${scheme.colors[0]}1A`, // 10% opacity
    '--color-accent-strong': scheme.colors[0],
  };
}