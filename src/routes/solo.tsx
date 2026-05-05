import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPlayerId } from "@/lib/playerSession";
import { COLORS, WORLD_SCOPE, generateRoomCode, SOLO_LANDMARKS, type RoomConfig } from "@/lib/game";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/solo")({
  head: () => ({
    meta: [
      { title: "Solo Test — PhotoGuessr" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SoloPage,
});

function SoloPage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("Tester");
  const [totalRounds, setTotalRounds] = useState("5");
  const [timerSeconds, setTimerSeconds] = useState("30");
  const [busy, setBusy] = useState(false);

  const handleStart = async () => {
    const rounds = parseInt(totalRounds, 10);
    const timer = parseInt(timerSeconds, 10);
    if (!nickname.trim()) { toast.error("Enter a nickname"); return; }
    if (!Number.isFinite(rounds) || rounds < 3 || rounds > 10) { toast.error("Rounds must be 3–10"); return; }
    if (!Number.isFinite(timer) || timer < 10 || timer > 120) { toast.error("Timer must be 10–120 seconds"); return; }

    setBusy(true);
    try {
      const playerId = getPlayerId();

      let code = "";
      for (let i = 0; i < 5; i++) {
        const candidate = generateRoomCode();
        const { data: existing } = await supabase.from("rooms").select("id").eq("code", candidate).maybeSingle();
        if (!existing) { code = candidate; break; }
      }
      if (!code) { toast.error("Couldn't allocate room code"); setBusy(false); return; }

      const config: RoomConfig = {
        photos_per_player: rounds,
        total_rounds: rounds,
        timer_seconds: timer,
        map_scope: WORLD_SCOPE,
        is_solo: true,
      };

      const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .insert({ code, host_id: playerId, config: config as never, state: "lobby" })
        .select().single();
      if (roomErr || !room) { toast.error(roomErr?.message ?? "Failed to create room"); setBusy(false); return; }

      const { error: pErr } = await supabase.from("players").insert({
        id: playerId, room_id: room.id, nickname: nickname.trim(),
        is_host: true, is_ready: true, color: COLORS[0],
      });
      if (pErr) { toast.error(pErr.message); setBusy(false); return; }

      const botId = crypto.randomUUID();
      const { error: bErr } = await supabase.from("players").insert({
        id: botId, room_id: room.id, nickname: "Landmark Bot",
        is_host: false, is_ready: true, color: COLORS[1],
      });
      if (bErr) { toast.error(bErr.message); setBusy(false); return; }

      const shuffled = [...SOLO_LANDMARKS].sort(() => Math.random() - 0.5).slice(0, rounds);
      const photoRows = shuffled.map((lm) => ({
        id: crypto.randomUUID(),
        room_id: room.id,
        player_id: botId,
        storage_path: lm.url,
        latitude: lm.lat,
        longitude: lm.lng,
        is_pinned: true,
        confirmed: true,
      }));
      const { error: phErr } = await supabase.from("photos").insert(photoRows);
      if (phErr) { toast.error(phErr.message); setBusy(false); return; }

      navigate({ to: "/room/$code", params: { code } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <header className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-neutral-800">
        <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-yellow-400 font-mono text-xs tracking-widest uppercase">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <Logo size={32} />
      </header>

      <div className="max-w-md mx-auto px-6 py-12">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-yellow-400 mb-4">◆ Solo Test Mode</p>
        <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-tighter mb-2 leading-none">
          Test<br />the game.
        </h1>
        <p className="text-sm text-neutral-500 mb-10 font-mono">Famous landmarks · you guess · no friends needed.</p>

        <div className="space-y-6">
          <div>
            <Label className="block mb-2 uppercase font-mono text-[10px] tracking-widest text-neutral-400">Your nickname</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              className="bg-neutral-800 border-neutral-700 rounded-none h-12"
            />
          </div>

          <div>
            <Label className="block mb-2 uppercase font-mono text-[10px] tracking-widest text-neutral-400">Rounds (3–10)</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={totalRounds}
              onChange={(e) => setTotalRounds(e.target.value.replace(/[^0-9]/g, ""))}
              className="bg-neutral-800 border-neutral-700 rounded-none text-lg h-12"
            />
          </div>

          <div>
            <Label className="block mb-2 uppercase font-mono text-[10px] tracking-widest text-neutral-400">Round timer (10–120s)</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={timerSeconds}
              onChange={(e) => setTimerSeconds(e.target.value.replace(/[^0-9]/g, ""))}
              className="bg-neutral-800 border-neutral-700 rounded-none text-lg h-12"
            />
          </div>

          <Button
            onClick={handleStart}
            disabled={busy}
            className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-black rounded-none uppercase tracking-widest font-bold mt-4 disabled:bg-neutral-800 disabled:text-neutral-600"
          >
            {busy ? "Setting up…" : "Start Test Game →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
