// src/config/colorManagement.ts

interface HSLColor {
    h: number;
    s: number;
    l: number;
  }
  
  const classColorMap: Map<string, string> = new Map<string, string>();
  
  // Neo-brutalist color palette
  // Primary palette (based on the project's styles)
  const primaryColors = [
    '#ff6b6b', // Main red accent
    '#fcd7d7', // Soft pink background
    '#fc8181', // Brighter red
    '#feb2b2', // Light pink
    '#f56565', // Deeper red
  ];
  
  // Secondary palette (complementary colors)
  const secondaryColors = [
    '#4299e1', // Blue
    '#48bb78', // Green
    '#9f7aea', // Purple
    '#ed8936', // Orange
    '#ecc94b', // Yellow
  ];
  
  // Helper function to find similar class names
  function findSimilarClasses(className: string, existingClasses: string[]): string[] {
    // Remove whitespace and convert to lowercase for comparison
    const normalizedName = className.toLowerCase().replace(/\s+/g, '');
    
    return existingClasses.filter(existing => {
      const normalizedExisting = existing.toLowerCase().replace(/\s+/g, '');
      
      // Check if they share the same base name (e.g., "Matte 1" in "Matte 1 A")
      const baseNameMatch = normalizedName.slice(0, -1) === normalizedExisting.slice(0, -1);
      
      // Check if they only differ by last character (e.g., A vs B)
      const diffByLastChar = normalizedName.slice(0, -1) === normalizedExisting.slice(0, -1) &&
                            normalizedName !== normalizedExisting;
      
      return baseNameMatch || diffByLastChar;
    });
  }
  
  function hexToHSL(hex: string): HSLColor {
    hex = hex.replace(/^#/, '');
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
  
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
  
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
  
    return { h: h * 360, s: s * 100, l: l * 100 };
  }
  
  function HSLToHex({ h, s, l }: HSLColor): string {
    h /= 360;
    s /= 100;
    l /= 100;
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
  
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = hue2rgb(p, q, h + 1/3);
    const g = hue2rgb(p, q, h);
    const b = hue2rgb(p, q, h - 1/3);
  
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
  
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  
  function getColorDifference(color1: HSLColor, color2: HSLColor): number {
    const hDiff = Math.abs(color1.h - color2.h);
    const sDiff = Math.abs(color1.s - color2.s);
    const lDiff = Math.abs(color1.l - color2.l);
    
    const normalizedHDiff = Math.min(hDiff, 360 - hDiff);
    
    return normalizedHDiff * 0.7 + sDiff * 0.2 + lDiff * 0.1;
  }
  
  function isColorTooSimilar(newColor: HSLColor, existingColors: HSLColor[], isSimilarName: boolean): boolean {
    // Require more difference for similar names
    const minDifference = isSimilarName ? 90 : 30;
    return existingColors.some(existing => 
      getColorDifference(newColor, existing) < minDifference
    );
  }
  
  // Modified to prioritize neo-brutalist colors
  function generateDistinctColor(className: string, existingColors: HSLColor[], similarClasses: string[]): string {
    // Generate a baseline color depending on the class type
    let baseColor: string;
    
    // For similar classes, try to use similar but distinct colors
    if (similarClasses.length > 0) {
      // Find the color of one of the similar classes
      const similarClassColor = classColorMap.get(similarClasses[0]);
      if (similarClassColor) {
        // Derive a related but distinct color
        const hsl = hexToHSL(similarClassColor);

        const variantIndex = similarClasses.length;
        // 0 for the first similar class, 1 for the next, etc.
        // The original/base subject is conceptually index -1.

        // Detect whether HSL is stored in [0, 1] or [0, 100].
        const isPercentScale = hsl.l > 1 || hsl.s > 1;
        const scale = isPercentScale ? 100 : 1;

        // Normalize to 0–1 range for calculations
        let l = hsl.l / scale;
        let s = hsl.s / scale;

        // How much to vary per "pair" step
        const lightStep = 0.08; // 8% lighter/darker per level
        const satStep   = 0.06; // 6% more/less saturated per level

        // Alternate directions: lighter / darker / lighter / darker / ...
        const direction = variantIndex % 2 === 0 ? 1 : -1;
        const magnitude = Math.floor(variantIndex / 2) + 1;

        const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

        l = clamp01(l + direction * lightStep * magnitude);
        s = clamp01(s + direction * satStep * magnitude);

        // Apply back to original scale
        hsl.l = l * scale;
        hsl.s = s * scale;

        // Small hue variation within the same family
        const smallHueStep = 5; // degrees
        const hueOffset = direction * smallHueStep * magnitude;
        hsl.h = (hsl.h + hueOffset + 360) % 360;

        baseColor = HSLToHex(hsl);
      } else {
        // If we can't find a similar class's color, use one of our primary colors
        baseColor = primaryColors[similarClasses.length % primaryColors.length];
      }
    } else {
      // If not a similar class, use a base color from our palette
      const totalClasses = classColorMap.size;
      
      // Alternate between primary and secondary palettes
      if (totalClasses % 2 === 0) {
        baseColor = primaryColors[totalClasses % primaryColors.length];
      } else {
        baseColor = secondaryColors[totalClasses % secondaryColors.length];
      }
    }
    
    // Convert to HSL for adjustments
    let baseHSL = hexToHSL(baseColor);
    
    // Create variations to ensure distinctness
    let attempts = 0;
    const maxAttempts = 20;
    
    while (isColorTooSimilar(baseHSL, existingColors, similarClasses.length > 0) && attempts < maxAttempts) {
      // Adjust hue while keeping in the same color family
      baseHSL.h = (baseHSL.h + 20) % 360;
      
      // Adjust saturation and lightness slightly each time
      baseHSL.s = Math.max(70, Math.min(95, baseHSL.s + (Math.random() - 0.5) * 10));
      baseHSL.l = Math.max(50, Math.min(85, baseHSL.l + (Math.random() - 0.5) * 10));
      
      attempts++;
    }
    
    return HSLToHex(baseHSL);
  }
  
  export const updateClassColor = (className: string, color: string): void => {
    classColorMap.set(className, color);
  };
  
  export const getColorForClass = (className: string): string | undefined => {
    return classColorMap.get(className);
  };
  
  export const initializeColorSystem = (): void => {
    classColorMap.clear();
  };
  
  export const generateBoxColor = (className: string, preferredColor?: string): string => {
    // First check if there's already a color in the map
    const existingColor = classColorMap.get(className);
    if (existingColor) {
      // If we have a preferred color, update the map and return it
      if (preferredColor) {
        classColorMap.set(className, preferredColor);
        return preferredColor;
      }
      return existingColor;
    }
  
    // If no existing color and we have a preferred color that's not used
    if (preferredColor && !Array.from(classColorMap.values()).includes(preferredColor)) {
      classColorMap.set(className, preferredColor);
      return preferredColor;
    }
  
    // Original color generation logic
    const existingClasses = Array.from(classColorMap.keys());
    const similarClasses = findSimilarClasses(className, existingClasses);
    const existingColors = Array.from(classColorMap.values()).map(hexToHSL);
    
    const newColor = generateDistinctColor(className, existingColors, similarClasses);
    classColorMap.set(className, newColor);
    
    return newColor;
  };
  
  export const releaseColor = (className: string): void => {
    classColorMap.delete(className);
  };
  
  export const importColors = (boxes: Array<{ className: string; color: string }>): void => {
    initializeColorSystem();
    boxes.forEach(({ className, color }) => {
      classColorMap.set(className, color);
    });
  };