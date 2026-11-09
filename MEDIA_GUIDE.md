# Media guide

Everything in `public/media/` gets published with the site.
(The empty `.gitkeep` files just make git keep the empty folders — leave them or delete them once real files are in.)

```
public/media/
├── dreamvisions/
│   ├── gameplay/          gameplay video
│   ├── walled-garden/     WALLED_GARDEN installation photos
│   └── performance/       live performance video + photos
├── guided-meditations/    the two side-by-side videos
├── tiktokbox/             video excerpts (probably vertical)
└── for-others/
    ├── scoring/           scoring reel / excerpts
    ├── graphics/          graphics work for other artists
    └── collabs/           collaborations + performances
```

## File names

- lowercase, hyphens, no spaces: `walled-garden-01.jpg`, `meditation-left.mp4`
- number things in the order you want them shown: `-01`, `-02`, `-03`

## Video (Premiere → File → Export → Media)

| Setting | Value |
|---|---|
| Format | **H.264** (saves as .mp4) |
| Frame size | **1280×720** for clips shown in a window; 1920×1080 only for big/fullscreen pieces. Vertical: 720×1280 |
| Frame rate | match source |
| Bitrate encoding | **VBR, 1 pass** |
| Target bitrate | **2–3 Mbps** at 720p, **4–5 Mbps** at 1080p |
| Maximum bitrate | about 1.5× the target |
| Profile / level | High / 4.1 |
| Audio | AAC, 48 kHz, stereo, **128–192 kbps** |
| Muted loops | **uncheck Export Audio** entirely (smaller file) |
| Use Maximum Render Quality | on, if you're scaling down |

**Size targets:** loops and previews (10–30 s) under ~10 MB; longer excerpts under ~30 MB.
GitHub refuses any single file over 100 MB, and every visitor downloads the whole file —
anything long or high-quality belongs on Vimeo, and you drop the link in a text file
in the folder instead (e.g. `vimeo-link.txt`).

Rough math: megabytes ≈ Mbps × seconds ÷ 8. So 3 Mbps × 30 s ≈ 11 MB.

## Photos

- **JPG** for photos (quality ~80), **PNG** only when you need transparency (like `about-me.png`)
- long edge **1600–2000 px** — bigger is wasted on the web
- aim for **under ~500 KB** each

## Desktop icon thumbnails (the work page)

Save these in `public/media/thumbs/` — they replace the placeholder emoji automatically:

- `dreamvisions.png`, `meditations.png`, `bookofhours.png`, `tiktokbox.png`
- square, **192×192 px** (shows at 96px, so 2× stays crisp on retina), transparent PNG is great

## Full-length originals

Long/large originals live in `assets_src/media-originals/` (not published, not in git).
The site uses short web versions made from them — e.g. the GUIDED_MEDITATIONS windows play
60-second excerpts (`public/media/guided-meditations/meditation-1.mp4`, `-2.mp4`, ~17 MB each).
Full pieces belong on Vimeo, linked from the description window.

## 3D models

- Use **.glb** (not .obj) — smaller and faster to load. Export as glTF Binary from Blender/Maya/Unity.
- Keep model textures at **1024px or less**; the site shrinks bigger ones anyway, but they still cost download time.
- Source files (4K textures, .obj originals, etc.) live in `assets_src/`, which isn't published.

### Making a lighter castle (do this once, in Terminal, from ~/code/macwaterssite)

```
npx @gltf-transform/cli optimize public/models/castle/castle_web.glb public/models/castle/castle_lite.glb --compress draco --texture-size 1024 --simplify-ratio 0.15 --simplify-error 0.01
```

This keeps ~15% of the castle's 1.3 million points and shrinks its textures. The site
automatically uses `castle_lite.glb` if it exists (and falls back to `castle_web.glb` if not).
If it looks too chunky, try `--simplify-ratio 0.3`.

## Notes for each project (a few sentences is plenty)

Put a `notes.txt` in each project folder with:
- title, year, and a short description
- credits / collaborators
- anything about how it should be shown (e.g. "these two play together")
