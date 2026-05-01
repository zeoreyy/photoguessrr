import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Polyline, Popup } from "react-leaflet";
import L, { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export function coloredIcon(color: string, label?: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5);"></div>${label ? `<div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,.9);color:white;font-size:11px;padding:2px 6px;border-radius:4px;white-space:nowrap;">${label}</div>` : ""}`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export const goldStarIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));">⭐</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
  }, [bounds, map]);
  return null;
}

export type GuessMarker = {
  lat: number;
  lng: number;
  color: string;
  label: string;
};

export function GameMap({
  center = [20, 0],
  zoom = 2,
  height = "400px",
  onClick,
  pin,
  pinColor = "#0EA5E9",
  pinLabel,
  truth,
  guesses,
  fitAll = false,
  className,
}: {
  center?: LatLngExpression;
  zoom?: number;
  height?: string;
  onClick?: (lat: number, lng: number) => void;
  pin?: { lat: number; lng: number } | null;
  pinColor?: string;
  pinLabel?: string;
  truth?: { lat: number; lng: number; label?: string } | null;
  guesses?: GuessMarker[];
  fitAll?: boolean;
  className?: string;
}) {
  let bounds: LatLngBoundsExpression | null = null;
  if (fitAll) {
    const pts: [number, number][] = [];
    if (truth) pts.push([truth.lat, truth.lng]);
    guesses?.forEach((g) => pts.push([g.lat, g.lng]));
    if (pts.length >= 2) bounds = pts;
    else if (pts.length === 1) {
      bounds = [
        [pts[0][0] - 5, pts[0][1] - 5],
        [pts[0][0] + 5, pts[0][1] + 5],
      ];
    }
  }

  return (
    <div className={className} style={{ height, width: "100%", borderRadius: "0.5rem", overflow: "hidden" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onClick && <ClickHandler onClick={onClick} />}
        {pin && (
          <Marker position={[pin.lat, pin.lng]} icon={coloredIcon(pinColor, pinLabel)} />
        )}
        {truth && (
          <Marker position={[truth.lat, truth.lng]} icon={goldStarIcon}>
            {truth.label && <Popup>{truth.label}</Popup>}
          </Marker>
        )}
        {guesses?.map((g, i) => (
          <Marker key={i} position={[g.lat, g.lng]} icon={coloredIcon(g.color, g.label)} />
        ))}
        {truth && guesses?.map((g, i) => (
          <Polyline key={`l-${i}`} positions={[[g.lat, g.lng], [truth.lat, truth.lng]]} pathOptions={{ color: g.color, weight: 2, dashArray: "5,5" }} />
        ))}
        <FitBounds bounds={bounds} />
      </MapContainer>
    </div>
  );
}
