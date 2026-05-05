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
  is_solo?: boolean;
};

export type Landmark = { name: string; url: string; lat: number; lng: number };

export const SOLO_LANDMARKS: Landmark[] = [
  { name: "Eiffel Tower", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/960px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg", lat: 48.8584, lng: 2.2945 },
  { name: "Colosseum", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/960px-Colosseo_2020.jpg", lat: 41.8902, lng: 12.4922 },
  { name: "Taj Mahal", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Taj_Mahal_%28Edited%29.jpeg/960px-Taj_Mahal_%28Edited%29.jpeg", lat: 27.1751, lng: 78.0421 },
  { name: "Machu Picchu", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Machu_Picchu%2C_2023_%28012%29.jpg/960px-Machu_Picchu%2C_2023_%28012%29.jpg", lat: -13.1631, lng: -72.5450 },
  { name: "Statue of Liberty", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Front_view_of_Statue_of_Liberty_%28cropped%29.jpg/960px-Front_view_of_Statue_of_Liberty_%28cropped%29.jpg", lat: 40.6892, lng: -74.0445 },
  { name: "Big Ben", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Elizabeth_Tower%2C_June_2022.jpg/960px-Elizabeth_Tower%2C_June_2022.jpg", lat: 51.5007, lng: -0.1246 },
  { name: "Sagrada Família", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/%CE%A3%CE%B1%CE%B3%CF%81%CE%AC%CE%B4%CE%B1_%CE%A6%CE%B1%CE%BC%CE%AF%CE%BB%CE%B9%CE%B1_2941.jpg/960px-%CE%A3%CE%B1%CE%B3%CF%81%CE%AC%CE%B4%CE%B1_%CE%A6%CE%B1%CE%BC%CE%AF%CE%BB%CE%B9%CE%B1_2941.jpg", lat: 41.4036, lng: 2.1744 },
  { name: "Christ the Redeemer", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Christ_the_Redeemer_-_Cristo_Redentor.jpg/960px-Christ_the_Redeemer_-_Cristo_Redentor.jpg", lat: -22.9519, lng: -43.2105 },
  { name: "Great Wall of China", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg/960px-The_Great_Wall_of_China_at_Jinshanling-edit.jpg", lat: 40.4319, lng: 116.5704 },
  { name: "Sydney Opera House", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Sydney_Australia._%2821339175489%29.jpg/960px-Sydney_Australia._%2821339175489%29.jpg", lat: -33.8568, lng: 151.2153 },
];
