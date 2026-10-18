"""Run the actual image boundary without importing Modal or starting a service."""
import ast
import io
from pathlib import Path
import tempfile
import unittest
from PIL import Image

# Modal module import constructs provider objects. Compile only its pure image
# boundary so these local file tests never initialize the provider runtime.
source = Path(__file__).with_name('modal_app.py')
function = next(node for node in ast.parse(source.read_text()).body if isinstance(node, ast.FunctionDef) and node.name == '_clean_texture')
namespace = {'Path': Path}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(source), 'exec'), namespace)
clean_texture = namespace['_clean_texture']

class AssetNormalizationTests(unittest.TestCase):
    def test_png_keeps_pixels_and_validated_dimensions(self):
        with tempfile.TemporaryDirectory() as folder:
            image = Image.new('RGB', (120, 80), '#5d6947')
            data = io.BytesIO(); image.save(data, 'PNG')
            target = Path(folder) / 'clean.png'
            clean_texture(data.getvalue(), target, (120, 80))
            with Image.open(target) as actual:
                self.assertEqual(actual.size, image.size)
                self.assertEqual(actual.tobytes(), image.tobytes())

    def test_exif_orientation_matches_browser_dimensions_and_strips_metadata(self):
        with tempfile.TemporaryDirectory() as folder:
            image = Image.new('RGB', (120, 80), '#5d6947')
            exif = Image.Exif(); exif[274] = 6
            data = io.BytesIO(); image.save(data, 'JPEG', exif=exif)
            target = Path(folder) / 'clean.png'
            clean_texture(data.getvalue(), target, (80, 120))
            with Image.open(target) as actual:
                self.assertEqual(actual.size, (80, 120))
                self.assertFalse(actual.getexif())

    def test_approved_dimensions_cannot_misrepresent_original_artwork(self):
        with tempfile.TemporaryDirectory() as folder:
            data = io.BytesIO(); Image.new('RGB', (120, 80)).save(data, 'PNG')
            target = Path(folder) / 'clean.png'
            with self.assertRaisesRegex(ValueError, 'dimensions do not match'):
                clean_texture(data.getvalue(), target, (120, 120))
            self.assertFalse(target.exists())

    def test_animated_png_cannot_be_frozen_at_an_arbitrary_frame(self):
        with tempfile.TemporaryDirectory() as folder:
            data = io.BytesIO(); Image.new('RGB', (10, 10), 'red').save(data, 'PNG', save_all=True, append_images=[Image.new('RGB', (10, 10), 'blue')], duration=100)
            with self.assertRaisesRegex(ValueError, 'Unsupported'):
                clean_texture(data.getvalue(), Path(folder) / 'clean.png', (10, 10))

if __name__ == '__main__':
    unittest.main(verbosity=2)
