import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, MapPin, Trash2, Check, Camera, Loader2 } from "lucide-react";
import exifr from "exifr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPlayerId } from "@/lib/playerSession";
import { GameMap } from "@/components/MapView";
import { scoreFor, scopeDiagKm, haversine, type RoomConfig } from "@/lib/game";

async function extractGps(file: File): Promise<{ lat: number; lng: number } | null> {
  try {
    const data = await exifr.parse(file, { gps: true });
    const lat = data?.latitude;
    const lng = data?.longitude;
    if (lat == null || lng == null) return null;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    if (lat === 0 && lng === 0) return null;
    return { lat, lng };
  } catch (e) {
    console.warn("[exifr] parse failed", e);
    return null;
  }
}

export const Route = createFileRoute("/room/$code")({
  head: () => ({
    meta: [
      { title: "Room — PhotoGuessr" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPage,
});

type Room = {
  id: string; code: string; host_id: string; state: string;
  current_round: number; config: RoomConfig;
};
type Player = { id: string; room_id: string; nickname: string; is_host: boolean; is_ready: boolean; color: string | null };
type Photo = {
  id: string; room_id: string; player_id: string; storage_path: string;
  latitude: number | null; longitude: number | null; is_pinned: boolean; confirmed: boolean;
};
type Round = { id: string; room_id: string; round_number: number; photo_id: string | null; started_at: string | null; ended_at: string | null };
type Guess = { id: string; round_id: string; player_id: string; latitude: number; longitude: number; distance_km: number | null; points: number | null; is_submitter: boolean };

function publicUrl(path: string) {
  if (path.startsWith("http")) return path;
  return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const playerId = getPlayerId();

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const me = players.find((p) => p.id === playerId);
  const isHost = !!me?.is_host;

  // initial load
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: r } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
      if (!active) return;
      if (!r) { setNotFound(true); setLoading(false); return; }
      setRoom(r as unknown as Room);
      const [{ data: ps }, { data: phs }, { data: rs }, { data: gs }] = await Promise.all([
        supabase.from("players").select("*").eq("room_id", r.id).order("joined_at"),
        supabase.from("photos").select("*").eq("room_id", r.id),
        supabase.from("rounds").select("*").eq("room_id", r.id).order("round_number"),
        supabase.from("guesses").select("*"),
      ]);
      if (!active) return;
      setPlayers((ps ?? []) as Player[]);
      setPhotos((phs ?? []) as Photo[]);
      setRounds((rs ?? []) as Round[]);
      const roundIds = (rs ?? []).map((x) => x.id);
      setGuesses(((gs ?? []) as Guess[]).filter((g) => roundIds.includes(g.round_id)));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [code]);

  // realtime
  useEffect(() => {
    if (!room) return;
    const ch = supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (p) => { if (p.eventType === "DELETE") { navigate({ to: "/" }); return; } setRoom(p.new as unknown as Room); })
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
        (p) => {
          setPlayers((prev) => {
            if (p.eventType === "INSERT") return [...prev, p.new as Player];
            if (p.eventType === "UPDATE") return prev.map((x) => x.id === (p.new as Player).id ? p.new as Player : x);
            if (p.eventType === "DELETE") return prev.filter((x) => x.id !== (p.old as Player).id);
            return prev;
          });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "photos", filter: `room_id=eq.${room.id}` },
        (p) => {
          setPhotos((prev) => {
            if (p.eventType === "INSERT") return [...prev, p.new as Photo];
            if (p.eventType === "UPDATE") return prev.map((x) => x.id === (p.new as Photo).id ? p.new as Photo : x);
            if (p.eventType === "DELETE") return prev.filter((x) => x.id !== (p.old as Photo).id);
            return prev;
          });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds", filter: `room_id=eq.${room.id}` },
        (p) => {
          setRounds((prev) => {
            if (p.eventType === "INSERT") return [...prev, p.new as Round].sort((a, b) => a.round_number - b.round_number);
            if (p.eventType === "UPDATE") return prev.map((x) => x.id === (p.new as Round).id ? p.new as Round : x);
            if (p.eventType === "DELETE") return prev.filter((x) => x.id !== (p.old as Round).id);
            return prev;
          });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "guesses" },
        (p) => {
          setGuesses((prev) => {
            if (p.eventType === "INSERT") return [...prev, p.new as Guess];
            if (p.eventType === "UPDATE") return prev.map((x) => x.id === (p.new as Guess).id ? p.new as Guess : x);
            if (p.eventType === "DELETE") return prev.filter((x) => x.id !== (p.old as Guess).id);
            return prev;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room?.id, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white"><Loader2 className="animate-spin text-yellow-400" /></div>;
  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white">
      <div className="text-center">
        <p className="mb-4 font-mono uppercase tracking-widest text-sm">Room not found.</p>
        <Link to="/" className="text-yellow-400 underline">Go home</Link>
      </div>
    </div>
  );
  if (!room || !me) return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white">
      <div className="text-center">
        <p className="mb-4 font-mono uppercase tracking-widest text-sm">You're not in this room.</p>
        <Link to="/" className="text-yellow-400 underline">Go home</Link>
      </div>
    </div>
  );

  if (room.state === "lobby") {
    if (room.config.is_solo) return <SoloLobbyView room={room} players={players} isHost={isHost} />;
    return <LobbyView room={room} players={players} photos={photos} me={me} isHost={isHost} />;
  }
  if (room.state === "playing") return <GameView room={room} players={players} photos={photos} rounds={rounds} guesses={guesses} me={me} isHost={isHost} />;
  if (room.state === "finished") return <FinalView room={room} players={players} photos={photos} rounds={rounds} guesses={guesses} isHost={isHost} />;
  return null;
}

/* ================= LOBBY ================= */

function LobbyView({ room, players, photos, me, isHost }: { room: Room; players: Player[]; photos: Photo[]; me: Player; isHost: boolean }) {
  const myPhotos = photos.filter((p) => p.player_id === me.id);
  const target = room.config.photos_per_player;
  const N = players.length;
  const R = room.config.total_rounds;
  const roundsEven = N > 0 && R % N === 0;
  const adjustedRounds = N > 0 ? Math.ceil(R / N) * N : R;
  const allReady = players.length > 0 && players.every((p) => p.is_ready);

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    toast.success("Room code copied");
  };

  const startGame = async () => {
    console.log("[start] clicked", { players: players.length, photos: photos.length, config: room.config });
    try {
      const N = players.length;
      if (N === 0) { toast.error("No players"); return; }
      // Force rounds to be evenly divisible by player count
      const R = Math.ceil(room.config.total_rounds / N) * N;
      const perPlayer = R / N;
      const chosen: Photo[] = [];
      for (const p of players) {
        const pool = photos.filter((ph) => ph.player_id === p.id && ph.is_pinned);
        if (pool.length < perPlayer) {
          toast.error(`${p.nickname} doesn't have enough pinned photos (${pool.length}/${perPlayer})`);
          return;
        }
        const picked = pool.sort(() => Math.random() - 0.5).slice(0, perPlayer);
        chosen.push(...picked);
      }
      chosen.sort(() => Math.random() - 0.5);
      const roundRows = chosen.map((ph, i) => ({
        room_id: room.id, round_number: i + 1, photo_id: ph.id,
      }));
      console.log("[start] inserting", roundRows.length, "rounds");
      // If we bumped the rounds count, persist it back to room config
      if (R !== room.config.total_rounds) {
        await supabase.from("rooms").update({
          config: { ...room.config, total_rounds: R } as never,
        }).eq("id", room.id);
      }
      const { error: rErr } = await supabase.from("rounds").insert(roundRows);
      if (rErr) { console.error("[start] rounds insert failed", rErr); toast.error(rErr.message); return; }
      const { error: r1Err } = await supabase.from("rounds").update({ started_at: new Date().toISOString() })
        .eq("room_id", room.id).eq("round_number", 1);
      if (r1Err) { console.error("[start] round1 start failed", r1Err); toast.error(r1Err.message); return; }
      const { error: rmErr } = await supabase.from("rooms").update({ state: "playing", current_round: 1 }).eq("id", room.id);
      if (rmErr) { console.error("[start] room update failed", rmErr); toast.error(rmErr.message); return; }
      console.log("[start] success — room state -> playing");
    } catch (e) {
      console.error("[start] unexpected error", e);
      toast.error("Failed to start game");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/" className="inline-flex items-center text-neutral-400 hover:text-yellow-400 font-mono text-xs tracking-widest uppercase">
          <ArrowLeft className="w-4 h-4 mr-1" /> Leave
        </Link>

        <div className="bg-neutral-950 border border-neutral-800 p-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-500 mb-3">◆ Room code</p>
          <button onClick={copyCode} className="inline-flex items-center gap-3 group">
            <span className="text-5xl sm:text-6xl font-black tracking-[0.4em] text-yellow-400 group-hover:text-yellow-300">{room.code}</span>
            <Copy className="w-5 h-5 text-neutral-500 group-hover:text-white" />
          </button>
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 mt-3">Tap to copy · Share with friends</p>
        </div>

        <div className="border border-neutral-800 p-4">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Players</h2>
          <div className="space-y-2">
            {players.map((p) => {
              const count = photos.filter((ph) => ph.player_id === p.id && ph.is_pinned).length;
              return (
                <div key={p.id} className="flex items-center justify-between bg-neutral-900 px-3 py-2 border-l-2" style={{ borderLeftColor: p.color ?? "#888" }}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.nickname}</span>
                    {p.is_host && <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 bg-yellow-400 text-black">Host</span>}
                    {p.is_ready && <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border border-yellow-400 text-yellow-400">Ready</span>}
                  </div>
                  <span className="text-sm font-mono text-neutral-500">{count}/{room.config.photos_per_player}</span>
                </div>
              );
            })}
          </div>
        </div>

        <UploadSection room={room} me={me} myPhotos={myPhotos} target={target} />

        {isHost && !roundsEven && N > 0 && (
          <p className="text-xs text-yellow-400 text-center font-mono uppercase tracking-widest">
            For an even split, rounds will be {adjustedRounds} ({adjustedRounds / N} per player)
          </p>
        )}
        {isHost && (
          <Button onClick={startGame} disabled={!allReady}
            className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-black rounded-none disabled:bg-neutral-900 disabled:text-neutral-600 uppercase tracking-widest font-bold">
            {allReady ? "Start Game →" : "Waiting for everyone…"}
          </Button>
        )}
      </div>
    </div>
  );
}

function UploadSection({ room, me, myPhotos, target }: { room: Room; me: Player; myPhotos: Photo[]; target: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pinModal, setPinModal] = useState<Photo | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const remaining = target - myPhotos.length;
    const list = Array.from(files).slice(0, remaining);
    if (list.length === 0) { toast.error("You've reached the photo limit"); return; }
    setUploading(true);
    let gpsHits = 0;
    for (const file of list) {
      try {
        const photoId = crypto.randomUUID();
        const path = `rooms/${room.code}/${me.id}/${photoId}.jpg`;
        // Extract GPS BEFORE upload (file object is still original)
        const gps = await extractGps(file);
        console.log("[upload] file", file.name, "gps:", gps);
        const { error: upErr } = await supabase.storage.from("photos").upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
        if (upErr) { toast.error(upErr.message); continue; }
        const row = gps
          ? { id: photoId, room_id: room.id, player_id: me.id, storage_path: path,
              latitude: gps.lat, longitude: gps.lng, is_pinned: true, confirmed: false }
          : { id: photoId, room_id: room.id, player_id: me.id, storage_path: path,
              latitude: null, longitude: null, is_pinned: false, confirmed: false };
        await supabase.from("photos").insert(row);
        if (gps) gpsHits++;
      } catch (e) {
        console.error(e);
        toast.error("Upload failed");
      }
    }
    setUploading(false);
    if (gpsHits > 0) toast.success(`Detected GPS in ${gpsHits} photo${gpsHits === 1 ? "" : "s"} — please confirm`);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removePhoto = async (p: Photo) => {
    await supabase.storage.from("photos").remove([p.storage_path]);
    await supabase.from("photos").delete().eq("id", p.id);
    if (me.is_ready) await supabase.from("players").update({ is_ready: false }).eq("id", me.id);
  };

  const allPinned = myPhotos.length === target && myPhotos.every((p) => p.is_pinned && p.confirmed);

  const toggleReady = async () => {
    await supabase.from("players").update({ is_ready: !me.is_ready }).eq("id", me.id);
  };

  return (
    <div className="border border-neutral-800 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your photos · {myPhotos.length}/{target}</h2>
        <Button size="sm" disabled={uploading || myPhotos.length >= target}
          onClick={() => inputRef.current?.click()}
          className="bg-yellow-400 hover:bg-yellow-300 text-black rounded-none uppercase tracking-widest text-xs font-bold">
          <Camera className="w-4 h-4 mr-1" /> {uploading ? "Uploading…" : "Add"}
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {myPhotos.length === 0 && (
        <p className="text-sm text-neutral-500 text-center py-6 font-mono">
          Add {target} photos. GPS auto-detected — otherwise drop a pin.
        </p>
      )}

      <div className="space-y-2">
        {myPhotos.map((p) => {
          const hasGps = p.latitude != null && p.longitude != null;
          const needsConfirm = hasGps && !p.confirmed;
          const needsPin = !hasGps;
          const done = hasGps && p.confirmed;
          return (
            <div key={p.id} className="bg-neutral-900 p-3 flex gap-3 border-l-2 border-neutral-700">
              <img src={publicUrl(p.storage_path)} alt="" className="w-20 h-20 object-cover" />
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  {done && (
                    <span className="inline-flex items-center text-[10px] font-mono uppercase tracking-widest text-yellow-400">
                      <Check className="w-3 h-3 mr-1" /> Confirmed
                    </span>
                  )}
                  {needsConfirm && (
                    <span className="inline-flex items-center text-[10px] font-mono uppercase tracking-widest text-white">
                      <MapPin className="w-3 h-3 mr-1" /> GPS — confirm
                    </span>
                  )}
                  {needsPin && (
                    <span className="inline-flex items-center text-[10px] font-mono uppercase tracking-widest text-yellow-400">
                      <MapPin className="w-3 h-3 mr-1" /> Drop a pin
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] h-7 rounded-none uppercase tracking-widest"
                    onClick={() => setPinModal(p)}>
                    <MapPin className="w-3 h-3 mr-1" />
                    {done ? "Edit" : needsConfirm ? "Review" : "Set pin"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-7 rounded-none"
                    onClick={() => removePhoto(p)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {myPhotos.length > 0 && (
        <Button onClick={toggleReady} disabled={!allPinned && !me.is_ready}
          className={me.is_ready
            ? "w-full h-12 bg-neutral-800 hover:bg-neutral-700 text-white rounded-none uppercase tracking-widest font-bold"
            : "w-full h-12 bg-yellow-400 hover:bg-yellow-300 text-black rounded-none uppercase tracking-widest font-bold disabled:bg-neutral-900 disabled:text-neutral-600"}>
          {me.is_ready ? "Not ready" : allPinned ? "I'm ready" : `Pin all photos first`}
        </Button>
      )}

      {pinModal && <PinModal photo={pinModal} onClose={() => setPinModal(null)} />}
    </div>
  );
}

function PinModal({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const hadGps = photo.latitude != null && photo.longitude != null && !photo.confirmed;
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    photo.latitude != null && photo.longitude != null ? { lat: photo.latitude, lng: photo.longitude } : null
  );
  const save = async () => {
    if (!pin) return;
    await supabase.from("photos").update({
      latitude: pin.lat, longitude: pin.lng, is_pinned: true, confirmed: true,
    }).eq("id", photo.id);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-neutral-900 border border-neutral-800 text-white max-w-2xl rounded-none">
        <div className="space-y-3">
          <p className="text-sm text-neutral-300 font-mono">
            {hadGps
              ? "GPS detected. Confirm location, or click the map to adjust."
              : "Click the map to drop a pin where this photo was taken."}
          </p>
          <img src={publicUrl(photo.storage_path)} alt="" className="max-h-48 mx-auto" />
          <GameMap
            height="400px"
            pin={pin}
            pinColor="#FACC15"
            center={pin ? [pin.lat, pin.lng] : [20, 0]}
            zoom={pin ? 10 : 2}
            onClick={(lat, lng) => setPin({ lat, lng })}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800 rounded-none uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={save} disabled={!pin} className="bg-yellow-400 hover:bg-yellow-300 text-black rounded-none uppercase tracking-widest text-xs font-bold">
              {hadGps ? "Confirm" : "Save pin"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= SOLO LOBBY ================= */

function SoloLobbyView({ room, players, isHost }: { room: Room; players: Player[]; isHost: boolean }) {
  const [starting, setStarting] = useState(false);

  const startSoloGame = async () => {
    setStarting(true);
    try {
      const bot = players.find((p) => !p.is_host);
      if (!bot) { toast.error("Bot player not found"); return; }

      const { data: botPhotos } = await supabase
        .from("photos").select("*").eq("room_id", room.id).eq("player_id", bot.id);

      if (!botPhotos || botPhotos.length === 0) { toast.error("No photos found"); return; }

      const shuffled = (botPhotos as Photo[]).sort(() => Math.random() - 0.5).slice(0, room.config.total_rounds);
      const roundRows = shuffled.map((ph, i) => ({ room_id: room.id, round_number: i + 1, photo_id: ph.id }));

      const { error: rErr } = await supabase.from("rounds").insert(roundRows);
      if (rErr) { toast.error(rErr.message); return; }
      await supabase.from("rounds").update({ started_at: new Date().toISOString() })
        .eq("room_id", room.id).eq("round_number", 1);
      await supabase.from("rooms").update({ state: "playing", current_round: 1 }).eq("id", room.id);
    } catch {
      toast.error("Failed to start");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        <Link to="/" className="inline-flex items-center text-neutral-400 hover:text-yellow-400 font-mono text-xs tracking-widest uppercase">
          <ArrowLeft className="w-4 h-4 mr-1" /> Leave
        </Link>

        <div className="bg-neutral-950 border border-neutral-800 p-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-yellow-400 mb-1">◆ Solo Test Mode</p>
          <p className="text-2xl font-black uppercase tracking-widest">
            {room.config.total_rounds} rounds · {room.config.timer_seconds}s each
          </p>
        </div>

        <div className="border border-neutral-800 p-4">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Players</h2>
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-neutral-800 px-3 py-2 border-l-2" style={{ borderLeftColor: p.color ?? "#888" }}>
                <span className="font-medium">{p.nickname}</span>
                {p.is_host
                  ? <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 bg-yellow-400 text-black">You</span>
                  : <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 border border-neutral-600 text-neutral-400">Bot</span>
                }
              </div>
            ))}
          </div>
        </div>

        {isHost && (
          <Button
            onClick={startSoloGame}
            disabled={starting}
            className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-black rounded-none disabled:bg-neutral-800 disabled:text-neutral-600 uppercase tracking-widest font-bold"
          >
            {starting ? "Starting…" : "Start Game →"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ================= GAME ================= */

function GameView({ room, players, photos, rounds, guesses, me, isHost }:
  { room: Room; players: Player[]; photos: Photo[]; rounds: Round[]; guesses: Guess[]; me: Player; isHost: boolean }) {
  const round = rounds.find((r) => r.round_number === room.current_round);
  const photo = round && photos.find((p) => p.id === round.photo_id);
  const submitter = photo && players.find((p) => p.id === photo.player_id);
  const isSubmitter = photo?.player_id === me.id;
  const roundGuesses = round ? guesses.filter((g) => g.round_id === round.id) : [];
  const myGuess = roundGuesses.find((g) => g.player_id === me.id);
  const isReveal = !!round?.ended_at;

  const PREVIEW_SECONDS = 5;
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(room.config.timer_seconds);
  const [previewLeft, setPreviewLeft] = useState(PREVIEW_SECONDS);
  const [mapOpen, setMapOpen] = useState(false);
  const advancingRef = useRef(false);

  useEffect(() => {
    setPin(null);
    setMapOpen(false);
    advancingRef.current = false;
  }, [round?.id]);

  // timer (with 5s preview phase before timer starts)
  const [overtime, setOvertime] = useState(0);
  useEffect(() => {
    if (!round?.started_at || isReveal) return;
    const start = new Date(round.started_at).getTime();
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      const previewRem = Math.max(0, Math.ceil(PREVIEW_SECONDS - elapsed));
      setPreviewLeft(previewRem);
      if (elapsed < PREVIEW_SECONDS) {
        setTimeLeft(room.config.timer_seconds);
        setOvertime(0);
      } else {
        const remaining = room.config.timer_seconds - (elapsed - PREVIEW_SECONDS);
        setTimeLeft(Math.max(0, Math.floor(remaining)));
        setOvertime(remaining < 0 ? -remaining : 0);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [round?.started_at, room.config.timer_seconds, isReveal]);

  const inPreview = previewLeft > 0 && !isReveal;

  // auto-submit pin if time is running out and player has a pin but didn't submit
  const autoSubmitRef = useRef(false);
  useEffect(() => {
    if (!round || isReveal || inPreview) return;
    if (timeLeft === 0 && pin && !myGuess && !isSubmitter && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      submitGuess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, pin, myGuess, isReveal, inPreview, isSubmitter]);
  useEffect(() => { autoSubmitRef.current = false; }, [round?.id]);

  // round end check (host drives) — never during preview
  useEffect(() => {
    if (!isHost || !round || isReveal || inPreview) return;
    const nonSubmitters = players.filter((p) => p.id !== photo?.player_id);
    const allSubmitted = nonSubmitters.length > 0 && nonSubmitters.every((p) =>
      roundGuesses.some((g) => g.player_id === p.id));
    // Give a 1.5s grace period after timer hits 0 so auto-submits land first
    if ((allSubmitted || overtime >= 1.5) && !advancingRef.current) {
      advancingRef.current = true;
      endRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, overtime, roundGuesses.length, isHost, round?.id, isReveal, inPreview]);

  const endRound = async () => {
    if (!round || !photo) return;
    await supabase.from("rounds").update({ ended_at: new Date().toISOString() }).eq("id", round.id);
  };

  const submitGuess = async () => {
    if (!round || !photo || !pin) return;
    let dist: number | null = null;
    let pts: number | null = null;
    if (photo.latitude != null && photo.longitude != null) {
      dist = haversine(pin.lat, pin.lng, photo.latitude, photo.longitude);
      pts = isSubmitter ? 0 : scoreFor(dist, scopeDiagKm(room.config.map_scope));
    }
    await supabase.from("guesses").insert({
      round_id: round.id, player_id: me.id,
      latitude: pin.lat, longitude: pin.lng,
      distance_km: dist, points: pts, is_submitter: isSubmitter,
    });
  };

  const nextRound = async () => {
    if (!isHost) return;
    const next = room.current_round + 1;
    if (next > room.config.total_rounds) {
      await supabase.from("rooms").update({ state: "finished" }).eq("id", room.id);
    } else {
      await supabase.from("rounds").update({ started_at: new Date().toISOString() })
        .eq("room_id", room.id).eq("round_number", next);
      await supabase.from("rooms").update({ current_round: next }).eq("id", room.id);
    }
  };

  if (!round || !photo) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white"><Loader2 className="animate-spin" /></div>;

  // ===== Reveal screen: keep the prior layout =====
  if (isReveal) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Round {room.current_round} / {room.config.total_rounds}</span>
          </div>
          {isSubmitter && (
            <div className="bg-yellow-400/10 border border-yellow-400/40 px-3 py-2 text-sm text-yellow-300 font-mono uppercase tracking-widest text-xs">
              ◆ Your photo — your guess didn't count.
            </div>
          )}
          <img src={publicUrl(photo.storage_path)} alt="" className="w-full max-h-[40vh] object-contain bg-neutral-900" />
          <RevealView room={room} round={round} photo={photo} players={players}
            guesses={roundGuesses} submitter={submitter} isHost={isHost} onNext={nextRound} />
        </div>
      </div>
    );
  }

  // ===== Active round: GeoGuessr-style fullscreen photo + expandable mini-map =====
  return (
    <div className="fixed inset-0 bg-slate-950 text-white overflow-hidden">
      {/* Fullscreen photo */}
      <img
        src={publicUrl(photo.storage_path)}
        alt=""
        className="absolute inset-0 w-full h-full object-contain bg-black"
      />

      {/* Top HUD - always above map */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <span className="font-mono text-xs uppercase tracking-widest text-white bg-black px-2 py-1 border border-neutral-700">
          R{room.current_round}/{room.config.total_rounds}
        </span>
        {inPreview ? (
          <span className="font-mono text-base sm:text-lg text-black bg-yellow-400 px-3 py-1 font-bold">
            READY · {previewLeft}s
          </span>
        ) : (
          <span className={`font-mono text-base sm:text-lg px-3 py-1 font-bold ${timeLeft <= 5 ? "text-white bg-red-500" : "text-black bg-yellow-400"}`}>
            {timeLeft}s
          </span>
        )}
      </div>

      {isSubmitter && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[10px] font-mono uppercase tracking-widest px-3 py-1 font-bold pointer-events-none">
          ◆ Your photo
        </div>
      )}

      {/* Mini-map — expands like GeoGuessr, leaves photo + submit visible */}
      {!inPreview && (
        <div
          className={`absolute z-20 flex flex-col gap-2 transition-all duration-200 ease-out ${
            mapOpen
              ? "left-2 right-2 bottom-2 top-1/2 sm:top-auto sm:left-auto sm:right-3 sm:bottom-3 sm:w-[460px] sm:h-[480px]"
              : "bottom-3 right-3 w-44 h-32 sm:w-56 sm:h-40 sm:hover:w-64 sm:hover:h-44"
          }`}
          onMouseEnter={() => !mapOpen && setMapOpen(true)}
        >
          <div className="relative flex-1 min-h-0 overflow-hidden border-2 border-yellow-400 shadow-2xl bg-neutral-900">
            <GameMap
              height="100%"
              pin={pin}
              pinColor={me.color ?? "#FACC15"}
              onClick={(lat, lng) => !myGuess && setPin({ lat, lng })}
            />
            {!mapOpen && (
              <button
                onClick={() => setMapOpen(true)}
                className="absolute inset-0 sm:hidden bg-black/0 active:bg-black/20"
                aria-label="Expand map"
              />
            )}
            {mapOpen && (
              <button
                onClick={() => setMapOpen(false)}
                className="absolute top-1 right-1 z-30 bg-black hover:bg-neutral-800 border border-yellow-400 text-yellow-400 text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 font-bold flex items-center gap-1"
              >
                ← Photo
              </button>
            )}
          </div>

          {mapOpen && (
            <div className="shrink-0">
              {myGuess ? (
                <Button disabled className="w-full h-12 bg-neutral-900 text-neutral-400 rounded-none uppercase tracking-widest font-mono text-xs">
                  Waiting for others…
                </Button>
              ) : (
                <Button
                  onClick={async () => { await submitGuess(); setMapOpen(false); }}
                  disabled={!pin}
                  className="w-full h-12 bg-yellow-400 hover:bg-yellow-300 text-black disabled:bg-neutral-900 disabled:text-neutral-500 rounded-none text-base font-bold uppercase tracking-widest"
                >
                  {pin ? "Submit guess →" : "Tap map to drop pin"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview overlay */}
      {inPreview && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black border border-yellow-400 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-yellow-400 pointer-events-none">
          Look carefully · map opens in {previewLeft}s
        </div>
      )}
    </div>
  );
}

function RevealView({ room, round, photo, players, guesses, submitter, isHost, onNext }:
  { room: Room; round: Round; photo: Photo; players: Player[]; guesses: Guess[]; submitter: Player | undefined; isHost: boolean; onNext: () => void }) {
  const truth = (photo.latitude != null && photo.longitude != null)
    ? { lat: photo.latitude, lng: photo.longitude } : null;

  const guessMarkers = guesses.map((g) => {
    const p = players.find((pl) => pl.id === g.player_id);
    return { lat: g.latitude, lng: g.longitude, color: p?.color ?? "#888", label: p?.nickname ?? "?" };
  });

  // No auto-advance — host must explicitly click "Next round".

  const sorted = [...guesses]
    .filter((g) => !g.is_submitter)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  const isLast = room.current_round >= room.config.total_rounds;

  return (
    <div className="space-y-3">
      <GameMap height="380px" truth={truth} guesses={guessMarkers} fitAll />
      <div className="border border-neutral-800 p-3 bg-neutral-950">
        {submitter && <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">◆ Submitted by <span className="text-yellow-400">{submitter.nickname}</span></p>}
        <div className="space-y-1">
          {sorted.map((g) => {
            const p = players.find((pl) => pl.id === g.player_id);
            return (
              <div key={g.id} className="flex items-center justify-between text-sm py-1 border-l-2 pl-2" style={{ borderLeftColor: p?.color ?? "#666" }}>
                <span>{p?.nickname}</span>
                <div className="flex gap-4 text-neutral-500 font-mono">
                  <span>{g.distance_km?.toFixed(1)} km</span>
                  <span className="text-yellow-400 w-12 text-right">{g.points ?? 0}</span>
                </div>
              </div>
            );
          })}
          {submitter && (
            <div className="flex items-center justify-between text-sm py-1 opacity-60 border-l-2 pl-2" style={{ borderLeftColor: submitter.color ?? "#666" }}>
              <div className="flex items-center gap-2">
                <span>{submitter.nickname}</span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 bg-yellow-400 text-black">Submitter</span>
              </div>
              <span className="text-neutral-600 font-mono">—</span>
            </div>
          )}
        </div>
      </div>
      {isHost && (
        <Button onClick={onNext} className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-black rounded-none uppercase tracking-widest font-bold">
          {isLast ? "See final scoreboard →" : "Next round →"}
        </Button>
      )}
      {!isHost && <p className="text-xs text-center text-neutral-500 font-mono uppercase tracking-widest">Host will advance soon…</p>}
    </div>
  );
}

/* ================= FINAL ================= */

function FinalView({ room, players, photos, rounds, guesses, isHost }:
  { room: Room; players: Player[]; photos: Photo[]; rounds: Round[]; guesses: Guess[]; isHost: boolean }) {
  const totals = useMemo(() => {
    return players.map((p) => {
      const total = guesses
        .filter((g) => g.player_id === p.id && !g.is_submitter)
        .reduce((s, g) => s + (g.points ?? 0), 0);
      return { player: p, total };
    }).sort((a, b) => b.total - a.total);
  }, [players, guesses]);

  const playAgain = async () => {
    // Delete photos from storage
    const paths = photos.map((p) => p.storage_path);
    if (paths.length) await supabase.storage.from("photos").remove(paths);
    await supabase.from("guesses").delete().in("round_id", rounds.map((r) => r.id));
    await supabase.from("rounds").delete().eq("room_id", room.id);
    await supabase.from("photos").delete().eq("room_id", room.id);
    await supabase.from("players").update({ is_ready: false }).eq("room_id", room.id);
    await supabase.from("rooms").update({ state: "lobby", current_round: 0 }).eq("id", room.id);
  };

  const endGame = async () => {
    const paths = photos.map((p) => p.storage_path);
    if (paths.length) await supabase.storage.from("photos").remove(paths);
    await supabase.from("rooms").delete().eq("id", room.id);
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-yellow-400 mb-3">◆ Game Over</p>
          <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-tighter leading-none">
            Final<br/>Score.
          </h1>
        </div>
        <div className="border border-neutral-800">
          {totals.map((t, i) => (
            <div key={t.player.id} className={`flex items-center justify-between px-5 py-4 border-b border-neutral-800 last:border-b-0 ${i === 0 ? "bg-yellow-400 text-black" : "bg-neutral-950"}`}>
              <div className="flex items-center gap-4">
                <span className={`font-mono text-2xl font-black ${i === 0 ? "text-black" : "text-neutral-500"}`}>#{i + 1}</span>
                <div className="w-3 h-3" style={{ background: t.player.color ?? "#888" }} />
                <span className="font-bold uppercase tracking-wide">{t.player.nickname}</span>
              </div>
              <span className={`font-mono text-2xl font-black ${i === 0 ? "text-black" : "text-yellow-400"}`}>{t.total}</span>
            </div>
          ))}
        </div>

        {isHost && (
          <div className="space-y-2">
            <Button onClick={playAgain} className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-black rounded-none uppercase tracking-widest font-bold">Play again →</Button>
            <Button onClick={endGame} variant="outline" className="w-full h-14 border-neutral-700 bg-transparent hover:bg-neutral-900 text-white rounded-none uppercase tracking-widest font-bold">End game</Button>
          </div>
        )}
      </div>
    </div>
  );
}
