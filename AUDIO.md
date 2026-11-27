# Audio

The game's sound effects and music are downloaded when the server installs
(`scripts/fetch-audio.mjs`, run from `npm install`), the same way three.js is.
Nothing is hotlinked at runtime: the files are written to `public/sounds/`
together with `manifest.json`, and they are also packed into `crazygames.zip`.

If `ffmpeg` is available (the optional `ffmpeg-static` package, or one on the
PATH), OGG and WAV sources are converted to MP3 (SFX: silence trimmed, mono,
44.1 kHz, 64 kb/s; music: loudness normalised to -18 LUFS, stereo, 96 kb/s).
Without ffmpeg the original files are kept.

In the game, every sound is processed again after decoding: silence below -45 dB
(relative to its peak) is trimmed, the length is capped with a fade-out, and
the peak is normalised to -1 dBFS. A per-cue gain from the manifest sets the
mix. Each cue can have several variants; one is picked at random (never the same
twice in a row) with ±5 % pitch jitter. There is a 40 ms per-cue rate limit and
a 22-voice cap. If a file is missing, the cue falls back to the built-in synth.

Music loops through a separate bus with its own volume (pause menu sliders),
crossfades between areas, ducks under menus and results, and all audio is
suspended while the tab is hidden.

## Sources

| Cue(s) | Source | Author | License |
| --- | --- | --- | --- |
| click, hover, open, close, tab, error, join, tick | Interface Sounds (`click_002`, `click_003`, `tick_002`, `maximize_006`, `minimize_006`, `switch_002`, `error_006`, `confirmation_002`, `tick_004`) via github.com/Calinou/kenney-interface-sounds @4596a49 | Kenney (kenney.nl) | CC0 |
| jump, land, coin, crate | 3D Platformer Starter Kit (`jump`, `land`, `coin`, `break`) github.com/KenneyNL/Starter-Kit-3D-Platformer @3fa8a04 | Kenney | CC0 |
| land, shoot, reload | FPS Starter Kit (`land`, `blaster_repeater`, `weapon_change`) github.com/KenneyNL/Starter-Kit-FPS @185fd23 | Kenney | CC0 |
| eat, bite | Match-3 Starter Kit (`tile-match`, `tile-swap`) github.com/KenneyNL/Starter-Kit-Match-3 @4ddb3d2 | Kenney | CC0 |
| jump 2043, djump 2648, dash 1461/1469, whoosh 2607/1471, hit 2155/2153/2143, ko 746/2050, pop 2364/2358, coin 2069, eat 117, boom 1694/1693, shoot 1670, splat 2889/2884, go 269, win 2068, lose 2876/473, item 254, boost 3164, fall 395/406, checkpoint 600, summit 555, zap 2365/1514, boing 2894, splash 1311, cheer 459 | mixkit.co sound effects (numbers are Mixkit IDs) | Mixkit | Mixkit Sound Effects Free License |
| Music: lobby, climb, party, battle | Retro Game Music Pack (Title Screen, Level 1, Level 2, Level 3) via github.com/ensisoft/gamestudio @4334bd1 | Juhani Junkala | CC0 |

Byte sizes (source and runtime) for each file are written into
`public/sounds/manifest.json` (`files[].srcBytes`, `files[].bytes`) on every
install.

## Cue map

`click hover open close tab error join tick` UI ·
`jump djump land` movement · `dash whoosh boost boing` motion ·
`hit ko pop splat bite eat` combat and eating · `boom crate zap` hazards ·
`coin item checkpoint summit go win lose cheer fall splash reload shoot` events.
