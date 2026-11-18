/** Build an accessible, organization-specific theme from saved brand settings. */
export type OrganizationBrand = {
  primary_color?: string | null;
  secondary_color?: string | null;
  background_color?: string | null;
  surface_color?: string | null;
  text_color?: string | null;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const valid = (value: string | null | undefined, fallback: string) =>
  HEX.test(value || "") ? value! : fallback;

function luminance(hex: string): number {
  return [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}

function mix(hex: string, target: number[], amount: number): string {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return "#" + rgb.map((v, i) => Math.round(v * (1 - amount) + target[i] * amount).toString(16).padStart(2, "0")).join("");
}

/**
 * Accepts either the legacy primary-color string or the complete organization
 * branding record. Legacy callers remain compatible while new callers can
 * supply every white-label color independently.
 */
export function organizationTheme(
  input?: string | OrganizationBrand | null,
): Record<string, string> {
  const brand = typeof input === "string" ? { primary_color: input } : input || {};
  const primary = valid(brand.primary_color, "#275e72");
  const secondary = valid(brand.secondary_color, mix(primary, [255, 255, 255], 0.25));
  const background = valid(brand.background_color, "#f5f7fa");
  const surface = valid(brand.surface_color, "#ffffff");
  const text = valid(brand.text_color, "#172434");
  return {
    "--club-primary": primary,
    "--club-secondary": secondary,
    "--club-accent": secondary,
    "--club-bg": background,
    "--club-surface": surface,
    "--club-text": text,
    "--club-primary-soft": mix(primary, [255, 255, 255], 0.9),
    "--club-primary-dark": mix(primary, [0, 0, 0], 0.25),
    "--club-primary-text": mix(primary, [0, 0, 0], 0.6),
    "--club-on-primary": luminance(primary) > 0.179 ? "#000000" : "#ffffff",
  };
}
