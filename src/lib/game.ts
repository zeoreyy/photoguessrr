// Shared game utilities

export const COLORS = [
  "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#84CC16", "#6366F1",
];

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

// Haversine distance (km)
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Score formula: 5000 * exp(-5 * d / D), capped 0..5000
export function scoreFor(distanceKm: number, scopeDiagKm: number): number {
  const D = scopeDiagKm > 0 ? scopeDiagKm : 20015;
  const pts = Math.round(5000 * Math.exp((-5 * distanceKm) / D));
  return Math.max(0, Math.min(5000, pts));
}

export type MapScope = {
  type: "world";
  name: string;
  bbox: [number, number, number, number]; // [w, s, e, n]
};

export const WORLD_SCOPE: MapScope = {
  type: "world",
  name: "World",
  bbox: [-180, -85, 180, 85],
};

export function scopeDiagKm(scope: MapScope): number {
  const [w, s, e, n] = scope.bbox;
  return haversine(s, w, n, e);
}

export type RoomConfig = {
  photos_per_player: number;
  total_rounds: number;
  timer_seconds: number;
  map_scope: MapScope;
};
