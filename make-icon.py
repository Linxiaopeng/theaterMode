import struct
import zlib
import os

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
os.makedirs(OUT_DIR, exist_ok=True)


def chunk(typ, data):
    c = struct.pack('>I', len(data)) + typ + data
    c += struct.pack('>I', zlib.crc32(typ + data) & 0xFFFFFFFF)
    return c


def write_png(path, w, h, rgba):
    raw = b''
    for row in rgba:
        raw += b'\x00' + bytes(c for px in row for c in px)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def inside_rounded_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= r * r


def inside_triangle(px, py, a, b, c):
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

    d1 = sign((px, py), a, b)
    d2 = sign((px, py), b, c)
    d3 = sign((px, py), c, a)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def render(size):
    K = 4
    W = size * K
    bg = (24, 24, 28)
    border = (245, 245, 245)
    fill = (16, 16, 22)
    white = (255, 255, 255)

    pad = 0.16 * W
    bd = 0.045 * W
    r_outer = 0.22 * W
    r_screen = 0.06 * W
    r_fill = 0.05 * W

    tip = (0.61 * W, 0.5 * W)
    base1 = (0.39 * W, 0.37 * W)
    base2 = (0.39 * W, 0.63 * W)

    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            r = g = b = a = 0
            for sy in range(K):
                for sx in range(K):
                    fx = (x * K + sx + 0.5) / K
                    fy = (y * K + sy + 0.5) / K
                    if inside_rounded_rect(fx, fy, 0, 0, W, W, r_outer):
                        if inside_rounded_rect(fx, fy, pad, pad, W - pad, W - pad, r_screen):
                            if inside_rounded_rect(fx, fy, pad + bd, pad + bd, W - pad - bd, W - pad - bd, r_fill):
                                if inside_triangle(fx, fy, tip, base1, base2):
                                    r, g, b = white
                                else:
                                    r, g, b = fill
                            else:
                                r, g, b = border
                        else:
                            r, g, b = bg
                        a += 255
            if a:
                f = 255 / a
                row.append((int(r * f), int(g * f), int(b * f), 255))
            else:
                row.append((0, 0, 0, 0))
        rows.append(row)
    return rows


for s in (16, 48, 128):
    write_png(os.path.join(OUT_DIR, f'icon{s}.png'), s, s, render(s))
    print(f'icon{s}.png done')
