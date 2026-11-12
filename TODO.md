# macwaters.studio — finishing checklist

Tick items off by changing `[ ]` to `[x]`. (This file isn't published to the site.)
Text locations: open `index.html` and search (Cmd + F) for the quoted placeholder.

---

## 1. Writing

### Work desktop
- [ ] **work.txt intro** — search `[a general intro to the work]`
- [ ] **Hover blurbs** (one sentence each, in `data-blurb="…"` on each icon — no straight `"` quotes inside):
  - [ ] Book of Hours — `a forthcoming album. [one sentence]`
  - [ ] TikTokBox — `[one-sentence description]`
  - [ ] soloviolarecital — `[one-sentence description]`
  - [ ] SHOKWII — `[one-sentence description]`
  - [ ] Film Scoring — `original scores for films by other artists. [one sentence]`
  - [ ] Double-check the two drafts I wrote (DreamVisions+, GUIDED_MEDITATIONS)

### Project pages
- [ ] **DreamVisions+** — description (`[ongoing media project — a few sentences about it]`) + details line (`[WALLED_GARDEN installation · live performance · year]`)
- [ ] **GUIDED_MEDITATIONS** — description (`[description]`), year/credits (`[year · credits]`)
- [ ] **Book of Hours** — album description (`[album description]`), release date
- [ ] **TikTokBox** — description
- [ ] **soloviolarecital** — description: program, venue, date
- [ ] **SHOKWII** — description
- [ ] **Film Scoring** — fill in the credits list (film title · director · year), add/remove lines as needed
- [ ] **Composition** — description (`[a few sentences about your concert / chamber music]`), works list (title · year · instrumentation · performers), hover blurb (`[one sentence about your concert / chamber works]`)
- [x] **Decide** the section name → Concert Music

### Small stuff
- [ ] Update the hidden search-engine text at the very top of `index.html` (the `sr-only` block) and the `meta name="description"` line — they still say the old one-liner bio
- [ ] Give every image a short `alt="…"` description as you add them (for screen readers + Google)

---

## 2. Media to gather

Put **full-quality originals** in `assets_src/media-originals/<project>/` (not published) and ask Claude
to make web versions — or follow the export settings in `MEDIA_GUIDE.md` and drop them straight
into `public/media/<project>/`. Anything over a couple of minutes → Vimeo, and paste the link.

- [ ] **DreamVisions+**
  - [ ] gameplay video (short excerpt) → `public/media/dreamvisions/gameplay/`
  - [ ] WALLED_GARDEN installation photos → `public/media/dreamvisions/walled-garden/`
  - [ ] live performance video and/or photos → `public/media/dreamvisions/performance/`
- [ ] **GUIDED_MEDITATIONS**
  - [ ] upload the two full pieces to Vimeo → paste link (search `[watch the full pieces → Vimeo link]`, put the URL in `href="#"`)
  - [ ] (optional) tell Claude if you want a different excerpt than 0:30–1:30 for either video
- [ ] **Book of Hours**
  - [ ] album art (square, ~1200×1200 JPG)
  - [ ] pre-save link now → Bandcamp album link at release (Claude swaps in the player)
- [ ] **TikTokBox** — vertical video excerpt(s) → `public/media/tiktokbox/`
- [ ] **soloviolarecital** — recital video (excerpt and/or Vimeo link), any photos/program → `public/media/violarecital/`
- [ ] **SHOKWII** — video/images → `public/media/shokwii/`
- [ ] **Film Scoring** — a 60–90 s scoring reel (Vimeo or short mp4) → `public/media/for-others/scoring/`
- [x] **Desktop icon** `filmscoring.png`
- [ ] **Desktop icon** still missing: `composition.png` (47×47, transparent) → `public/media/thumbs/`
- [ ] **Concert Music — recordings** for playlist.exe: MP3s (192–256 kbps) in `public/media/composition/audio/`, named `track-01.mp3`, `track-02.mp3`, … — then edit each track's title/performers (search `[title] — [performers]`). Keep each under ~20 MB (excerpts are fine).
- [ ] **Concert Music — scores** for scores.book: one folder per piece in `public/media/composition/scores/` (e.g. `piece-1/`), page images named `p01.jpg`, `p02.jpg`, … (~1600 px tall). Then in `index.html` (search `data-folder=`) set each piece's title, folder, page count, and optional PDF.
- [ ] **Decide:** do graphics work for other artists and collaborations get their own stops? (folders exist: `for-others/graphics/`, `for-others/collabs/`)

---

## 3. Technical (in Terminal, from ~/code/macwaterssite)

- [ ] **Lighter castle** (biggest performance win) — run the `gltf-transform` command in `MEDIA_GUIDE.md`, then check the castle still looks right
- [ ] **Security warnings** — ask Claude to walk through `npm audit fix` together
- [ ] Commit + push at the end of every session (`git add .` → `git commit -m "…"` → `git push`)

## 4. Ask Claude to build (once the files/text above exist)

- [ ] Media windows for each project as the files come in (DreamVisions+ gallery + videos, Book of Hours player, TikTokBox video, recital, SHOKWII, scoring reel)
- [ ] **Mobile pass** — shrink the castle/ring header on phones, tidy stacked windows, test on a real phone (via the Vercel preview)
- [ ] **Link preview card** — the image + text that shows when someone shares macwaters.studio in a text/Instagram/email
- [ ] **Cleanup** — remove leftover placeholders, delete `assets_src/style.before-restore.css`, stop tracking `.DS_Store` files
- [ ] **Decide:** keep or remove the 🚧 "under construction" icon in the taskbar tray and the "scroll ↓" hint at launch

---

## 5. Launch

- [ ] Full click-through on the Vercel preview (laptop + phone): every cube, icon, Start-menu link, window, video
- [ ] `npm run deploy` → **macwaters.studio** goes live with the new site
- [ ] Check macwaters.studio loads (give it a few minutes), including on your phone
- [ ] (Optional) disconnect the Vercel preview, or keep it as your test copy for future changes

## Later
- [ ] The point-and-click castle game (click the blue cube → go inside the castle rooms)
