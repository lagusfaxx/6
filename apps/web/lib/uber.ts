/**
 * Build a Uber deep link with web fallback.
 * Handles iOS PWA (standalone) mode where universal links may not work.
 * Returns { url, isFallback } — callers should show a toast when isFallback is true.
 */
export function buildUberLink(opts: {
  lat?: number | null;
  lng?: number | null;
  locationText?: string;
}): { url: string; isFallback: boolean } {
  const { lat, lng, locationText } = opts;
  const nickname = locationText || "Destino";

  // Prefer deep link with coordinates
  if (lat != null && lng != null) {
    const deepLink = `uber://?action=setPickup&pickup=my_location&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${encodeURIComponent(nickname)}`;
    // In iOS PWA standalone mode, universal/deep links often fail
    const isStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true);

    if (isStandalone) {
      // Fallback to web — always works
      return {
        url: `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${encodeURIComponent(nickname)}`,
        isFallback: true
      };
    }

    return { url: deepLink, isFallback: false };
  }

  // No coordinates — use address-based fallback
  const encoded = encodeURIComponent(nickname);
  return {
    url: `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encoded}`,
    isFallback: true
  };
}
