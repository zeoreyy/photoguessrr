import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Polyline, Popup } from "react-leaflet";
import L, { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

export function coloredIcon(color: string, label?: string) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;"><div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.6);"></div>${label ? `<div style="position:absolute;top:18px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,.9);color:white;font-size:11px;padding:2px 6px;border-radius:4px;white-space:nowrap;">${label}</div>` : ""}</div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
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

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => map.invalidateSize({ animate: false });
    // Initial fixes — Leaflet often needs a kick after mount/animation.
    const timers = [50, 200, 500, 1000].map((ms) => window.setTimeout(invalidate, ms));
    const ro = new ResizeObserver(() => invalidate());
    ro.observe(container);
    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);
    return () => {
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
    };
  }, [map]);
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

  const wrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={wrapperRef} className={className} style={{ height, width: "100%", background: "#aadaff", position: "relative" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%", background: "#aadaff" }}
        scrollWheelZoom
        worldCopyJump
        zoomControl
        minZoom={2}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
          maxNativeZoom={19}
          minZoom={2}
          tileSize={256}
          updateWhenIdle={false}
          keepBuffer={4}
          crossOrigin
        />
        <InvalidateOnResize />
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
