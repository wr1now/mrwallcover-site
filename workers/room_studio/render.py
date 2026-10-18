"""Render a validated Room Studio package verbatim in Blender 4.5/Cycles.

blender -b --python workers/room_studio/render.py -- --package package.json \
    --output-dir output --texture-dir private-textures --quality production

`--inspect` runs in ordinary Python, performs package checks and reports the
geometry identity without loading Blender. No network requests are performed.
Crop/rotation prepares raster artwork once. Mesh UVs already contain set-out,
including strip matching; this worker must never recalculate those UVs.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import re
import sys
import time
from pathlib import Path


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def blender_point(point):
    """Proper rotation (determinant +1), Y-up metres to Blender Z-up metres."""
    return (point[0], -point[2], point[1])


def validate_package(package):
    if package.get("schemaVersion") != 1 or package.get("units") != "metres":
        raise ValueError("Unsupported room render package")
    if package.get('lighting') not in ('daylight', 'warm') or not all(isinstance(package.get(key), str) and package[key] for key in ('revisionId', 'projectId')):
        raise ValueError('Invalid render snapshot identity or lighting')
    meshes = package.get("meshes", [])
    if not 1 <= len(meshes) <= 30000:
        raise ValueError("Invalid mesh count")
    total_vertices = 0
    materials = package.get('materials', [])
    if not 1 <= len(materials) <= 53:
        raise ValueError('Invalid material count')
    material_ids = {m['id'] for m in materials}
    if len(material_ids) != len(materials):
        raise ValueError('Duplicate material identifier')
    textures = package.get('textures', [])
    if len(textures) > 48 or len({t['id'] for t in textures}) != len(textures):
        raise ValueError('Invalid texture count or duplicate texture identifier')
    texture_ids = {t['id'] for t in textures}
    for material in materials:
        if material.get('type') not in ('neutral', 'paint', 'bauwerk', 'wallpaper', 'mural') or not re.fullmatch(r'#[a-fA-F0-9]{6}', material.get('colour', '')) or not finite(material.get('roughness')) or not 0 <= material['roughness'] <= 1:
            raise ValueError('Invalid material parameters')
        if material.get('textureId') and material['textureId'] not in texture_ids:
            raise ValueError('Material refers to an unknown texture')
    for mesh in meshes:
        p, n, uv, indices = (mesh.get(k, []) for k in ("positions", "normals", "uvs", "indices"))
        count = len(p) // 3
        total_vertices += count
        if not count or len(p) % 3 or len(n) != len(p) or len(uv) != count * 2 or len(indices) % 3:
            raise ValueError("Mesh arrays have inconsistent lengths")
        if not all(finite(v) and abs(v) < 1000000 for v in p + n + uv):
            raise ValueError("Non-finite or excessive mesh coordinates")
        if not all(isinstance(i, int) and 0 <= i < count for i in indices):
            raise ValueError("Invalid triangle indices")
        if mesh.get("materialId") not in material_ids:
            raise ValueError("Mesh refers to an unknown material")
    if total_vertices > 250000:
        raise ValueError("Package exceeds the vertex allowance")
    cameras = package.get("cameras", [])
    if not 1 <= len(cameras) <= 8:
        raise ValueError("Supply saved camera positions")
    for camera in cameras:
        if camera.get("kind") not in ("perspective", "panorama") or len(camera.get("position", [])) != 3 or len(camera.get("target", [])) != 3:
            raise ValueError("Invalid camera")
        if not all(finite(v) and abs(v) < 100 for v in camera["position"] + camera["target"]):
            raise ValueError("Invalid camera coordinates")
        if not finite(camera.get('fov')) or not 25 <= camera['fov'] <= 110 or math.dist(camera['position'], camera['target']) < .001:
            raise ValueError('Invalid camera lens or target')
    if package.get("outputs") != {"stills": [1920, 1080], "panorama": [4096, 2048]}:
        raise ValueError("Unsupported output dimensions")


def geometry_identity(package):
    validate_package(package)
    geometry = [{k: mesh[k] for k in ("id", "materialId", "positions", "normals", "uvs", "indices")} for mesh in package["meshes"]]
    digest = hashlib.sha256(json.dumps(geometry, separators=(",", ":"), allow_nan=False).encode()).hexdigest()
    return {"revisionId": package["revisionId"], "geometrySha256": digest,
            "meshes": len(geometry), "vertices": sum(len(m["positions"]) // 3 for m in geometry),
            "triangles": sum(len(m["indices"]) // 3 for m in geometry),
            "cameras": package["cameras"], "outputs": package["outputs"]}


def _hash2(x, y, seed):
    # JS Math.imul and unsigned right shift, matching finishes.ts exactly.
    h = ((((x ^ seed) & 0xffffffff) * 374761393) & 0xffffffff) ^ ((y * 668265263) & 0xffffffff)
    h = (((h ^ (h >> 13)) & 0xffffffff) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffffffff) / 4294967295


def _noise(x, y, seed, px, py):
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    h = lambda a, b: _hash2(a % px, b % py, seed)
    a = h(ix, iy) * (1 - fx) + h(ix + 1, iy) * fx
    b = h(ix, iy + 1) * (1 - fx) + h(ix + 1, iy + 1) * fx
    return a * (1 - fy) + b * fy


def limewash_pixels(colour, seed, size=256):
    """Top-down sRGB RGBA bytes, identical to browser createLimewashPixels."""
    if not re.fullmatch(r"#[a-fA-F0-9]{6}", colour) or not 2 <= size <= 2048:
        raise ValueError("Invalid limewash material")
    base = [int(colour[i:i + 2], 16) for i in (1, 3, 5)]
    pixels = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            u, v = x / size, y / size
            brush = (_noise((u + v) * 16, (u - v) * 4, seed + 17, 16, 4) + _noise((u - v) * 16, (u + v) * 4, seed + 41, 16, 4)) / 2
            shift = (_noise(u * 7, v * 7, seed, 7, 7) - .5) * 15 + (brush - .5) * 5 + (_hash2(x, y, seed + 31) - .5) * 1.2
            i = (y * size + x) * 4
            pixels[i:i + 4] = bytes([max(0, min(255, math.floor(channel + shift + .5))) for channel in base] + [255])
    return pixels


def _linear_srgb(value):
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def _texture_file(texture, texture_dir, scratch):
    texture_id = texture.get("id", "")
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,100}", texture_id):
        raise ValueError("Invalid texture identifier")
    if texture_dir:
        root = Path(texture_dir).resolve()
        for extension in ("png", "jpg", "jpeg", "webp"):
            candidate = (root / f"{texture_id}.{extension}").resolve()
            if candidate.parent == root and candidate.is_file():
                return candidate
    # Local synthetic fixtures and user-owned local test data only. Production
    # dispatch strips data URLs and fetches owned storage objects before launch.
    data_url = texture.get("dataUrl", "")
    if re.match(r"^data:image/(png|jpeg|webp);base64,", data_url):
        data = base64.b64decode(data_url.split(",", 1)[1], validate=True)
        if len(data) > 20 * 1024 * 1024:
            raise ValueError("Artwork exceeds the byte allowance")
        extension = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[texture["mime"]]
        path = scratch / f"{texture_id}.{extension}"
        path.write_bytes(data)
        return path
    raise ValueError(f"Owned texture is missing: {texture_id}")


def _prepare_image(bpy, image, preparation, name):
    if not preparation:
        return image
    import numpy as np
    width, height = image.size
    crop, rotation = preparation["crop"], preparation["rotation"]
    if not all(finite(crop.get(k)) for k in ("x", "y", "width", "height")) or crop["width"] <= 0 or crop["height"] <= 0 or crop["x"] < 0 or crop["y"] < 0 or crop["x"] + crop["width"] > 1.000001 or crop["y"] + crop["height"] > 1.000001 or rotation not in (0, 90, 180, 270):
        raise ValueError("Invalid artwork preparation")
    if crop == {"x": 0, "y": 0, "width": 1, "height": 1} and rotation == 0 and max(width, height) <= 4096:
        return image
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    source = pixels.reshape((height, width, 4))[::-1]
    # Mirror the browser's crop extent, clockwise rotation and 4096px cap.
    # Bilinear raster filtering can differ slightly from a browser's filter.
    out_width = max(1, math.floor(width * crop["width"] + .5))
    out_height = max(1, math.floor(height * crop["height"] + .5))
    scale = min(1, 4096 / max(out_width, out_height))
    out_width, out_height = max(1, math.floor(out_width * scale + .5)), max(1, math.floor(out_height * scale + .5))
    xx = crop["x"] * width + (np.arange(out_width) + .5) * crop["width"] * width / out_width - .5
    yy = crop["y"] * height + (np.arange(out_height) + .5) * crop["height"] * height / out_height - .5
    x0, y0 = np.floor(xx).astype(int), np.floor(yy).astype(int)
    fx, fy = (xx - x0).astype(np.float32)[None, :, None], (yy - y0).astype(np.float32)[:, None, None]
    x1, y1 = np.clip(x0 + 1, 0, width - 1), np.clip(y0 + 1, 0, height - 1)
    x0, y0 = np.clip(x0, 0, width - 1), np.clip(y0, 0, height - 1)
    sampled = (source[y0[:, None], x0[None, :]] * (1 - fx) + source[y0[:, None], x1[None, :]] * fx) * (1 - fy) + (source[y1[:, None], x0[None, :]] * (1 - fx) + source[y1[:, None], x1[None, :]] * fx) * fy
    sampled = np.rot90(sampled, k=-(rotation // 90))
    h, w = sampled.shape[:2]
    prepared = bpy.data.images.new(name, width=w, height=h, alpha=True)
    prepared.colorspace_settings.name = "sRGB"
    prepared.pixels.foreach_set(np.ascontiguousarray(sampled[::-1], dtype=np.float32).reshape(-1))
    prepared.update()
    return prepared


def _material(bpy, data, textures, texture_dir, scratch):
    mat = bpy.data.materials.new(data["id"])
    mat.use_nodes = True
    node = mat.node_tree.nodes.get("Principled BSDF")
    rgb = tuple(_linear_srgb(int(data["colour"][i:i + 2], 16) / 255) for i in (1, 3, 5))
    node.inputs["Base Color"].default_value = (*rgb, 1)
    node.inputs["Roughness"].default_value = data["roughness"]
    node.inputs["Metallic"].default_value = 0
    texture_image = None
    if data.get("textureId"):
        path = _texture_file(textures[data["textureId"]], texture_dir, scratch)
        source_image = bpy.data.images.load(str(path), check_existing=True)
        source_image.colorspace_settings.name = "sRGB"
        texture_image = _prepare_image(bpy, source_image, data.get("texturePreparation"), f"prepared-{data['id']}")
        if texture_image != source_image and source_image.users == 0:
            bpy.data.images.remove(source_image)  # Do not retain unused 25MP source buffers.
    elif data["type"] == "bauwerk":
        import numpy as np
        size = 256
        pixels = np.frombuffer(limewash_pixels(data["colour"], data.get("seed", 0), size), dtype=np.uint8).reshape(size, size, 4)[::-1].astype(np.float32) / 255
        texture_image = bpy.data.images.new(f"limewash-{data['id']}", width=size, height=size, alpha=True)
        texture_image.colorspace_settings.name = "sRGB"
        texture_image.pixels.foreach_set(np.ascontiguousarray(pixels).reshape(-1))
        texture_image.update()
    if texture_image:
        image_node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        image_node.image = texture_image
        image_node.extension = "REPEAT" if data.get("repeat") or data["type"] == "bauwerk" else "CLIP"
        image_node.interpolation = "Linear"
        mat.node_tree.links.new(image_node.outputs["Color"], node.inputs["Base Color"])
    return mat


def _point_camera(camera, position, target):
    from mathutils import Vector
    camera.location = blender_point(position)
    camera.rotation_euler = (Vector(blender_point(target)) - camera.location).to_track_quat('-Z', 'Y').to_euler()


def _configure_camera_projection(camera_data, saved_camera):
    panorama = saved_camera['kind'] == 'panorama'
    camera_data.type = 'PANO' if panorama else 'PERSP'
    if panorama:
        camera_data.panorama_type = 'EQUIRECTANGULAR'
    else:
        # Three.js PerspectiveCamera.fov is vertical. Horizontal fit would
        # silently crop the approved browser view when rendering a 16:9 still.
        camera_data.sensor_fit = 'VERTICAL'
        camera_data.angle = math.radians(saved_camera['fov'])
        if not math.isclose(camera_data.angle_y, math.radians(saved_camera['fov']), abs_tol=1e-6):
            raise ValueError('Blender vertical lens differs from the approved camera')


def _verify_compiled_mesh(mesh, item):
    """Check Blender's actual mesh, rather than only hashing the input package."""
    close = lambda a, b: math.isclose(a, b, rel_tol=2e-7, abs_tol=2e-6)
    if len(mesh.vertices) * 3 != len(item['positions']) or len(mesh.polygons) * 3 != len(item['indices']):
        raise ValueError('Blender mesh differs from the approved geometry')
    for vertex in mesh.vertices:
        expected = blender_point(item['positions'][vertex.index * 3:vertex.index * 3 + 3])
        if not all(close(a, b) for a, b in zip(vertex.co, expected)):
            raise ValueError('Blender vertex differs from the approved geometry')
    uv_layer = mesh.uv_layers.active
    for polygon in mesh.polygons:
        indices = item['indices'][polygon.index * 3:polygon.index * 3 + 3]
        if list(polygon.vertices) != indices:
            raise ValueError('Blender winding differs from the approved geometry')
        expected_normal = blender_point(item['normals'][indices[0] * 3:indices[0] * 3 + 3])
        if not all(close(a, b) for a, b in zip(polygon.normal, expected_normal)):
            raise ValueError('Blender normal differs from the approved geometry')
        for loop_index in polygon.loop_indices:
            vertex = mesh.loops[loop_index].vertex_index
            expected_uv = item['uvs'][vertex * 2:vertex * 2 + 2]
            if not all(close(a, b) for a, b in zip(uv_layer.data[loop_index].uv, expected_uv)):
                raise ValueError('Blender UV differs from the approved geometry')


