"""Private pull worker. Importing this module never deploys or processes customer files."""
from __future__ import annotations
import hashlib
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from documents import MAX_BYTES, extract_evidence, verify_document
from pdf import render_estimate
from scanner_config import CLAMSCAN_EXECUTABLE, SCANNER_DATABASE_DIRECTORY

BUCKET = 'designer-portal'


class TemporaryFailure(RuntimeError):
    pass


def service(path, method='GET', payload=None, *, binary=None, mime='application/json', download=False):
    base = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
    if not re.fullmatch(r'https://[a-z0-9.-]+', base) or not key:
        raise RuntimeError('Private storage is not configured')
    body = binary if binary is not None else json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(base+path, data=body, method=method, headers={'apikey': key, 'Authorization': 'Bearer '+key, 'Content-Type': mime})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            limit = MAX_BYTES if download else 4*1024*1024
            data = response.read(limit+1)
            if len(data) > limit:
                raise ValueError('Private response exceeds the processing limit')
            return data if download else json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        if error.code == 429 or error.code >= 500:
            raise TemporaryFailure('Private service is temporarily unavailable') from error
        raise RuntimeError('Private service request failed') from error
    except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
        raise TemporaryFailure('Private service is temporarily unavailable') from error


def rpc(name, payload):
    return service('/rest/v1/rpc/'+name, 'POST', payload)


def safe_path(job, value):
    prefix = f'{uuid.UUID(job["studio_id"])}/{uuid.UUID(job["project_id"])}/'
    if not isinstance(value, str) or not value.startswith(prefix) or '..' in value or not re.fullmatch(r'[a-zA-Z0-9_./-]{1,300}', value):
        raise ValueError('Asset path is outside the project')
    return value


def active(job):
    job_id, token = str(uuid.UUID(job['id'])), str(uuid.UUID(job['lease_token']))
    rows = service(f'/rest/v1/designer_jobs?id=eq.{job_id}&lease_token=eq.{token}&state=eq.running&select=id')
    return isinstance(rows, list) and len(rows) == 1


def scan(data: bytes, filename: str):
    """Fail closed if the scanner is unavailable. Files are never submitted to an external scanner."""
    with tempfile.TemporaryDirectory(prefix='designer-scan-') as temporary:
        path = Path(temporary)/('source'+Path(filename).suffix.lower())
        path.write_bytes(data)
        try:
            result = subprocess.run([CLAMSCAN_EXECUTABLE, '--database='+SCANNER_DATABASE_DIRECTORY,
                                     '--no-summary', '--stdout', str(path)], capture_output=True, timeout=90)
        except (FileNotFoundError, subprocess.TimeoutExpired) as error:
            raise TemporaryFailure('Document scanner unavailable; file remains quarantined') from error
        if result.returncode == 1:
            raise ValueError('Document failed the file safety check')
        if result.returncode != 0:
            raise TemporaryFailure('Document scanner unavailable; file remains quarantined')


def image_ocr(data):
    import io
    import pytesseract
    from PIL import Image, ImageOps
    with Image.open(io.BytesIO(data)) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((4000, 4000))
        text = pytesseract.image_to_string(image, config='--psm 3', timeout=45)
        return text.splitlines()


def process_job(job):
    stored_output = None
    completion_attempted = False
    try:
        if not active(job):
            raise ValueError('Job lease is no longer active')
        data = job['input']
        if data.get('bucket', BUCKET) != BUCKET:
            raise ValueError('Unexpected storage bucket')
        if job['type'] in ('document.verify', 'document.extract'):
            path = safe_path(job, data['storagePath'])
            content = service('/storage/v1/object/authenticated/'+BUCKET+'/'+path, download=True)
            if len(content) != data['bytes']:
                raise ValueError('Document byte count mismatch')
            output = verify_document(content, data['fileName'], data['sha256'])
            if job['type'] == 'document.verify':
                scan(content, data['fileName'])
            else:
                output = extract_evidence(content, data['fileName'], data['documentId'], ocr=image_ocr)
        elif job['type'] == 'estimate.pdf':
            base_path = safe_path(job, data['storagePath'])
            if not base_path.endswith('.pdf'):
                raise ValueError('Unexpected PDF output path')
            path = base_path[:-4]+'.'+str(uuid.UUID(job['lease_token']))+'.pdf'
            content = render_estimate(data['publicEstimate'])
            if not active(job):
                raise ValueError('Job lease is no longer active')
            service('/storage/v1/object/'+BUCKET+'/'+path, 'POST', binary=content, mime='application/pdf')
            stored_output = path
            output = {'storagePath': path, 'mime': 'application/pdf', 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)}
        else:
            raise ValueError('Unsupported job type')
        completion_attempted = True
        rpc('designer_finish_job', {'p_id': job['id'], 'p_token': job['lease_token'], 'p_success': True, 'p_output': output})
    except Exception as error:
        # A timed-out RPC may already have committed. Never delete an output once
        # publication was attempted; reconcile unreferenced private files later.
        if stored_output and not completion_attempted:
            try:
                service('/storage/v1/object/'+BUCKET, 'DELETE', {'prefixes': [stored_output]})
            except Exception:
                pass  # Unpublished output remains private; maintenance can reconcile it.
        # Do not log exception payloads, document text, storage URLs or credentials.
        safe_error = str(error) if isinstance(error, TemporaryFailure) else 'Document processing failed; staff review required'
        rpc('designer_finish_job', {'p_id': job['id'], 'p_token': job['lease_token'], 'p_success': False, 'p_output': {}, 'p_error': safe_error[:180], 'p_retryable': isinstance(error, TemporaryFailure)})


def run_once():
    if os.getenv('DESIGNER_PORTAL_WORKERS_ENABLED') != 'true':
        return {'enabled': False}
    job = rpc('designer_claim_job', {'p_types': ['document.verify', 'document.extract', 'estimate.pdf'], 'p_lease_seconds': 600})
    if isinstance(job, list):
        job = job[0] if job else None
    if not job:
        return {'claimed': False}
    process_job(job)
    return {'claimed': True}


if __name__ == '__main__':
    run_once()
