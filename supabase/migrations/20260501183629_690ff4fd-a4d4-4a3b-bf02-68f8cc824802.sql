
-- Tables
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid NOT NULL,
  config jsonb NOT NULL,
  state text NOT NULL DEFAULT 'lobby',
  current_round int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  is_host boolean NOT NULL DEFAULT false,
  is_ready boolean NOT NULL DEFAULT false,
  color text,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  latitude double precision,
  longitude double precision,
  is_pinned boolean NOT NULL DEFAULT false,
  confirmed boolean NOT NULL DEFAULT false,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  photo_id uuid REFERENCES public.photos(id) ON DELETE SET NULL,
  started_at timestamptz,
  ended_at timestamptz
);

CREATE TABLE public.guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  distance_km double precision,
  points int,
  is_submitter boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, player_id)
);

-- Indexes
CREATE INDEX idx_players_room ON public.players(room_id);
CREATE INDEX idx_photos_room ON public.photos(room_id);
CREATE INDEX idx_photos_player ON public.photos(player_id);
CREATE INDEX idx_rounds_room ON public.rounds(room_id);
CREATE INDEX idx_guesses_round ON public.guesses(round_id);

-- Enable RLS but with permissive policies (party game, no auth required)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "public write rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "public update rooms" ON public.rooms FOR UPDATE USING (true);
CREATE POLICY "public delete rooms" ON public.rooms FOR DELETE USING (true);

CREATE POLICY "public read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "public write players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "public update players" ON public.players FOR UPDATE USING (true);
CREATE POLICY "public delete players" ON public.players FOR DELETE USING (true);

CREATE POLICY "public read photos" ON public.photos FOR SELECT USING (true);
CREATE POLICY "public write photos" ON public.photos FOR INSERT WITH CHECK (true);
CREATE POLICY "public update photos" ON public.photos FOR UPDATE USING (true);
CREATE POLICY "public delete photos" ON public.photos FOR DELETE USING (true);

CREATE POLICY "public read rounds" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "public write rounds" ON public.rounds FOR INSERT WITH CHECK (true);
CREATE POLICY "public update rounds" ON public.rounds FOR UPDATE USING (true);
CREATE POLICY "public delete rounds" ON public.rounds FOR DELETE USING (true);

CREATE POLICY "public read guesses" ON public.guesses FOR SELECT USING (true);
CREATE POLICY "public write guesses" ON public.guesses FOR INSERT WITH CHECK (true);
CREATE POLICY "public update guesses" ON public.guesses FOR UPDATE USING (true);
CREATE POLICY "public delete guesses" ON public.guesses FOR DELETE USING (true);

-- Realtime
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.photos REPLICA IDENTITY FULL;
ALTER TABLE public.rounds REPLICA IDENTITY FULL;
ALTER TABLE public.guesses REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guesses;

-- Storage bucket for photos (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read photos bucket" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "public upload photos bucket" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');
CREATE POLICY "public update photos bucket" ON storage.objects FOR UPDATE USING (bucket_id = 'photos');
CREATE POLICY "public delete photos bucket" ON storage.objects FOR DELETE USING (bucket_id = 'photos');
