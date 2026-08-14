import zlib
import re

backup_path = '439ea20d-00a0-4707-822c-afbf7d5271c1_260813.backup'
out_path = 'restored_data_dump.sql'

with open(backup_path, 'rb') as f:
    raw = f.read()

print(f"Reading backup file (Size: {len(raw) / 1024 / 1024:.2f} MB)...")

# PostgreSQL custom dump format has data blocks compressed with zlib.
# Each data block starts with a 5-byte block header (1 byte block type + 4 bytes dump ID)
# followed by zlib compressed chunks.

# In zlib streams, raw zlib data starts with 0x78 (0x789c or 0x7801 or 0x78da or 0x785e).
# Let's write a stream extractor that finds all valid zlib streams and decompresses them.

decompressed_blocks = []
pos = 0

while pos < len(raw) - 10:
    # Check for zlib header
    if raw[pos] == 0x78 and raw[pos+1] in (0x01, 0x5e, 0x9c, 0xda):
        try:
            d = zlib.decompressobj()
            decomp = d.decompress(raw[pos:])
            if len(decomp) > 20: # Valid decompressed block
                decompressed_blocks.append(decomp)
                consumed = len(raw[pos:]) - len(d.unused_data)
                pos += max(consumed, 4)
                continue
        except Exception:
            pass
    pos += 1

print(f"Successfully decompressed {len(decompressed_blocks)} data blocks!")

with open(out_path, 'wb') as out:
    for block in decompressed_blocks:
        out.write(block)
        out.write(b'\n')

print(f"Saved decompressed SQL dump to {out_path} (Size: {len(open(out_path, 'rb').read()) / 1024 / 1024:.2f} MB)")
