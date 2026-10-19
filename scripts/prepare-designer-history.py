#!/usr/bin/env python3
"""Prepare private reviewed source records for the owner's explicit portal import."""
import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'workers'/'designer_portal'))
from history import write_private_export

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--review', required=True, type=Path)
parser.add_argument('--out', required=True, type=Path)
args = parser.parse_args()
result = write_private_export(args.review, args.out, ROOT)
print(result)  # Counts only; never print client names, cells or original prices.
