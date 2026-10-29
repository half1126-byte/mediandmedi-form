import { describe, it, expect } from 'vitest';
import { brandingComplete } from '../../src/lib/branding';
describe('required branding', () => {
  const data = { brandTone: '추천받고 싶음', brandColorTones: ['추천받고 싶음'] };
  it('accepts recommendation and undecided selections', () => expect(brandingComplete(data)).toBe(true));
  it('requires the image and preferred colors only', () => {
    expect(brandingComplete(data)).toBe(true);
    expect(brandingComplete({ ...data, brandTone: '' })).toBe(false);
    expect(brandingComplete({ ...data, brandColorTones: [] })).toBe(false);
  });
});
