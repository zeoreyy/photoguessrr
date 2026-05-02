ALTER TABLE public.photos
  DROP CONSTRAINT IF EXISTS photos_player_id_fkey;

ALTER TABLE public.guesses
  DROP CONSTRAINT IF EXISTS guesses_player_id_fkey;

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_pkey;

ALTER TABLE public.players
  ADD CONSTRAINT players_pkey PRIMARY KEY (room_id, id);