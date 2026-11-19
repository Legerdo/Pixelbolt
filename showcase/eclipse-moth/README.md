# Eclipse Moth

![A copper and mint moth beating its wings beneath a solar eclipse](flight.gif)

The [editable recipe](eclipse-moth.json) plays 64 frames at 80 ms each. Both forewings use the same 49 drawing operations, including the veins and crescent eyespot. The hindwings share a second drawing. All four shoulders follow the `hover` group. The two right wings reflect their parts around their shoulder pivots.

The nine keys in `scaleTracks.wingbeat` control the deep fold and the smaller flutter that follows it. The forewings sample the track together. The hindwings follow 320 ms later. To delay the deepest fold by three frames, apply this single Pixelbolt patch.

```json
[{"set":"scaleTracks.wingbeat.keys[2].at","value":1280}]
```

The original key is at 1040 ms with scale `[0.23,1.08]`. Its first number controls how narrow the wings get. The second controls their height. The eyespots move with the wing surface. [Watch the two timings side by side](wingbeat-comparison.gif).

From the repository root, render to a fresh folder.

```sh
node bin/pixelbolt.js render showcase/eclipse-moth/eclipse-moth.json --out output/moth-flight --gif-scale 3
```
