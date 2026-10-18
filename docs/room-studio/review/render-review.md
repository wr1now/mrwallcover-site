# Local Blender render review

These images show the original illustrative Room Studio fixture: a 4,200 × 3,600 × 2,600 mm room with a door, a window, an authored geometric wallpaper repeat, ivory paint and a seeded limewash preview using the sourced Bauwerk Olive colour. The wallpaper artwork is 512 × 512 px, calibrated to 530 × 640 mm. The procedural limewash is an illustrative material preview.

Blender 4.5.0/Cycles produced two 1,920 × 1,080 stills and one 4,096 × 2,048 equirectangular panorama using the compiled package's mesh positions, winding, normals, UVs and saved cameras. The worker checked those arrays against Blender's actual mesh data. The perspective lens uses vertical degrees to match the browser camera. Door recess flooring, window reveals, floor and ceiling were visually reviewed.

The local Apple Silicon Metal GPU run used 128 samples and seed 217. The complete package took 204.962 seconds: 31.979 and 29.124 seconds for the stills, and 143.262 seconds for the panorama. These are local measurements. Cloud performance has not been measured.

The browser panorama harness passed with this actual render: visible interior, working turn and pitch controls, no page errors, and a complete 360° turn returned to the original image with a mean pixel difference of zero.

The committed JPGs are small review copies. Full-resolution PNGs and the render package are generated locally under the ignored `.tmp/` directory. The accompanying [manifest](blender-render-review.json) records original PNG checksums, review-copy checksums, dimensions, timings, geometry identity and test results.

- [Still 1](render-still-1.jpg)
- [Still 2](render-still-2.jpg)
- [Panorama](render-panorama.jpg)

Reproduce with the fixture script and a Blender 4.5 executable:

```sh
node --experimental-strip-types scripts/room-studio-render-fixture.ts --shape rectangle --render --production --blender /absolute/path/to/blender
```
