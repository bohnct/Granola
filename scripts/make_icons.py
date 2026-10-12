"""Generate the app icons (PNG) with only the standard library.
Run once:  python scripts/make_icons.py
Draws a green tile with a golden grain-head mark.
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
BG = (31, 95, 58)
GOLD = (242, 197, 61)
LIGHT = (255, 236, 170)


def png(size, pixels):
    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in pixels)
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def in_ellipse(x, y, cx, cy, rx, ry, angle):
    dx, dy = x - cx, y - cy
    c, s = math.cos(angle), math.sin(angle)
    u, v = dx * c + dy * s, -dx * s + dy * c
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1


def shapes(u):
    """Grain head: a stem plus pairs of kernels, in unit coordinates (0..1)."""
    kernels = []
    for i in range(4):
        y = 0.30 + i * 0.12
        kernels.append((0.5 - 0.075, y, 0.06, 0.11, math.radians(-30)))
        kernels.append((0.5 + 0.075, y, 0.06, 0.11, math.radians(30)))
    kernels.append((0.5, 0.22, 0.055, 0.10, 0.0))
    return kernels


def draw(size):
    ss = 3  # supersampling for smooth edges
    kernels = shapes(1)
    rows = []
    for py in range(size):
        row = []
        for px in range(size):
            acc = [0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) / size
                    y = (py + (sy + 0.5) / ss) / size
                    col = BG
                    if abs(x - 0.5) < 0.018 and 0.25 < y < 0.84:
                        col = GOLD
                    for (cx, cy, rx, ry, a) in kernels:
                        if in_ellipse(x, y, cx, cy, rx, ry, a):
                            col = LIGHT if in_ellipse(x, y, cx - 0.01, cy - 0.02, rx * 0.45, ry * 0.45, a) else GOLD
                    for i in range(3):
                        acc[i] += col[i]
            row.append(tuple(round(c / ss / ss) for c in acc))
        rows.append(row)
    return rows


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for size in (180, 192, 512):
        (OUT / f"icon-{size}.png").write_bytes(png(size, draw(size)))
        print("wrote", size)
