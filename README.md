# Audionix - Dynamic Cloudinary Music Streaming Web App

A clean, modern Spotify-like music streaming website built with **HTML5, CSS3, Vanilla JavaScript**, and **Supabase Database**.

---

## 🌟 Key Features

### 🎧 User Side
1. **Dynamic Song Streaming**: Automatically fetches and renders songs from your Supabase database (`songs` table).
2. **Track Info & Covers**: Displays song title, artist name, album title, and cover artwork.
3. **Cloudinary Audio Player**: Plays MP3 files directly from Cloudinary audio URLs.
4. **Interactive Controls**:
   - Play/Pause with glowing pulse animation.
   - Next & Previous track navigation.
   - Scrubbable progress bar with real-time current time and total track duration.
   - Volume control slider & mute toggle.
   - Shuffle queue & Loop/Repeat track toggles.
5. **Real-time Live Search**: Filter songs instantly by title, artist, or album.
6. **Responsive Dark UI**: Sleek glassmorphism dark theme, desktop sidebar, and mobile responsive drawer.

### 🛠️ Admin Side
1. **Add Song Form**:
   - Song Title
   - Artist Name
   - Album
   - Cover Image URL (with real-time image preview)
   - Cloudinary Audio URL
   - Submit & Publish button
2. **Auto Synchronization**: Newly submitted songs immediately save to Supabase and appear on the user side without reloading the page.
3. **Edit & Delete Songs**: Full CRUD controls to edit song details or remove tracks from the database.

---

## 🗄️ Supabase Table & Database Setup

### 1. Execute SQL in Supabase
Open your [Supabase Dashboard](https://supabase.com), select your project, go to the **SQL Editor**, paste the code from [`supabase_setup.sql`](file:///c:/Users/Manoj/Downloads/Music%20app/supabase_setup.sql) and click **Run**:

```sql
-- Create songs table
CREATE TABLE IF NOT EXISTS public.songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    audio_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and setup public access policies
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.songs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.songs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.songs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.songs FOR DELETE USING (true);
```

### 2. Connect App to Supabase
1. Open `index.html` in your browser.
2. Click **"Config DB Keys"** in the sidebar or the Key icon in the top header.
3. Enter your **Supabase Project URL** (e.g. `https://xyzcompany.supabase.co`) and **Anon API Key**.
4. Click **Save & Connect Database**. Your credentials will save securely to `localStorage` and fetch songs directly from your database.

---

## 🎵 Cloudinary Audio URL Example

When adding songs via the Admin panel, enter your Cloudinary MP3 audio link in the **Cloudinary Audio URL** field:

- **Example Cloudinary Audio URL**:
  `https://res.cloudinary.com/yttor7j5/video/upload/v1787637315/jayjen-let-me-go.mp3`

---

## 🚀 Running locally

Since this project uses vanilla HTML, CSS, and JS (ES Modules & Supabase CDN), you can run it directly:
- Simply open `index.html` in any browser or launch it with a local HTTP server (like VS Code Live Server or `python -m http.server 8000`).
