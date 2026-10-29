type Branding = { brandTone?: string; mainKeywords?: string; brandColorTones?: string[] };

export function brandingComplete(data?: Branding): boolean {
  return !!(data?.brandTone?.trim() || data?.mainKeywords?.trim())
    && Array.isArray(data?.brandColorTones)
    && data.brandColorTones.some((value) => typeof value === 'string' && !!value.trim());
}
