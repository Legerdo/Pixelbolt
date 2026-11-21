# Rimefiend

![A violet demon turning, with bat wings, swept crystal horns and one outstretched hand](turn-preview.gif)

A 4.2-second turntable based on the demon reference. The pose holds one hand open toward the viewer and the other curled at its side. The wings flex slightly at the shoulders. The digitigrade legs and ridged back extend the design beyond the reference crop.

![The same head and claw on dark slate and warm parchment, enlarged three times](crystals.png)

The horns, wing thumbs, fingernails and toenails are faceted blue-green crystal. Follow the long horn over the left wing in the two panels. The wing shows through its base, while the upper edge takes on the colour behind it. Both panels use the same pixels from the 333° heading.

The [animated PNG](turn.png) preserves partial alpha in every frame. The [sprite sheet](rimefiend.png) and [atlas](rimefiend.atlas.json) hold 60 frames of 235 × 270 pixels at 70 ms each. All headings share the ground anchor (117, 217). The GIF preview is enlarged 2× over slate.

The [editable stack](rimefiend.stack.json) renders directly in Pixelbolt. The [builder](build.mjs) defines the muscle volumes, individual finger and horn paths and the two wing sockets. To compare one wing at three angles while holding the camera and the body still, run

```sh
node bin/pixelbolt.js inspect showcase/rimefiend/rimefiend.stack.json --rotate wing-right,297,348,0,12 --scale 1 --out wing-study.png
```

To rebuild into a fresh directory from the repository root, run

```sh
node showcase/rimefiend/build.mjs output/rimefiend/rimefiend.stack.json
node bin/pixelbolt.js render output/rimefiend/rimefiend.stack.json --out output/rimefiend/export --columns 10 --scale 1
node bin/pixelbolt.js gif output/rimefiend/rimefiend.stack.json --out output/rimefiend/turn-preview.gif --scale 2 --background "#343341"
node showcase/rimefiend/crystals.mjs output/rimefiend/rimefiend.stack.json output/rimefiend/crystals.png
```
