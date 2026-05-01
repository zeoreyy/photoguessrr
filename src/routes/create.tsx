import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPlayerId } from "@/lib/playerSession";
import { COLORS, WORLD_SCOPE, generateRoomCode, type RoomConfig } from "@/lib/game";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a room — PhotoGuessr" },
      { name: "description", content: "Configure a new PhotoGuessr room: rounds, timer, and map scope." },
    ],
  }),
  component: CreatePage,
});

type Errors = { nickname?: string; photos?: string; rounds?: string; timer?: string };

function NumField({ label, value, onChange, hint, error }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <Label className="block mb-1">{label}</Label>
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className="bg-slate-800 border-slate-700 text-lg h-11"
      />
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function CreatePage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [photosPerPlayer, setPhotosPerPlayer] = useState("5");
  const [totalRounds, setTotalRounds] = useState("5");
  const [timerSeconds, setTimerSeconds] = useState("30");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const validate = (): { ok: false } | { ok: true; photos: number; rounds: number; timer: number } => {
    const e: Errors = {};
    if (!nickname.trim()) e.nickname = "Nickname required";
    const photos = parseInt(photosPerPlayer, 10);
    const rounds = parseInt(totalRounds, 10);
    const timer = parseInt(timerSeconds, 10);
    if (!Number.isFinite(photos) || photos < 3 || photos > 15) e.photos = "Enter a number between 3 and 15";
    if (!Number.isFinite(rounds) || rounds < 3 || rounds > 15) e.rounds = "Enter a number between 3 and 15";
    if (!Number.isFinite(timer) || timer < 10 || timer > 120) e.timer = "Enter a number between 10 and 120";
    setErrors(e);
    if (Object.keys(e).length) return { ok: false };
    return { ok: true, photos, rounds, timer };
  };

  const handleCreate = async () => {
    console.log("[create] clicked", { nickname, photosPerPlayer, totalRounds, timerSeconds });
    const v = validate();
    if (!v.ok) {
      console.warn("[create] validation failed");
      toast.error("Please fix the highlighted fields");
      return;
    }
    setBusy(true);
    try {
      const playerId = getPlayerId();
      console.log("[create] playerId", playerId);
      let code = "";
      for (let i = 0; i < 5; i++) {
        const candidate = generateRoomCode();
        const { data: existing, error: lookupErr } = await supabase
          .from("rooms").select("id").eq("code", candidate).maybeSingle();
        if (lookupErr) {
          console.error("[create] code lookup failed", lookupErr);
          toast.error(lookupErr.message);
          setBusy(false);
          return;
        }
        if (!existing) { code = candidate; break; }
      }
      if (!code) { toast.error("Couldn't allocate room code"); setBusy(false); return; }
      console.log("[create] allocated code", code);

      const config: RoomConfig = {
        photos_per_player: v.photos,
        total_rounds: v.rounds,
        timer_seconds: v.timer,
        map_scope: WORLD_SCOPE,
      };

      const { data: room, error } = await supabase
        .from("rooms")
        .insert({ code, host_id: playerId, config: config as never, state: "lobby" })
        .select().single();
      console.log("[create] room insert result", { room, error });
      if (error || !room) { toast.error(error?.message ?? "Failed to create room"); setBusy(false); return; }

      const { error: pErr } = await supabase.from("players").insert({
        id: playerId, room_id: room.id, nickname: nickname.trim(), is_host: true, color: COLORS[0],
      });
      console.log("[create] player insert error", pErr);
      if (pErr) { toast.error(pErr.message); setBusy(false); return; }

      console.log("[create] navigating to room", code);
      navigate({ to: "/room/$code", params: { code } });
    } catch (e) {
      console.error("[create] unexpected error", e);
      toast.error(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 bg-slate-950 text-white">
      <div className="max-w-md mx-auto">
        <Link to="/" className="inline-flex items-center text-slate-400 hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>
        <h1 className="text-3xl font-bold mb-8">Create Room</h1>

        <div className="space-y-5">
          <div>
            <Label className="block mb-1">Your nickname</Label>
            <Input
              value={nickname} onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder="Host name" className="bg-slate-800 border-slate-700 h-11"
            />
            {errors.nickname && <p className="text-xs text-red-400 mt-1">{errors.nickname}</p>}
          </div>

          <NumField label="Photos per player" value={photosPerPlayer} onChange={setPhotosPerPlayer}
            hint="3 – 15" error={errors.photos} />
          <NumField label="Total rounds" value={totalRounds} onChange={setTotalRounds}
            hint="3 – 15" error={errors.rounds} />
          <NumField label="Round timer (seconds)" value={timerSeconds} onChange={setTimerSeconds}
            hint="10 – 120" error={errors.timer} />

          <div className="text-xs text-slate-500">
            Map scope: World (more scopes coming later).
          </div>
          <Button onClick={handleCreate} disabled={busy}
            className="w-full h-12 bg-sky-500 hover:bg-sky-600 mt-4">
            {busy ? "Creating…" : "Create Room"}
          </Button>
        </div>
      </div>
    </div>
  );
}
