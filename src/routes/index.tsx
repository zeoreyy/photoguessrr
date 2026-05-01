import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPlayerId } from "@/lib/playerSession";
import { COLORS } from "@/lib/game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PhotoGuessr — Guess where photos were taken" },
      { name: "description", content: "Multiplayer photo guessing game. Upload photos from your phone, friends guess the location on a world map." },
      { property: "og:title", content: "PhotoGuessr" },
      { property: "og:description", content: "A GeoGuessr-style party game with your own photos." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);

  const handleJoin = async () => {
    if (!nickname.trim() || code.length !== 4) {
      toast.error("Enter a nickname and 4-character room code");
      return;
    }
    setBusy(true);
    try {
      const upper = code.toUpperCase();
      const { data: room, error } = await supabase
        .from("rooms").select("*").eq("code", upper).maybeSingle();
      if (error || !room) {
        toast.error("Room not found");
        setBusy(false);
        return;
      }
      if (room.state !== "lobby") {
        toast.error("Game already in progress");
        setBusy(false);
        return;
      }
      const playerId = getPlayerId();
      // Check if already joined
      const { data: existing } = await supabase
        .from("players").select("*").eq("room_id", room.id).eq("id", playerId).maybeSingle();
      if (!existing) {
        const { count } = await supabase
          .from("players").select("*", { count: "exact", head: true }).eq("room_id", room.id);
        const color = COLORS[(count ?? 0) % COLORS.length];
        const { error: insErr } = await supabase.from("players").insert({
          id: playerId, room_id: room.id, nickname: nickname.trim(), is_host: false, color,
        });
        if (insErr) { toast.error(insErr.message); setBusy(false); return; }
      }
      navigate({ to: "/room/$code", params: { code: upper } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-md w-full text-center space-y-10">
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-sky-500/10 ring-1 ring-sky-500/30 mb-2">
            <div className="relative">
              <Camera className="w-10 h-10 text-sky-400" />
              <MapPin className="w-5 h-5 text-amber-400 absolute -bottom-1 -right-2" />
            </div>
          </div>
          <h1 className="text-6xl font-bold tracking-tight text-white">
            Photo<span className="text-sky-400">Guessr</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Friends upload photos. Everyone guesses where they were taken.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full h-14 text-lg bg-sky-500 hover:bg-sky-600 text-white"
            onClick={() => navigate({ to: "/create" })}
          >
            Create Room
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full h-14 text-lg border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white"
            onClick={() => setJoinOpen(true)}
          >
            Join Room
          </Button>
        </div>

        <p className="text-xs text-slate-600">
          Share your screen, gather friends, party game time.
        </p>
      </div>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Join a room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Room code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="ABCD"
                className="uppercase tracking-widest text-center text-2xl bg-slate-800 border-slate-700"
                maxLength={4}
              />
            </div>
            <div>
              <Label>Nickname</Label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                placeholder="Your name"
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleJoin} disabled={busy} className="bg-sky-500 hover:bg-sky-600 w-full">
              {busy ? "Joining…" : "Join"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
