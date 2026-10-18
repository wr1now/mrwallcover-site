"""Deployment definition; no deployment or remote invocation on import."""
from pathlib import Path
import modal

ROOT = Path(__file__).resolve().parent
app = modal.App('mrwallcover-designer-portal')
image = (
    modal.Image.debian_slim(python_version='3.12')
    .apt_install('clamav', 'tesseract-ocr')
    .pip_install_from_requirements(str(ROOT/'requirements.txt'))
    .run_commands('freshclam')
    .add_local_dir(str(ROOT), '/app/designer_portal', copy=True)
    .env({'PYTHONPATH': '/app/designer_portal'})
)


@app.function(image=image, region='uk', routing_region='eu-west', cpu=1, memory=2048,
              timeout=660, max_containers=2,
              secrets=[modal.Secret.from_name('mrwallcover-designer-portal')])
def process_next():
    # No client file, OCR text or estimate is passed through Modal invocation payloads.
    from worker import run_once
    return run_once()


@app.function(region='uk', timeout=690, max_containers=1, schedule=modal.Period(minutes=1))
def dispatch():
    # Regional routing supports synchronous .remote() calls. The scheduled
    # trigger uses the default control route, carrying no document or project
    # data; only the small claimed/enabled status returns through it.
    return process_next.remote()


@app.function(image=image, region='uk', routing_region='eu-west', cpu=1, memory=512,
              timeout=150, max_containers=1,
              secrets=[modal.Secret.from_name('mrwallcover-designer-portal')])
def process_notification():
    from notifications import run_once
    return run_once()


@app.function(region='uk', timeout=180, max_containers=1, schedule=modal.Period(minutes=1))
def dispatch_notifications():
    # Independent environment + DB gates. No recipient/message invocation data.
    return process_notification.remote()
