"""Reviewed scanner artifact and fixed paths shared by build, worker and probe."""
CLAMAV_VERSION = '1.4.6'
CLAMAV_PACKAGE_VERSION = '1.4.6-1'
CLAMAV_PACKAGE_URL = 'https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.4.6/clamav-1.4.6.linux.x86_64.deb'
# Official release API digest, checked against the full artifact on 2026-10-19.
CLAMAV_PACKAGE_SHA256 = 'd3ee9e401974855a1edc1761b1425417d126de618d5f0c91cd51209f69f6fcc2'
CLAMAV_PACKAGE_BYTES = 94_663_320
CLAMSCAN_EXECUTABLE = '/usr/local/bin/clamscan'
FRESHCLAM_EXECUTABLE = '/usr/local/bin/freshclam'
SCANNER_DATABASE_DIRECTORY = '/var/lib/clamav'
FRESHCLAM_CONFIGURATION = '/etc/clamav/freshclam.conf'
FRESHCLAM_CONFIGURATION_TEXT = (
    'DatabaseDirectory /var/lib/clamav\n'
    'DatabaseOwner clamav\n'
    'DatabaseMirror database.clamav.net\n'
    'TestDatabases yes\n'
)
