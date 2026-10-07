# VERITY TIME — Development Roadmap

## Audit (phase 1)

* Repository contained only an unrelated Telegram "gift roulette" HTML page; no engine project.
* Container: Linux, 4 CPU, no GPU, no Unity/Unreal/Godot. Node 22, Chromium (Playwright), ffmpeg.
* Decision: **Three.js + TypeScript + Vite**, packaged for PC with **Electron** (Windows/Linux).
  Everything that cannot be hand-authored here (models, textures, audio, music) is
  produced **procedurally at runtime** by dedicated generators, so the build contains
  no placeholder art and no third-party IP.
* Verification: headless Chromium (SwiftShader WebGL) for screenshots and scripted
  playthrough QA; vitest for pure logic (save, puzzles, nav, collision).

## Architecture (phase 2)

```
src/
  core/       loop, events, coroutines, input & bindings, settings, game state, save
  render/     renderer, post-processing, virtual light pool, quality presets
  assets/     procedural textures (albedo/normal/ORM), material library, fonts
  physics/    AABB collision world, raycasts, spatial hash
  player/     FPS controller, flashlight, hiding, carrying/throwing
  interaction/interactables (doors, switches, pickups, documents, sockets, keypads...)
  world/      level builder (rooms with openings), static batching, cells (occlusion), zones
  models/     procedural prop library, Verity rig, Warden robot
  ai/         nav grid + A*, Verity brain, Warden brain, perception, director
  audio/      WebAudio engine, synthesized SFX, ambience beds, Verity theme (4 variants)
  narrative/  documents, audio logs, Verity dialogue, subtitles
  puzzles/    12 puzzle state machines (pure logic, unit-tested) + 3D front-ends
  zones/      6 zones + finale
  ui/         HUD, menus, settings, key binding, journal, inventory, reader, terminal
  debug/      debug panel (teleport, god, noclip, puzzle/trigger reset, FPS, collision/AI view)
```

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Project audit | done |
| 2 | Architecture | done |
| 3 | Player controller (walk/sprint/crouch/jump, stamina, hiding, carry/throw) | done |
| 4 | Interaction (doors, bolts, levers, pickups, documents, tapes, keypads, terminals) | done |
| 5 | Save system (autosave checkpoints, 3 slots, settings) | done |
| 6 | First environment (prologue, Act I) | done |
| 7 | Puzzle system — 12 puzzles, logic unit-tested | done |
| 8 | Verity character (rig, 5 degradation stages, expressions) | done |
| 9 | AI (nav grid A*, Verity watch/guide/hunt/chase/search, Warden) | done |
| 10 | Horror events / director | done |
| 11–16 | Zones: outside, lobby, factory, research, playland, old works, core | done |
| 17 | Cinematics (film reel, carousel ride, stage, endings, epilogue) | done |
| 18 | Audio (synth SFX, formant voices, theme in 7 arrangements) | done |
| 19 | VFX (dust, light cones, sparks, rain, lightning, glitch) | done |
| 20–22 | Polish / optimisation / QA (scripted playthroughs per act, auto quality) | done |
| 23 | Final build (Electron, Windows + Linux packages) | done |

## Content plan

| Zone | Act | Puzzles | Set pieces |
|------|-----|---------|-----------|
| 1. Welcome Hall (lobby, gift shop, security, theatre) | I The Welcome | P1 breaker capacity, P2 birthday keypad | first sighting on stage |
| 2. Toy Works (factory floor, paint shop, warehouse) | II The Factory | P3 conveyor routing, P4 colour mixing, P5 FriendLink relay | Verity helps; Warden stealth |
| 3. Harmony Dept. (labs, Hale's office, archive) | III Something is wrong | P6 terminal restore, P7 archive index | the reel; "it learned to lie" |
| 4. Playland (carousel, ball pit, shadow theatre, Theo's room, party rooms) | IV The Friend | P8 carousel melody, P9 shadow theatre | Verity's questions; **Chase 1** (doors/power/hiding) |
| 5. Old Works (steam, flooded tunnels, Forever Room) | V Lower levels | P10 steam routing, P11 music-box tuning | **Chase 2** (routes/noise/cameras) |
| 6. The Core (shifting corridor, the Heart) | VI Chase / finale | P12 heart vault (combined) | **Chase 3** (shifting architecture), 3 endings |
