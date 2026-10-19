"""Bounded operator metadata only; never inspect documents or service credentials."""
from __future__ import annotations

from datetime import datetime, timezone
import os
from pathlib import Path
import re
import shutil
import stat
import time
from scanner_config import CLAMSCAN_EXECUTABLE, SCANNER_DATABASE_DIRECTORY

HEADER_BYTES = 512
MAX_DEFINITION_AGE_SECONDS = 48 * 60 * 60
DEFINITION_PATHS = tuple(Path(SCANNER_DATABASE_DIRECTORY)/name for name in ('daily.cvd', 'daily.cld'))


def _runtime_value(key, pattern):
    value = os.environ.get(key, '')
    return value if re.fullmatch(pattern, value) else None


def _header(path):
    # Fixed database paths only. Do not follow a link, block on a pipe or read
    # the signature archive body. No header bytes or exception text are returned.
    flags = os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW
    with os.fdopen(os.open(path, flags), 'rb') as source:
        if not stat.S_ISREG(os.fstat(source.fileno()).st_mode):
            raise ValueError('Not a regular signature database')
        value = source.read(HEADER_BYTES)
    if len(value) != HEADER_BYTES:
        raise ValueError('Invalid signature header')
    fields = value.decode('ascii').rstrip(' \x00\r\n').split(':')
    # ClamAV's CVD/CLD header stores the version and Unix build time at fields
    # 2 and 8. Main/bytecode timestamps do not establish daily-definition age.
    if len(fields) != 9 or fields[0] != 'ClamAV-VDB' or not re.fullmatch(r'[0-9]{1,10}', fields[2]) or not re.fullmatch(r'[0-9]{1,12}', fields[8]):
        raise ValueError('Invalid signature header')
    version, built = int(fields[2]), int(fields[8])
    if version <= 0 or built <= 0:
        raise ValueError('Invalid signature header')
    stamp = datetime.fromtimestamp(built, timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    return version, built, stamp


def _definitions():
    records = []
    failure = None
    for path in DEFINITION_PATHS:
        try:
            records.append(_header(path))
        except FileNotFoundError:
            continue
        except (OSError, ValueError, OverflowError, UnicodeError):
            failure = 'unreadable_or_invalid'
    result = {'definitionsStatus': failure or 'missing', 'definitionsUpdatedAt': None,
              'definitionAgeSeconds': None, 'definitionsFresh': False,
              'maxDefinitionAgeSeconds': MAX_DEFINITION_AGE_SECONDS}
    if failure or not records:
        return result
    # ClamAV selects the higher-version daily archive when both formats exist.
    _, built, stamp = max(records, key=lambda record: record[0])
    age = int(time.time()) - built
    status = 'future' if age < 0 else 'fresh' if age <= MAX_DEFINITION_AGE_SECONDS else 'stale'
    return {**result, 'definitionsStatus': status, 'definitionsUpdatedAt': stamp,
            'definitionAgeSeconds': age, 'definitionsFresh': status == 'fresh'}


def runtime_diagnostics():
    """No arguments, outbound calls, process execution, logs or secret values."""
    return {
        'runtime': {
            'region': _runtime_value('MODAL_REGION', r'[a-z0-9-]{1,64}'),
            'environment': _runtime_value('MODAL_ENVIRONMENT', r'[A-Za-z0-9._-]{1,128}'),
            'imageId': _runtime_value('MODAL_IMAGE_ID', r'im-[A-Za-z0-9]{1,100}'),
            'cloudProvider': _runtime_value('MODAL_CLOUD_PROVIDER', r'[a-z]{1,16}'),
        },
        'scanner': {'executableAvailable': shutil.which(CLAMSCAN_EXECUTABLE) is not None, **_definitions()},
        'ocr': {'executableAvailable': shutil.which('tesseract') is not None},
    }
