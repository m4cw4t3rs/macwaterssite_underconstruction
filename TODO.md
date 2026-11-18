# macwaters.studio — finishing checklist

Tick items off by changing `[ ]` to `[x]`. (This file isn't published to the site.)
Text locations: open `index.html` and search (Cmd + F) for the quoted placeholder.
Last checked against the files: Nov 18

---

## 1. Writing (index.html)

### Done
- [x] work.txt intro
- [x] All 8 desktop hover blurbs
- [x] Years on every desktop icon + project heading (bracket style, e.g. `[2024]`)
- [x] Concert Music: works list (3 pieces with instrumentation + performers), hover blurb, section name

### Project page text still to write
- [ ] **Concert Music** — intro paragraph: `[a few sentences about your concert / chamber music]`
- [x] **DreamVisions+** — `[ongoing media project — a few sentences about it]` + details line `[WALLED_GARDEN installation · live performance · year]` (the year is already in the heading — you can drop it from this line)
- [x] **GUIDED_MEDITATIONS** — `[description]` + `[credits]`
- [ ] **Book of Hours** — `[album description]`
- [x] **TikTokBox** — `[description]`
- [x] **soloviolarecital** — `[description — program, venue, date]`
- [x] **SHOKWII** — `[description]`
- [x] **Film Scoring** — credits list (4 films)

### Works lines — fill in the blanks (format: *Title* (Year), medium, site — see MEDIA_GUIDE.md)
- [x] DreamVisions+_WALLED_GARDEN.exe — `([year])` and `[site]` (gallery / exhibition)
- [x] GUIDED_MEDITATION_1 — `[site]` (where it was shown/screened, or delete `, [site]` if nowhere specific)
- [x] TikTokBox — `[city]` for the New Music Festival (or delete it)
- [x] SHOKWII — `[city]` for the (A)TEMPORALITIES showcase (or delete it)

### Small stuff
- [x] Hidden search-engine text + page description updated from the new bio
- [ ] Give every new image a short `alt="…"` description as you add them

---

## 2. Media to gather

Drop **full-quality originals** in `assets_src/media-originals/<project>/` (not published) and ask
Claude to make web versions. Anything long → Vimeo/YouTube/Bandcamp, and paste the link.

### Done
- [x] GUIDED_MEDITATIONS: two video excerpts (playing, hover-for-sound)
- [x] Concert Music: 3 recordings in playlist.exe, 3 scores in scores.book (all pages + PDFs)
- [x] DreamVisions+ logo
- [x] All 8 desktop icons (incl. `composition.png`, `filmscoring.png`)

### Still needed
- [x] **DreamVisions+** — logo, 4 performance excerpts (clip switcher), WALLED_GARDEN photos + looping clip
  - [ ] Hi-8 gameplay rip → loop for the `WALLED_GARDEN.exe` window (drop in `assets_src/media-originals/dreamvisions/`)
  - [ ] (later) a proper performance trailer — can replace or join the excerpt buttons
- [ ] **GUIDED_MEDITATIONS** — upload the full pieces to Vimeo → paste the link (search `[watch the full pieces → Vimeo link]`, put the URL in `href="#"`)
- [ ] **Book of Hours** — album art (square, ~1200×1200) + pre-save link now → Bandcamp at release
- [ ] **TikTokBox** — vertical video excerpt(s)
- [ ] **soloviolarecital** — recital video (excerpt and/or Vimeo link), photos/program
- [ ] **SHOKWII** — the film (Vimeo/YouTube link or short excerpt) + stills
- [ ] **Film Scoring** — a 60–90 s scoring reel (Vimeo or short mp4)
- [ ] **Decide:** do graphics work for other artists / collaborations get their own stops? (folders exist: `for-others/graphics/`, `for-others/collabs/`)
- [ ] **Decide:** should the "open pdf ↗" score downloads stay public? (to hide one, empty its `data-pdf=""`)

---

## 3. Technical (Terminal, from ~/code/macwaterssite)

- [ ] **Lighter castle** — biggest performance win, ~5 minutes: run the `gltf-transform` command in `MEDIA_GUIDE.md`, then check the castle still looks right
- [ ] **Security warnings** — walk through `npm audit fix` with Claude
- [ ] Commit + push at the end of every session (`git add .` → `git commit -m "…"` → `git push`)

## 4. Ask Claude to build

- [ ] Media windows for each project as files come in (DreamVisions+ gallery + videos, Book of Hours art/player, TikTokBox video, recital, SHOKWII, scoring reel)
- [ ] **Mobile pass** — shrink the castle/ring header on phones, tidy stacked windows, test on a real phone
- [ ] **Link preview card** — the image + text shown when someone shares macwaters.studio
- [ ] **Cleanup** — remove leftover placeholders, delete `assets_src/style.before-restore.css`, stop tracking `.DS_Store` files
- [ ] **Decide:** keep or remove the 🚧 icon in the taskbar tray and the "scroll ↓" hint at launch
- [ ] **Decide:** launch with every project, or hide the unfinished ones until they're ready
  - Film Scoring is **hidden** for launch (`HIDDEN_STOPS` in `main.js`) — remove `'filmscoring'` from that list once the films are out

---

## 5. Launch

- [ ] Full click-through on the Vercel preview (laptop + phone): every cube, icon, Start-menu link, window, video, back button, browser Back
- [ ] `npm run deploy` → **macwaters.studio** goes live
- [ ] Check macwaters.studio (give it a few minutes), including on your phone
- [ ] (Optional) disconnect the Vercel preview, or keep it as your test copy

## Later
- [ ] The point-and-click castle game (blue cube → inside the castle rooms)
