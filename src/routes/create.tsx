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

function CreatePage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [photosPerPlayer, setPhotosPerPlayer] = useState(5);
  const [totalRounds, setTotalRounds] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!nickname.trim()) { toast.error("Nickname required"); return; }
    setBusy(true);
    try {
      const playerId = getPlayerId();
      // generate unique code
      let code = "";
      for (let i = 0; i < 5; i++) {
        const candidate = generateRoomCode();
        const { data: existing } = await supabase
          .from("rooms").select("id").eq("code", candidate).maybeSingle();
        if (!existing) { code = candidate; break; }
      }
      if (!code) { toast.error("Couldn't allocate room code"); setBusy(false); return; }

      const config: RoomConfig = {
        photos_per_player: photosPerPlayer,
        total_rounds: totalRounds,
        timer_seconds: timerSeconds,
        map_scope: WORLD_SCOPE,
      };

      const { data: room, error } = await supabase
        .from("rooms")
        .insert({ code, host_id: playerId, config: config as never, state: "lobby" })
        .select().single();
      if (error || !room) { toast.error(error?.message ?? "Failed"); setBusy(false); return; }

      const { error: pErr } = await supabase.from("players").insert({
        id: playerId, room_id: room.id, nickname: nickname.trim(), is_host: true, color: COLORS[0],
      });
      if (pErr) { toast.error(pErr.message); setBusy(false); return; }

      navigate({ to: "/room/$code", params: { code } });
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
            <Label>Your nickname</Label>
            <Input
              value={nickname} onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder="Host name" className="bg-slate-800 border-slate-700"
            />
          </div>
          <div>
            <Label>Photos per player</Label>
            <Input type="number" min={3} max={15} value={photosPerPlayer}
              onChange={(e) => setPhotosPerPlayer(Math.max(3, Math.min(15, +e.target.value || 5)))}
              className="bg-slate-800 border-slate-700" />
          </div>
          <div>
            <Label>Total rounds</Label>
            <Input type="number" min={3} max={15} value={totalRounds}
              onChange={(e) => setTotalRounds(Math.max(3, Math.min(15, +e.target.value || 5)))}
              className="bg-slate-800 border-slate-700" />
          </div>
          <div>
            <Label>Round timer (seconds)</Label>
            <Input type="number" min={10} max={120} value={timerSeconds}
              onChange={(e) => setTimerSeconds(Math.max(10, Math.min(120, +e.target.value || 30)))}
              className="bg-slate-800 border-slate-700" />
          </div>
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
