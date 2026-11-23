# 0.20.0

Sprite stacks: draw a solid in slices and get it from every heading, with shaded faces, moving parts and animations, on the grid of an isometric map. Scenes stand things on map cells and terraces and export as isometric maps. Godot gets an editor addon.

- **Sprite stacks:** a new source format, `pixelforge-stack` (`pixelbolt help stack`), compiles a solid drawn as slices into a frame at every heading. `ramps` and one `light` shade its faces; `"projection": "iso", "cell": 1` draws it in the pixels of an isometric tile map; side paint, glass, facets, jointed paths, surface reliefs and contours add detail. `inspect --rotate`, `--pin` and `--pose-sheet` review a turn, and Studio paints faces and scrubs headings.
- **Moving parts and animations:** a part rides a socket and turns about its axis (a lid, sails, a gun, a leg), and an animation keys sockets and poses by frame and is baked at every heading as `<name>-<heading>` or `<name>-<direction>`.
- **Twelve stack presets:** `copper-rally`, `lodekeeper-faceted`, six shaded pieces for an isometric map (`iso-crate`, `iso-barrel`, `iso-pine`, `iso-cottage`, `iso-tower`, `iso-wall`) and four that move (`iso-windmill`, `iso-chest`, `iso-cannon`, and `iso-villager`, who walks and idles in eight directions).
- **Scenes on isometric ground:** a placement stands on a map cell with `"on"` and `"cell"`, an iso map's `heights` raise cells into terraces, and what stands on a cell is drawn with it. `examples/iso-hamlet.scene.json` is a terraced hamlet placed by cell.
- **For a game:** a recipe's `headings` say which frame and animation stand at each heading, and `player.js` (`nearestHeading`, `headingFrame`, `headingAnimation`, `headingToward`) and the Godot `SpriteFrames` metadata look them up. `compile --slices` writes a stack's slices as a sheet, which `drawStack` and the addon's `sprite_stack.gd` turn to any heading at run time. A scene on iso ground exports an isometric Tiled map (`scene.tmx`) and an isometric Godot TileSet (`tileset_iso.tres`).
- **Pixelbolt for Godot:** `pixelbolt-godot-0.20.0.zip`, attached to this release, is an editor addon that imports `*.pixel.json` (Godot 4.5 and later) and `*.pixelbolt` (4.3 and later) files as `SpriteFrames` or a `TileSet`, using your own Pixelbolt CLI.
- **Air pockets keep their air:** the last of a glugging bottle runs out instead of leaping back to the bottle's roof, a thin film of liquid lets air through, and a pocket draws air up through hanging liquid as bubbles.
- **Other agents:** Agent Plugins 1.0.0 clients, such as Codex and GitHub Copilot CLI, load the repository's `plugin.json` and `mcp.json`.
- **Animate a sprite you already have:** the `sprite-walk` example and its guide turn one side-view PNG into a walk and an idle.
- **Reported faults:** a filled polygon is its outline plus every pixel centre inside it; a tile set's preview row wider than 256 tiles is refused at compile; a falling-sand source that breaks a starter reaction is told which material and reaction.

Changed since 0.19.0, check before upgrading:
- A filled `polygon` drawn by 0.19.0 gains the pinholes inside its down-left sloping right edges and loses a stray pixel outside the left ones. Review a piece that pins those pixels.
- Liquids with trapped air (an upturned bottle, a pocket under a shelf that opens) play out differently, and the `glug` preset is redrawn. Every other fluid preset renders as before.
- In the repository the skill's folder is `skills/pixelbolt-pixel-art/` (it was `skills/pixel-art/`); update anything that reads it from a checkout. `pixelbolt skill install` writes the same folder as before.

Known issues:
- A slice sheet (`compile --slices`) leaves out moving parts, animations, facets and paths, and says so: those play from the baked frames.
- A stack on a map's grid (`cell`) is baked about 1.4 times wider than its slices stack at run time, so bake what stands on a map and stack what turns freely.
- On a canvas, a run-time stack turned between quarter turns has soft outer edges below scale 3. At quarter turns it is the baked frame pixel for pixel.
- `compile --slices` is refused when the stack's baked frames would not fit a recipe, though the slices would: give the source a lower `resolution` or one heading for that compile.
- A stack's sockets do not carry one another, a part cannot be hidden for a frame, and facets and paths take no shade from `ramps`. Studio plays parts and animations but does not edit them.
- An iso tilemap with `heights`, or one sorted among the placements, reaches Tiled as tile objects, not a tile layer. The isometric Godot TileSet has plain tiles and no terrains, and `scene.tscn` draws the scene from baked planes, not a `TileMapLayer`.
- A scene placement that moves is placed by pixels, not by cell.
- A forced re-export that drops the normal pass leaves `<name>.canvas.tres`, `<name>.normal.png` and `<name>.normal_y_up.png` in the folder: a TileSet or SpriteFrames saved in Godot may still use them, so delete them by hand if nothing does.
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
