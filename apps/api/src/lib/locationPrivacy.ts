export function hashString(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function obfuscateLocation(
  lat: number | null | undefined,
  lng: number | null | undefined,
  seed: string,
  radiusM = 600
) {
  if (lat == null || lng == null) return { latitude: null, longitude: null };
  const maxOffset = Math.max(80, Math.min(220, radiusM * 0.35));
  const rand = mulberry32(hashString(seed));
  const distance = maxOffset * rand();
  const angle = rand() * Math.PI * 2;
  const earth = 111320;
  const dLat = (distance * Math.cos(angle)) / earth;
  const dLng = (distance * Math.sin(angle)) / (earth * Math.cos((lat * Math.PI) / 180));
  return {
    latitude: lat + dLat,
    longitude: lng + dLng
  };
}
