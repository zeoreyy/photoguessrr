import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPlayerId } from "@/lib/playerSession";
import { COLORS } from "@/lib/game";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PhotoGuessr — Guess where photos were taken" },
      { name: "description", content: "Multiplayer photo guessing game. Upload photos from your phone, friends guess the location on a world map." },
      { property: "og:title", content: "PhotoGuessr" },
      { property: "og:description", content: "An editorial party game with your own photos." },
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
      if (error || !room) { toast.error("Room not found"); setBusy(false); return; }
      if (room.state !== "lobby") { toast.error("Game already in progress"); setBusy(false); return; }
      const playerId = getPlayerId();
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
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <span className="font-mono text-sm tracking-[0.3em] uppercase">PhotoGuessr</span>
        </div>
        <span className="hidden sm:block font-mono text-xs tracking-widest text-neutral-500 uppercase">
          v1 · Party Edition
        </span>
      </header>

      {/* Hero */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0">
        <section className="lg:col-span-8 border-b lg:border-b-0 lg:border-r border-neutral-800 px-6 sm:px-12 py-16 sm:py-24 flex flex-col justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-yellow-400 mb-8">
              ◆ A Game of Places
            </p>
            <h1 className="text-[14vw] sm:text-[10vw] lg:text-[8.5vw] leading-[0.85] font-black tracking-tighter uppercase">
              Where<br />
              <span className="text-yellow-400">was</span> this<br />
              taken?
            </h1>
            <p className="mt-10 max-w-xl text-base sm:text-lg text-neutral-400 leading-relaxed">
              Friends upload photos. Everyone else drops a pin on the map.
              Closest guess wins. No accounts. No nonsense.
            </p>
          </div>

          <div className="mt-16 flex flex-col sm:flex-row gap-3 max-w-xl">
            <Button
              onClick={() => navigate({ to: "/create" })}
              className="h-14 px-8 rounded-none bg-yellow-400 hover:bg-yellow-300 text-black font-bold uppercase tracking-widest text-sm flex-1"
            >
              Create Room →
            </Button>
            <Button
              onClick={() => setJoinOpen(true)}
              variant="outline"
              className="h-14 px-8 rounded-none bg-transparent border border-white hover:bg-white hover:text-black text-white font-bold uppercase tracking-widest text-sm flex-1"
            >
              Join Room
            </Button>
          </div>
        </section>

        <aside className="lg:col-span-4 px-6 sm:px-10 py-12 lg:py-24 flex flex-col gap-10">
          <Stat number="01" label="Pick a host" desc="They set rounds, timer, photo count." />
          <Stat number="02" label="Upload photos" desc="From your phone. GPS auto-detected." />
          <Stat number="03" label="Guess the spot" desc="Drop a pin. Score by distance." />

          <div className="mt-auto pt-10 border-t border-neutral-800">
            <Logo size={56} />
            <p className="mt-3 font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-500">
              Built for couches, road trips, and pubs.
            </p>
          </div>
        </aside>
      </main>

      <footer className="px-6 sm:px-10 py-4 border-t border-neutral-800 flex justify-between font-mono text-[10px] tracking-widest uppercase text-neutral-500">
        <span>© PhotoGuessr</span>
        <span>Black · Grey · Yellow</span>
      </footer>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="bg-black border border-neutral-800 text-white rounded-none">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest font-mono text-sm text-yellow-400">
              Join a room
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label className="uppercase font-mono text-[10px] tracking-widest text-neutral-400">Room code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="ABCD"
                className="uppercase tracking-[0.5em] text-center text-3xl bg-neutral-900 border-neutral-800 rounded-none h-16 mt-2"
                maxLength={4}
              />
            </div>
            <div>
              <Label className="uppercase font-mono text-[10px] tracking-widest text-neutral-400">Nickname</Label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                placeholder="Your name"
                className="bg-neutral-900 border-neutral-800 rounded-none h-12 mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleJoin}
              disabled={busy}
              className="bg-yellow-400 hover:bg-yellow-300 text-black w-full rounded-none h-12 uppercase tracking-widest font-bold"
            >
              {busy ? "Joining…" : "Join →"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ number, label, desc }: { number: string; label: string; desc: string }) {
  return (
    <div className="border-l-2 border-yellow-400 pl-4">
      <p className="font-mono text-xs text-neutral-500 mb-1">{number}</p>
      <p className="text-lg font-bold uppercase tracking-wide">{label}</p>
      <p className="text-sm text-neutral-400 mt-1">{desc}</p>
    </div>
  );
}
