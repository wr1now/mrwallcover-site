"""Deployment definition; no deployment or remote invocation on import."""
from pathlib import Path
import os
import modal

ROOT = Path(__file__).resolve().parent
app = modal.App('mrwallcover-designer-portal')
# These are deployment-time switches, deliberately separate from runtime
# Secret/DB gates. A disabled worker must not leave a recurring compute bill.
processing_schedule = (
    modal.Period(minutes=1) if os.getenv('DESIGNER_PORTAL_PROCESSING_SCHEDULE_ENABLED') == 'true' else None
)
notification_schedule = (
    modal.Period(minutes=1) if os.getenv('DESIGNER_PORTAL_NOTIFICATION_SCHEDULE_ENABLED') == 'true' else None
)
image = (
    modal.Image.debian_slim(python_version='3.12')
    .apt_install('tesseract-ocr', 'ca-certificates', 'passwd')
    .add_local_file(str(ROOT/'scanner_config.py'), '/tmp/designer-scanner/scanner_config.py', copy=True)
    .add_local_file(str(ROOT/'scanner_build.py'), '/tmp/designer-scanner/scanner_build.py', copy=True)
    .run_commands('python /tmp/designer-scanner/scanner_build.py', 'rm -rf /tmp/designer-scanner')
    .pip_install_from_requirements(str(ROOT/'requirements.txt'))
    .add_local_dir(str(ROOT), '/app/designer_portal', copy=True)
    .env({'PYTHONPATH': '/app/designer_portal'})
)


@app.function(image=image, region='uk', routing_region='eu-west',
              cpu=(1, 1), memory=(4096, 4096), timeout=660, startup_timeout=60,
              min_containers=0, buffer_containers=0, max_containers=2,
              scaledown_window=2, retries=0,
              secrets=[modal.Secret.from_name('mrwallcover-designer-portal')])
def process_next():
    # No client file, OCR text or estimate is passed through Modal invocation payloads.
    from worker import run_once
    return run_once()


@app.function(region='uk', cpu=(0.125, 0.25), memory=(256, 256),
              timeout=750, startup_timeout=60, min_containers=0, buffer_containers=0,
              max_containers=1, scaledown_window=2, retries=0, schedule=processing_schedule)
def dispatch():
    # Regional routing supports synchronous .remote() calls. The scheduled
    # trigger uses the default control route, carrying no document or project
    # data; only the small claimed/enabled status returns through it.
    return process_next.remote()


@app.function(image=image, region='uk', routing_region='eu-west',
              cpu=(1, 1), memory=(512, 512), timeout=150, startup_timeout=60,
              min_containers=0, buffer_containers=0, max_containers=1,
              scaledown_window=2, retries=0,
              secrets=[modal.Secret.from_name('mrwallcover-designer-portal')])
def process_notification():
    from notifications import run_once
    return run_once()


@app.function(region='uk', cpu=(0.125, 0.25), memory=(256, 256),
              timeout=240, startup_timeout=60, min_containers=0, buffer_containers=0,
              max_containers=1, scaledown_window=2, retries=0, schedule=notification_schedule)
def dispatch_notifications():
    # Independent environment + DB gates. No recipient/message invocation data.
    return process_notification.remote()


@app.function(image=image, region='uk', routing_region='eu-west',
              cpu=(0.125, 0.25), memory=(256, 256), timeout=15, startup_timeout=60,
              min_containers=0, buffer_containers=0, max_containers=1,
              scaledown_window=2, retries=0)
def diagnose_runtime():
    # No Secret injection, arguments, document access, network or subprocesses.
    # This is operator metadata, not proof that an uploaded file scans cleanly.
    from diagnostics import runtime_diagnostics
    return runtime_diagnostics()
