# Worker dependency and image preparation review

Checked 18 October 2026 without cloud credentials, deployment, model calls or OCR
weight downloads. These checks cover package resolution, API source and image
definition preparation; they do not establish a working deployed OCR or GPU image.

The seven direct requirements are exact versions, including Modal **1.6.2**.
An isolated pip 26.2.1 dry run resolved **92 wheels** for CPython 3.11, Linux
x86_64, with glibc-compatible manylinux tags through 2.36. The selected numerical
and OCR packages were NumPy 1.26.4, PaddleOCR 2.9.1 and PaddlePaddle 3.0.0.
No resolver incompatibility was found. The resolver selected OpenCV's three
distributions at 4.11.0.86 because PaddleOCR itself declares the standard and
contrib packages in addition to this worker's headless requirement. Actual shared
library loading remains an image smoke-test requirement.

The published [PaddleOCR 2.9.1 wheel metadata](https://pypi.org/pypi/paddleocr/2.9.1/json)
and wheel source accept the worker's `PaddleOCR(use_angle_cls=False, lang="en",
show_log=False)` constructor and `ocr(pixels, cls=False)` call. The CPU inference
configuration methods used on that path remain present in the
[PaddlePaddle 3.0.0 bindings](https://github.com/PaddlePaddle/Paddle/blob/v3.0.0/paddle/fluid/pybind/inference_api.cc).
This source inspection supplies no reason to change those two versions. It does
not prove that their model formats, weights or predictions work together at runtime.

Modal 1.6.2 was installed only in an ignored local virtual environment. Importing
the worker accepted the app, image and four function definitions with socket
connections blocked; there were zero network attempts. No image build or remote
function ran. The local dry-run reports and package metadata are retained under
the ignored `.tmp/worker-deps-audit/` directory.

The worker downloads the official Blender 4.5.0 Linux x64 archive and verifies
SHA-256 **before** extraction. The pinned digest is
`1188b95cc12321c770b631939f7c25a096910b6f884a990bf9c0f62d52b38aec`, from the
[official release checksum file](https://download.blender.org/release/Blender4.5/blender-4.5.0.sha256).
The offline archive-integrity regression executes the actual verification code:
the expected fixture bytes pass; changed bytes fail before extraction. Run it
with `python3 workers/room_studio/test_worker_image.py`; it also runs through
`npm run check:studio`.

The separately recorded local macOS Blender renders remain the only actual
renderer execution evidence. Building the pinned Linux image, loading OCR
dependencies and approved weights, exercising real raster fixtures, and measuring
cloud turnaround/cost remain staging activation gates.