def render_package(package: dict, output_dir: str, texture_dir: str | None = None, *, quality="production") -> list[dict]:
    import bpy
    started = time.perf_counter()
    validate_package(package)
    if quality not in ("production", "fast"):
        raise ValueError("Unknown render quality")
    output = Path(output_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    scratch = output / "_textures"
    scratch.mkdir(exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 128 if quality == 'production' else 8
    scene.cycles.use_denoising = True
    scene.cycles.seed = 217
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 4
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    # A CPU remains a valid local fixture backend. CUDA/OptiX is opt-in when an
    # available worker device exists; no API keys or network services are used.
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for device_type in ('OPTIX', 'CUDA', 'METAL'):
        try:
            prefs.compute_device_type = device_type
            prefs.get_devices()
            devices = [d for d in prefs.devices if d.type != 'CPU']
            if devices:
                for device in prefs.devices:
                    device.use = device.type != 'CPU'
                scene.cycles.device = 'GPU'
                break
        except (TypeError, RuntimeError):
            pass
    textures = {t['id']: t for t in package.get('textures', [])}
    materials = {m['id']: _material(bpy, m, textures, texture_dir, scratch) for m in package['materials']}
    for item in package['meshes']:
        verts = [blender_point(item['positions'][i:i + 3]) for i in range(0, len(item['positions']), 3)]
        faces = [item['indices'][i:i + 3] for i in range(0, len(item['indices']), 3)]
        mesh = bpy.data.meshes.new(item['id'])
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        layer = mesh.uv_layers.new(name='RoomStudioUV')
        for polygon in mesh.polygons:
            for loop_index in polygon.loop_indices:
                vertex = mesh.loops[loop_index].vertex_index
                layer.data[loop_index].uv = item['uvs'][vertex * 2:vertex * 2 + 2]
        _verify_compiled_mesh(mesh, item)
        obj = bpy.data.objects.new(item['id'], mesh)
        scene.collection.objects.link(obj)
        obj.data.materials.append(materials[item['materialId']])
    all_positions = [mesh['positions'][i:i + 3] for mesh in package['meshes'] for i in range(0, len(mesh['positions']), 3)]
    lo = [min(p[i] for p in all_positions) for i in range(3)]
    hi = [max(p[i] for p in all_positions) for i in range(3)]
    centre = [(a + b) / 2 for a, b in zip(lo, hi)]
    world = bpy.data.worlds.new('Room Studio neutral daylight')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.7, 0.77, .9, 1) if package['lighting'] == 'daylight' else (1, .75, .48, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35 if package['lighting'] == 'daylight' else .12
    scene.world = world
    light = bpy.data.lights.new('Room Studio ceiling softbox', 'AREA')
    light.energy = 90 if package['lighting'] == 'daylight' else 65
    light.shape = 'DISK'
    light.size = min(hi[0] - lo[0], hi[2] - lo[2]) * .6
    light.color = (1, .98, .95) if package['lighting'] == 'daylight' else (1, .79, .6)
    lamp = bpy.data.objects.new(light.name, light)
    scene.collection.objects.link(lamp)
    # A bounding-box centre can lie outside an L-shaped or concave room. Use
    # the saved, validated interior panorama position for the ceiling light.
    interior_anchor = next((c['position'] for c in package['cameras'] if c['kind'] == 'panorama'), centre)
    lamp.location = blender_point([interior_anchor[0], hi[1] - .12, interior_anchor[2]])
    # Blender's default area-light orientation points downward along -Z.
    camera_data = bpy.data.cameras.new('Room Studio approved camera')
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    stills = [c for c in package['cameras'] if c['kind'] == 'perspective']
    panoramas = [c for c in package['cameras'] if c['kind'] == 'panorama']
    if len(stills) < 2 or not panoramas:
        raise ValueError('Save two perspective views and one panorama position before rendering')
    outputs = []
    for index, saved_camera in enumerate(stills[:2] + panoramas[:1]):
        panorama = saved_camera['kind'] == 'panorama'
        _configure_camera_projection(camera_data, saved_camera)
        _point_camera(camera, saved_camera['position'], saved_camera['target'])
        w, h = package['outputs']['panorama' if panorama else 'stills']
        if quality == 'fast':
            w, h = (512, 256) if panorama else (480, 270)
        scene.render.resolution_x, scene.render.resolution_y = w, h
        kind = 'panorama' if panorama else f'still-{index + 1}'
        path = output / f'{kind}.png'
        scene.render.filepath = str(path)
        render_started = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        outputs.append({'kind': kind, 'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'width': w, 'height': h, 'renderSeconds': round(time.perf_counter() - render_started, 3)})
    metadata = {**geometry_identity(package), 'quality': quality, 'blenderVersion': bpy.app.version_string, 'renderedGeometryVerified': True, 'device': scene.cycles.device, 'samples': scene.cycles.samples, 'seed': scene.cycles.seed, 'elapsedSeconds': round(time.perf_counter() - started, 3), 'outputs': outputs}
    (output / 'render-manifest.json').write_text(json.dumps(metadata, indent=2))
    return outputs


def main(argv=None):
    args = argv if argv is not None else (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package', required=True)
    parser.add_argument('--output-dir')
    parser.add_argument('--texture-dir')
    parser.add_argument('--quality', choices=['fast', 'production'], default='production')
    parser.add_argument('--inspect', action='store_true')
    options = parser.parse_args(args)
    package = json.loads(Path(options.package).read_text())
    if options.inspect:
        print(json.dumps(geometry_identity(package), separators=(',', ':')))
    elif not options.output_dir:
        parser.error('--output-dir is required for rendering')
    else:
        print(json.dumps(render_package(package, options.output_dir, options.texture_dir, quality=options.quality)))


if __name__ == '__main__':
    main()
