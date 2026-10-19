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


def _command(arguments, *, timeout=120):
    try:
        return subprocess.run(arguments, check=True, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.SubprocessError):
        raise RuntimeError('Scanner image setup command failed; image must not be deployed') from None


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
        version = _command([executable, '--version']).stdout
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
    _verify_executables()
    _configure()
    # Dedicated CLI-only configuration: no NotifyClamd or daemon, and retain
    # FreshClam's signature verification and database load testing.
    _command([FRESHCLAM_EXECUTABLE, '--config-file='+FRESHCLAM_CONFIGURATION, '--stdout'], timeout=300)


if __name__ == '__main__':
    install_scanner()
