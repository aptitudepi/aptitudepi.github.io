#!/bin/bash
# Regenerate the 9p filesystem JSON from src/
# Run this after adding/changing files in src/
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

python3 "$DIR/../../../../tmp/fs2json/fs2json.py" --out /tmp/fs2json-fs.json "$DIR/src"
python3 -c "
import hashlib, json, os, shutil

src = '$DIR/src'
out = '$DIR/out'
os.makedirs(out, exist_ok=True)

for f in os.listdir(out):
    p = os.path.join(out, f)
    if os.path.isfile(p) and f != 'fs.json':
        os.remove(p)

with open('/tmp/fs2json-fs.json') as f:
    data = json.load(f)

def hash_file(filename):
    with open(filename, 'rb', buffering=0) as f:
        h = hashlib.sha256()
        for b in iter(lambda: f.read(128*1024), b''):
            h.update(b)
        return h.hexdigest()

def process(entries, base):
    for e in entries:
        if len(e) > 6 and isinstance(e[6], list):
            process(e[6], os.path.join(base, e[0]))
        elif len(e) > 6 and isinstance(e[6], str) and e[6].endswith('.bin'):
            src_path = os.path.join(base, e[0])
            h = hash_file(src_path)
            fname = h[:8] + '.bin'
            dst = os.path.join(out, fname)
            e[6] = fname
            if not os.path.exists(dst):
                shutil.copy2(src_path, dst)

process(data['fsroot'], src)

with open(os.path.join(out, 'fs.json'), 'w') as f:
    json.dump(data, f, check_circular=False, separators=(',', ':'))

os.remove('/tmp/fs2json-fs.json')
print('9p rootfs rebuilt.')
"
