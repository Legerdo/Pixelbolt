# 0.18.0

Effects that arrive finished: light that spreads from what shines and falls on what is near it, twelve presets drawn as whole assets, frames up to 1024 pixels a side for full-screen overlays, and a compile that says when a one-shot is cut off.

- **Light, not an aura:** `shine` on a fluid effect or a particle effect floods light from what shines through the picture on every frame. A solid thing is lit on its near side, dark further in, and shadows what is behind it, and the light has no shape of its own. `pixelbolt help workflow "Light in an effect"` has the guide.
- **Twelve finished presets:** the fluid effects `wall-torch`, `chimney-smoke`, `campfire-stones`, `fireball-explosion` and `cannon-smoke`, and the particle effects `stone-portal`, `frost-nova`, `teleport-in`, `coin-sparkle`, `electric-arc`, `ice-crystal` and `forest-waterfall`. Each draws the thing its effect comes from, at 64 to 144 pixels a side, and compiles as it ships: `pixelbolt gif --preset frost-nova --out frost-nova.gif`.
- **One-shots that end:** a one-shot particle effect whose last frame still draws is cut off where a game ends it. The compile now warns and names what can reach the last frame; `residue: true` accepts a last frame that is meant to stay. Thirteen shipped effects were given the frames to end empty.
- **Bigger frames:** an animation frame, a scene asset and an imported frame may be up to 1024 pixels a side and 262,144 pixels, so a 320 × 180, 480 × 270 or 640 × 360 overlay (rain, snow, fog) is one recipe. A scale too big for a sheet or a GIF names the largest that fits, and an effect too long for its frame total names a frame count that compiles.
- **A scene in Godot plays its animations:** `scene.tscn` plays a placement that stands still and animates (a rain overlay, a torch) on an `AnimatedSprite2D` over its asset's `sprite_frames.tres`, where it comes in drawing order, as `scene.tmx` already did in Tiled. It was baked into a plane as its first frame.
- **One call where there were several:** `render --columns` for a one-row strip; `inspect --stack` and `--under` to see frames laid over one another as a game draws them; `import --atlas` for Aseprite-style atlases, with their tags as animations; `drawFrame` with `rotate` in the Canvas runtime; a falling-sand clip straight to video frames, past 256 frames (`pixelbolt sequence`).
- **MCP:** the server answers the 2026-07-28 handshake (`server/discover`, then stateless requests) beside the older one. A render's reply lists its frames folder in `files`.
- **Reported faults:** a trimmed sheet's normal map lines up with its colour sheet; `saveAs` never writes over a normal pass's files; a frame palette that changes nothing says so; an autotile variant that names a longer palette key renders its test map again.
- **Found by the review before this release:** `inspect --beside` refits stacks that fit, where it refused some that 0.17.0 drew; stills on a trimmed sheet have an export budget; a fluid's light lies on the pixels a rigid body is drawn on; `saveAs` knows a lit export's Godot CanvasTexture; and refusals that named a scale, a count or an option the next call refused name one that works.

Changed since 0.17.0, check before upgrading:
- A render's reply has no `folders` field. Read `frames` and `animations` for the counts.
- A one-shot particle effect of yours that ends with pixels on screen now warns when compiled.
- Thirteen shipped one-shot effects are one to four frames longer (the fire explosion 16 to 19, the healing circle 18 to 21, the hero's teleport 14 to 18), so re-export where a game holds their frame counts.
- A scene export's `scene.tscn` names `assets/` as well as `planes/` once the scene has an animated placement: copy both folders beside it.
- An export whose frames, written whole to `frames/`, pass 67,108,864 pixels is refused with the scale that fits. Stills on a trimmed sheet at a large scale were exported whatever their size.

Known issues:
- A render at the full frame total (4,194,304 pixels of frames) takes about a minute, most of it compressing the PNG.
- In Godot's `scene.tscn`, a placement that moves, follows `sequence` cues or changes anchor between frames is drawn as it is at the scene's start; the export warns and names it.
- Pose, bodies, crystal, normals and falling-sand sources keep 256 pixels a side, and fluid and wave sources 128.
- Where an effect is too long for its frame total, following the reply's "own frames" route can end in a second refusal about an emitter's `start`, and its "once the loop has N frames" route in a particle limit.
- Light on a screen-sized effect is slow to compile: 640 × 360 over 256 frames takes about half a minute.
- Hand-drawn recipes have no `shine`, and a fluid one-shot that is cut off is not warned about. The one-shot warning does not see a particle still drawn over a sprite the effect draws.
- In a shell, `pixelbolt help <schema part>` prints indented JSON, so a part that is under 12 KB over MCP can pass that there (`help terrain` is 19 KB).
- A one-row sheet wider than 16,384 pixels (`--columns` with 1024-wide frames) can't be imported again.
- The particle examples in `effects.fx.json` (sparks, dust, leaves, shards) still end with a few pixels on screen.
- Scenes with `breaks`, liquids with bodies stacked in them, the plasma presets' arcs and every falling-sand scene play out differently from 0.16.0: review before re-rendering a piece published from 0.16.0 or earlier.
- A pocket of liquid sealed on every side leaks past the obstacle that shuts it in one frame.
- A liquid emitter at `rate` 1 only dips under a `pulse`; it never passes its steady reach.
- A row of thin pieces standing on the floor (bowling pins) is shoved along by a ball rather than knocked flat; stacks of blocks fall as they should.
- A rope given a `density` far lighter than its load stretches; left without one, it holds.
- Cloth is moved by bodies and obstacles but does not push them, and is drawn at the world's pixels in video.
- `compile --size` keeps a drawing that touches one edge of its canvas on that edge, so the fox gets its margin below.
- Some command-line replies still name the MCP call that fixes a mismatch.
- Thin smoke in falling sand still reads as dark blobs, and compiled falling-sand recipes are large (0.2–2.5 MB).
- With Godot's pixel snapping, a camera between whole pixels can put a parallax plane a pixel from where Pixelbolt draws it.
- Tails of five or more short links can thrash, and a far elbow can snap between frames in walks of 32 or more frames.
- Left-facing jumps, attacks and hurts aren't mirrored.

The full list of changes is in `CHANGELOG.md`.

The bundle keeps its 0.8.0 name, `pixelbolt.mcpb` (checksum `pixelbolt.mcpb.sha256`). The `pixelforge` command still works as an alias.

`pixelbolt.mcpb` contains the local Node.js MCP server, its eight tools, schemas, authoring help and the shipped examples, so every preset compiles from the bundle. The server makes no network requests.

Download `pixelbolt.mcpb` and open it in Claude Desktop, or use Settings -> Extensions -> install from file. Choose a workspace for recipes and generated artwork, then ask the agent to call `pixel_help`. The bundle uses the client's Node.js runtime (20 or newer); it does not include Node.js.

Download `pixelbolt.mcpb.sha256` beside the bundle to check its SHA-256:

```sh
sha256sum --check pixelbolt.mcpb.sha256
gh attestation verify pixelbolt.mcpb --repo skulitom/Pixelbolt --signer-workflow skulitom/Pixelbolt/.github/workflows/release.yml
```

On PowerShell, `(Get-FileHash pixelbolt.mcpb -Algorithm SHA256).Hash` should match the hash in the checksum file.

The GitHub release makes the bundle available immediately. MCP Registry publication is a separate, manually dispatched step after testing; see [Publishing](https://github.com/skulitom/Pixelbolt/blob/main/docs/PUBLISHING.md).
