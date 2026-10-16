import test from 'node:test';
import assert from 'node:assert/strict';
import { measureSkinPixels, srgbToLab } from '../src/lib/imageMeasurements.ts';

function image(width = 32, height = 32, rgb = [128, 128, 128]) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) pixels.set([...rgb, 255], 4 * i);
  return { pixels, width, height, mask: new Uint8Array(width * height).fill(1) };
}
const measure = ({ pixels, width, height, mask }) => measureSkinPixels(pixels, width, height, mask);

test('sRGB reference colors match CIE L*a*b* D65', () => {
  for (const [rgb, expected] of [
    [[0, 0, 0], [0, 0, 0]], [[255, 255, 255], [100, 0, 0]],
    [[128, 128, 128], [53.585, 0, 0]], [[255, 0, 0], [53.241, 80.092, 67.203]],
  ]) {
    srgbToLab(...rgb).forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 0.01));
  }
});
test('constant skin pixels have zero color dispersion and texture contrast', () => {
  const value = measure(image());
  assert.equal(value.sampleCount, 1024);
  assert.equal(value.lightnessStd, 0);
  assert.equal(value.colorSpread, 0);
  assert.equal(value.laplacianStd, 0);
});
test('background colors and skin-mask boundaries cannot create skin texture', () => {
  const input = image(40, 40);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
    const i = y * 40 + x;
    if (x < 8 || x >= 32 || y < 8 || y >= 32) input.mask[i] = 0;
  }
  const before = measure(input);
  for (let i = 0; i < input.mask.length; i++) if (!input.mask[i]) input.pixels.set([255, 0, 0, 255], 4 * i);
  assert.deepEqual(measure(input), before);
  assert.equal(before.laplacianStd, 0);
});
test('visible pixel variations affect the calculated measurements', () => {
  const flat = measure(image());
  const patterned = image();
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if ((x + y) % 2) patterned.pixels.set([170, 130, 120, 255], 4 * (y * 32 + x));
  }
  const result = measure(patterned);
  assert.ok(result.meanA > flat.meanA);
  assert.ok(result.colorSpread > flat.colorSpread);
  assert.ok(result.laplacianStd > flat.laplacianStd);
});
test('missing skin, digital clipping and invalid image shapes produce no fabricated numbers', () => {
  const empty = image(); empty.mask.fill(0);
  assert.throws(() => measure(empty), /Pas assez/);
  assert.throws(() => measure(image(32, 32, [255, 255, 255])), /Pas assez/);
  const clipped = image();
  for (let i = 0; i < 400; i++) clipped.pixels.set([255, 255, 255, 255], i * 4);
  assert.throws(() => measure(clipped), /Trop de pixels/);
  assert.throws(() => measureSkinPixels(new Uint8ClampedArray(1), 10, 10, new Uint8Array(100)), /invalides/);
});
