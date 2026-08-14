import zlib

backup_path = '439ea20d-00a0-4707-822c-afbf7d5271c1_260813.backup'
with open(backup_path, 'rb') as f:
    raw = f.read()

print("File size:", len(raw))

blocks = []
pos = 0

# Scan for zlib / raw deflate blocks
for i in range(len(raw) - 100):
    for wbits in (15, -15, 31):
        try:
            d = zlib.decompressobj(wbits)
            decomp = d.decompress(raw[i:i+50000])
            if len(decomp) > 500 and (b'COPY ' in decomp or b'INSERT ' in decomp or b'SELECT ' in decomp or b'\t' in decomp):
                blocks.append((i, len(decomp), decomp[:100]))
                break
        except Exception:
            pass

print(f"Found {len(blocks)} candidate data blocks:")
for b in blocks[:10]:
    print(f"  Pos {b[0]}: decompressed size {b[1]} bytes | Sample: {b[2][:60]}")
