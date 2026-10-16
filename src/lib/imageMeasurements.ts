/** Descriptive sRGB image statistics. No severity classes, learned thresholds or clinical scores. */
export interface ImageMeasurements {
  method: "srgb-lab-d65-v1";
  width: number;
  height: number;
  selectedPixels: number;
  sampleCount: number;
  clippedFraction: number;
  meanL: number;
  meanA: number;
  meanB: number;
  lightnessStd: number;
  colorSpread: number;
  laplacianStd: number | null;
  textureSamples: number;
}

/** IEC sRGB transfer function, D65 XYZ white, CIE 1976 L*a*b*. Assumes the canvas is sRGB. */
export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const linear = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const red = linear(r), green = linear(g), blue = linear(b);
  const f = (v: number) => v > (6 / 29) ** 3 ? Math.cbrt(v) : v / (3 * (6 / 29) ** 2) + 4 / 29;
  const x = f((0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) / 0.95047);
  const y = f(0.2126729 * red + 0.7151522 * green + 0.072175 * blue);
  const z = f((0.0193339 * red + 0.119192 * green + 0.9503041 * blue) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function measureSkinPixels(pixels: Uint8ClampedArray, width: number, height: number, skinMask: Uint8Array): ImageMeasurements {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3 || pixels.length !== width * height * 4 || skinMask.length !== width * height) {
    throw new Error("Dimensions d’image ou masque de peau invalides.");
  }
  const accepted = new Uint8Array(width * height);
  const lightness = new Float64Array(width * height);
  let selected = 0, count = 0;
  const mean = [0, 0, 0], m2 = [0, 0, 0];
  for (let i = 0; i < skinMask.length; i++) {
    if (!skinMask[i]) continue;
    selected++;
    const r = pixels[4 * i], g = pixels[4 * i + 1], b = pixels[4 * i + 2];
    // Reject transparent samples and digital clipping in any channel, not specific skin tones.
    if (pixels[4 * i + 3] !== 255 || Math.min(r, g, b) <= 2 || Math.max(r, g, b) >= 253) continue;
    const lab = srgbToLab(r, g, b);
    count++; accepted[i] = 1; lightness[i] = lab[0];
    for (let channel = 0; channel < 3; channel++) {
      const delta = lab[channel] - mean[channel];
      mean[channel] += delta / count;
      m2[channel] += delta * (lab[channel] - mean[channel]);
    }
  }
  if (count < 256) throw new Error("Pas assez de pixels de peau exploitables. Reprenez une photo nette, sans filtre, avec le visage bien visible.");
  const clippedFraction = 1 - count / selected;
  if (clippedFraction > 0.25) throw new Error("Trop de pixels saturés ou transparents dans la zone de peau. Reprenez une photo sous un éclairage uniforme.");
  let textureSamples = 0, lapMean = 0, lapM2 = 0;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    // Every neighbor must belong to the sampled skin. Never measure hair/eye/background edges.
    if (![i, i - 1, i + 1, i - width, i + width].every(index => accepted[index])) continue;
    const lap = 4 * lightness[i] - lightness[i - 1] - lightness[i + 1] - lightness[i - width] - lightness[i + width];
    textureSamples++;
    const delta = lap - lapMean; lapMean += delta / textureSamples; lapM2 += delta * (lap - lapMean);
  }
  return {
    method: "srgb-lab-d65-v1", width, height, selectedPixels: selected, sampleCount: count, clippedFraction,
    meanL: mean[0], meanA: mean[1], meanB: mean[2], lightnessStd: Math.sqrt(Math.max(0, m2[0] / count)),
    colorSpread: Math.sqrt(Math.max(0, (m2[0] + m2[1] + m2[2]) / count)),
    laplacianStd: textureSamples >= 64 ? Math.sqrt(Math.max(0, lapM2 / textureSamples)) : null, textureSamples,
  };
}
