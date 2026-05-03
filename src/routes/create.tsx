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
import { Logo } from "@/components/Logo";

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
  label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string;
}) {
  return (
    <div>
      <Label className="block mb-2 uppercase font-mono text-[10px] tracking-widest text-neutral-400">{label}</Label>
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className="bg-neutral-900 border-neutral-800 rounded-none text-lg h-12"
      />
      {hint && !error && <p className="text-xs text-neutral-500 mt-1 font-mono">{hint}</p>}
      {error && <p className="text-xs text-red-400 mt-1 font-mono">{error}</p>}
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
    const v = validate();
    if (!v.ok) { toast.error("Please fix the highlighted fields"); return; }
    setBusy(true);
    try {
      const playerId = getPlayerId();
      let code = "";
      for (let i = 0; i < 5; i++) {
        const candidate = generateRoomCode();
        const { data: existing, error: lookupErr } = await supabase
          .from("rooms").select("id").eq("code", candidate).maybeSingle();
        if (lookupErr) { toast.error(lookupErr.message); setBusy(false); return; }
        if (!existing) { code = candidate; break; }
      }
      if (!code) { toast.error("Couldn't allocate room code"); setBusy(false); return; }

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
      if (error || !room) { toast.error(error?.message ?? "Failed to create room"); setBusy(false); return; }

      const { error: pErr } = await supabase.from("players").insert({
        id: playerId, room_id: room.id, nickname: nickname.trim(), is_host: true, color: COLORS[0],
      });
      if (pErr) { toast.error(pErr.message); setBusy(false); return; }

      navigate({ to: "/room/$code", params: { code } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create room");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-neutral-800">
        <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-yellow-400 font-mono text-xs tracking-widest uppercase">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <Logo size={32} />
      </header>

      <div className="max-w-xl mx-auto px-6 py-12">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-yellow-400 mb-4">◆ New Room</p>
        <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-tighter mb-10 leading-none">
          Set the<br/>rules.
        </h1>

        <div className="space-y-6">
          <div>
            <Label className="block mb-2 uppercase font-mono text-[10px] tracking-widest text-neutral-400">Your nickname</Label>
            <Input
              value={nickname} onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder="Host name" className="bg-neutral-900 border-neutral-800 rounded-none h-12"
            />
            {errors.nickname && <p className="text-xs text-red-400 mt-1 font-mono">{errors.nickname}</p>}
          </div>

          <NumField label="Photos per player" value={photosPerPlayer} onChange={setPhotosPerPlayer} hint="3 – 15" error={errors.photos} />
          <NumField label="Total rounds" value={totalRounds} onChange={setTotalRounds} hint="3 – 15" error={errors.rounds} />
          <NumField label="Round timer (seconds)" value={timerSeconds} onChange={setTimerSeconds} hint="10 – 120" error={errors.timer} />

          <div className="border-l-2 border-yellow-400 pl-3 py-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Map scope</p>
            <p className="text-sm">World — more scopes coming later</p>
          </div>

          <Button onClick={handleCreate} disabled={busy}
            className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-black rounded-none uppercase tracking-widest font-bold mt-4">
            {busy ? "Creating…" : "Create Room →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
