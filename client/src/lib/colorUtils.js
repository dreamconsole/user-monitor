export function hexToHSL(hex) {
    if (!hex) return null;

    // Remove the hash at the start if it's there
    hex = hex.replace(/^#/, '');

    // Parse the r, g, b values
    const rInt = parseInt(hex.substring(0, 2), 16);
    const gInt = parseInt(hex.substring(2, 4), 16);
    const bInt = parseInt(hex.substring(4, 6), 16);

    // Convert to range 0-1
    const r = rInt / 255;
    const g = gInt / 255;
    const b = bInt / 255;

    // Find greatest and smallest channel values
    const cmin = Math.min(r, g, b);
    const cmax = Math.max(r, g, b);
    const delta = cmax - cmin;

    let h = 0;
    let s = 0;
    let l = 0;

    // Calculate hue
    if (delta === 0) {
        h = 0;
    } else if (cmax === r) {
        h = ((g - b) / delta) % 6;
    } else if (cmax === g) {
        h = (b - r) / delta + 2;
    } else {
        h = (r - g) / delta + 4;
    }

    h = Math.round(h * 60);
    // Make negative hues positive behind 360°
    if (h < 0) {
        h += 360;
    }

    // Calculate lightness
    l = (cmax + cmin) / 2;

    // Calculate saturation
    if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));
    }

    // Multiply l and s by 100
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    // Tailwind/Shadcn CSS formatted HSL properties 
    // Usually H S% L% but CSS custom properties might just use the raw values
    // returning raw specifically for Shadcn root mapping:  222.2 47.4% 11.2%
    return `${h} ${s}% ${l}%`;
}
