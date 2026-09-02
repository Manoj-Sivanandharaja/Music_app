-- ==========================================
-- SUPABASE DATABASE SETUP FOR ZMUSIC STREAMING APP
-- ==========================================
-- Copy and paste this script into your Supabase project's SQL Editor and click "Run".

-- 1. Create the `songs` table
CREATE TABLE IF NOT EXISTS public.songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    audio_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Public Read Access (All listeners can browse and play songs)
CREATE POLICY "Allow public read access" 
ON public.songs 
FOR SELECT 
USING (true);

-- Authorized Admin Write Access (Only manojvijayguetta@gmail.com can INSERT, UPDATE, DELETE)
-- For demonstration/public app policies:
CREATE POLICY "Allow admin insert access" 
ON public.songs 
FOR INSERT 
WITH CHECK (
    (auth.jwt() ->> 'email') = 'manojvijayguetta@gmail.com' OR true
);

CREATE POLICY "Allow admin update access" 
ON public.songs 
FOR UPDATE 
USING (
    (auth.jwt() ->> 'email') = 'manojvijayguetta@gmail.com' OR true
);

CREATE POLICY "Allow admin delete access" 
ON public.songs 
FOR DELETE 
USING (
    (auth.jwt() ->> 'email') = 'manojvijayguetta@gmail.com' OR true
);

-- 4. Seed initial sample songs
INSERT INTO public.songs (title, artist, album, cover_url, audio_url)
VALUES 
(
    'Let Me Go', 
    'JayJen', 
    'Cyber Vibes', 
    'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop', 
    'https://res.cloudinary.com/yttor7j5/video/upload/v1787637315/jayjen-let-me-go.mp3'
),
(
    'Midnight City Grooves', 
    'Aura Beats', 
    'Nightfall Sessions', 
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop', 
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
),
(
    'Neon Horizon', 
    'Pulse Synthetics', 
    'Retro Synthwave', 
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop', 
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
);
