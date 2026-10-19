"""Image-build installer only. Importing this module performs no installation."""
from __future__ import annotations

import grp
import hashlib
import os
from pathlib import Path
import platform
import pwd
import re
import subprocess
import tempfile
import time
import urllib.request

from scanner_config import (
    CLAMAV_PACKAGE_BYTES, CLAMAV_PACKAGE_SHA256, CLAMAV_PACKAGE_URL,
    CLAMAV_PACKAGE_VERSION, CLAMAV_VERSION, CLAMSCAN_EXECUTABLE,
    FRESHCLAM_CONFIGURATION, FRESHCLAM_CONFIGURATION_TEXT,
    FRESHCLAM_EXECUTABLE, SCANNER_DATABASE_DIRECTORY,
)


def _safe_build_diagnostic(stderr):
    """Summarize known public setup failures; never echo arbitrary child output."""
    if isinstance(stderr, bytes):
        stderr = stderr.decode('utf-8', errors='replace')
    text = (stderr or '')[:4096]
    missing = re.search(r'error while loading shared libraries: ([A-Za-z0-9_.+-]{1,96}): cannot open shared object file', text)
    if missing:
        return 'shared library unavailable: '+missing.group(1)
    version = re.search(r"version [`']((?:GLIBC|GLIBCXX|CXXABI)_[0-9.]{1,24})['`] not found", text)
    if version:
        return 'required library ABI unavailable: '+version.group(1)
    if "Can't open/parse the config file" in text:
        return 'cannot open or parse scanner configuration'
    if 'Permission denied' in text:
        return 'permission denied during image setup'
    return 'unrecognized diagnostic withheld' if text else 'no stderr diagnostic'


def _command(arguments, *, timeout=120):
    label = Path(arguments[0]).name
    if label not in {'dpkg', 'dpkg-deb', 'clamscan', 'freshclam', 'groupadd', 'useradd'}:
        raise RuntimeError('Unapproved scanner image setup command')
    try:
        return subprocess.run(arguments, check=True, capture_output=True, text=True, timeout=timeout)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f'Scanner image setup {label} exited {error.returncode}: {_safe_build_diagnostic(error.stderr)}; image must not be deployed') from None
    except subprocess.TimeoutExpired:
        raise RuntimeError(f'Scanner image setup {label} timed out; image must not be deployed') from None
    except OSError:
        raise RuntimeError(f'Scanner image setup {label} could not start; image must not be deployed') from None


def _validate_architecture():
    if platform.system() != 'Linux' or platform.machine() != 'x86_64':
        raise RuntimeError('The reviewed scanner artifact requires Linux x86_64')
    if _command(['dpkg', '--print-architecture']).stdout.strip() != 'amd64':
        raise RuntimeError('The reviewed scanner artifact requires Debian amd64')


def _download(destination):
    digest, size, deadline = hashlib.sha256(), 0, time.monotonic()+180
    request = urllib.request.Request(CLAMAV_PACKAGE_URL, headers={'User-Agent': 'MrWallcover-scanner-image-build'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response, destination.open('xb') as output:
            while chunk := response.read(1024*1024):
                size += len(chunk)
                if size > CLAMAV_PACKAGE_BYTES or time.monotonic() > deadline:
                    raise RuntimeError('Scanner artifact exceeded the download limit')
                digest.update(chunk)
                output.write(chunk)
    except OSError:
        raise RuntimeError('Scanner artifact download failed; no package was installed') from None
    if size != CLAMAV_PACKAGE_BYTES or digest.hexdigest() != CLAMAV_PACKAGE_SHA256:
        raise RuntimeError('Scanner artifact checksum or size mismatch; no package was installed')


def _validate_package(package):
    # This metadata is parsed only after the exact artifact hash is verified.
    control = _command(['dpkg-deb', '--field', str(package)]).stdout
    fields = dict(line.split(': ', 1) for line in control.splitlines() if ': ' in line and not line.startswith(' '))
    if any(fields.get(key) != value for key, value in {
        'Package': 'clamav', 'Version': CLAMAV_PACKAGE_VERSION, 'Architecture': 'amd64',
    }.items()):
        raise RuntimeError('Scanner package identity mismatch; no package was installed')


def _verify_executables():
    for executable in (CLAMSCAN_EXECUTABLE, FRESHCLAM_EXECUTABLE):
        arguments = [executable, '--version']
        if executable == FRESHCLAM_EXECUTABLE:
            # FreshClam parses its configuration before handling --version.
            arguments.append('--config-file='+FRESHCLAM_CONFIGURATION)
        version = _command(arguments).stdout
        if not re.match(r'^ClamAV '+re.escape(CLAMAV_VERSION)+r'(?:/|\s|$)', version):
            raise RuntimeError('Scanner executable version mismatch; image must not be deployed')


def _configure():
    try:
        group = grp.getgrnam('clamav')
    except KeyError:
        _command(['groupadd', '--system', 'clamav'])
        group = grp.getgrnam('clamav')
    try:
        user = pwd.getpwnam('clamav')
    except KeyError:
        _command(['useradd', '--system', '--gid', 'clamav', '--home-dir', SCANNER_DATABASE_DIRECTORY,
                  '--no-create-home', '--shell', '/usr/sbin/nologin', 'clamav'])
        user = pwd.getpwnam('clamav')
    directory = Path(SCANNER_DATABASE_DIRECTORY)
    directory.mkdir(parents=True, exist_ok=True)
    directory.chmod(0o755)
    os.chown(directory, user.pw_uid, group.gr_gid)
    configuration = Path(FRESHCLAM_CONFIGURATION)
    configuration.parent.mkdir(parents=True, exist_ok=True)
    configuration.write_text(FRESHCLAM_CONFIGURATION_TEXT, encoding='ascii')
    configuration.chmod(0o644)


def install_scanner():
    _validate_architecture()
    with tempfile.TemporaryDirectory(prefix='designer-scanner-package-') as temporary:
        package = Path(temporary)/'clamav.deb'
        _download(package)
        _validate_package(package)
        _command(['dpkg', '--install', str(package)])
    _configure()
    _verify_executables()
    # Dedicated CLI-only configuration: no NotifyClamd or daemon, and retain
    # FreshClam's signature verification and database load testing.
    _command([FRESHCLAM_EXECUTABLE, '--config-file='+FRESHCLAM_CONFIGURATION, '--stdout'], timeout=300)


if __name__ == '__main__':
    install_scanner()
