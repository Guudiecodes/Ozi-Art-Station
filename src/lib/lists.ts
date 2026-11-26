export const CATEGORIES = ["Characters & Creatures", "Props", "Hard surface", "Architecture", "Nature & Plants", "Food & Drink", "Furniture & Home", "Art & Abstract", "Sky & Light", "Surfaces"];
export const LICENSES = ["CC0", "CC-BY 4.0", "CC-BY-NC 4.0", "All rights reserved", "Standard commercial license"];
// Currencies both gateways commonly support. Paystack: NGN, USD, GHS, ZAR, KES. Flutterwave supports all of these plus more.
export const CURRENCIES = ["NGN", "USD", "GHS", "ZAR", "KES", "GBP", "EUR"];
// Lighting setups for the viewers. "studio" is built in code (no download); the rest are local HDR files in /public/env.
export const LIGHTS: Record<string, { label: string; file?: string }> = {
  studio: { label: "Studio" },
  sunset: { label: "Sunset", file: "/env/venice_sunset_1k.hdr" },
  overcast: { label: "Overcast", file: "/env/pedestrian_overpass_1k.hdr" },
  sunrise: { label: "Sunrise", file: "/env/spruit_sunrise_1k.hdr" },
  daylight: { label: "Daylight", file: "/env/quarry_01_1k.hdr" },
  night: { label: "Night", file: "/env/moonless_golf_1k.hdr" },
};
export const money = (n: number, cur: string) => {
  try { return new Intl.NumberFormat("en", { style: "currency", currency: cur, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n); } catch { return `${cur} ${n}`; }
};
