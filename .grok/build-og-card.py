#!/usr/bin/env python3
"""Build a 1200x630 editorial Canopy share-card as HTML (code-drawn)."""
from __future__ import annotations

import math
import random
from pathlib import Path

W, H = 1200, 630
CX, CY = W / 2, H / 2 + 8
OUT = Path("/workspace/.grok/og-card.html")

# Palette
OLIVE = "#12140f"
SAGE = "#c5d4b0"
PAPER = "#f3f0e7"
INK = "#1c1914"
DEEP = "#2a3023"
MID = "#6d7a58"
LIT = "#dce6cc"


def leaf_path() -> str:
    # Unit leaf pointing up, ~36x64, almond / laurel.
    return "M0,-32 C14,-16 15,14 0,32 C-15,14 -14,-16 0,-32 Z"


def ellipse(cx, cy, rx, ry, fill, opacity=1, extra=""):
    op = f' opacity="{opacity:.3f}"' if opacity < 1 else ""
    return (
        f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" '
        f'fill="{fill}"{op}{extra}/>'
    )


def main() -> None:
    rng = random.Random(27)
    parts: list[str] = []

    # Background
    parts.append(f'<rect width="{W}" height="{H}" fill="{OLIVE}"/>')

    # Warm oculus glow — sky through the canopy
    parts.append(
        f"""
        <defs>
          <radialGradient id="oculus" cx="50%" cy="46%" r="42%">
            <stop offset="0%" stop-color="{PAPER}" stop-opacity="0.22"/>
            <stop offset="38%" stop-color="{SAGE}" stop-opacity="0.10"/>
            <stop offset="100%" stop-color="{OLIVE}" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="shaft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="{PAPER}" stop-opacity="0.16"/>
            <stop offset="100%" stop-color="{PAPER}" stop-opacity="0"/>
          </linearGradient>
          <filter id="soft">
            <feGaussianBlur stdDeviation="18"/>
          </filter>
        </defs>
        """
    )
    parts.append(f'<rect width="{W}" height="{H}" fill="url(#oculus)"/>')

    # Light shafts falling from the canopy
    shafts = [
        (430, -40, 46, 520, -7),
        (560, -60, 70, 560, 2),
        (720, -30, 40, 480, 8),
        (640, -50, 28, 500, -3),
    ]
    for x, y, w, h, rot in shafts:
        parts.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#shaft)" '
            f'transform="rotate({rot} {x + w/2} {y})" opacity="0.85"/>'
        )

    # Large canopy masses — overlapping treetop ellipses (corners + top band)
    masses = [
        # top band
        (80, -10, 220, 130, DEEP, 0.95),
        (280, -30, 200, 150, MID, 0.55),
        (520, -40, 260, 160, DEEP, 0.9),
        (760, -20, 210, 140, MID, 0.5),
        (1040, -10, 240, 135, DEEP, 0.95),
        (160, 40, 150, 100, SAGE, 0.35),
        (400, 20, 170, 110, SAGE, 0.28),
        (900, 30, 180, 115, SAGE, 0.32),
        (600, 10, 190, 100, LIT, 0.18),
        # left
        (-40, 220, 180, 160, DEEP, 0.95),
        (40, 340, 150, 130, MID, 0.45),
        (20, 500, 170, 140, DEEP, 0.9),
        # right
        (1240, 210, 190, 170, DEEP, 0.95),
        (1160, 360, 160, 140, MID, 0.45),
        (1180, 510, 180, 150, DEEP, 0.9),
        # bottom corners
        (120, 640, 220, 140, DEEP, 0.9),
        (1080, 640, 230, 145, DEEP, 0.9),
        (300, 620, 160, 110, MID, 0.4),
        (900, 625, 170, 115, MID, 0.4),
        (600, 660, 280, 120, DEEP, 0.85),
    ]
    for cx, cy, rx, ry, fill, op in masses:
        parts.append(ellipse(cx, cy, rx, ry, fill, op))

    # Individual leaves around a ring, leaving a clear center for the lockup
    leaf_d = leaf_path()
    # polar leaves
    n = 56
    for i in range(n):
        t = (i / n) * math.tau + rng.uniform(-0.08, 0.08)
        # denser at top
        dens = 0.55 + 0.45 * (0.5 + 0.5 * math.cos(t + math.pi / 2))
        if rng.random() > dens * 0.95:
            continue
        r = rng.uniform(250, 390)
        # squash vertically so the ring is wider than tall
        x = CX + math.cos(t) * r
        y = CY + math.sin(t) * r * 0.62
        # keep a generous center well
        if abs(x - CX) < 280 and abs(y - CY) < 130:
            continue
        scale = rng.uniform(0.7, 1.35)
        rot = math.degrees(t) + 90 + rng.uniform(-18, 18)
        fill = rng.choice([SAGE, SAGE, MID, LIT, DEEP])
        op = rng.uniform(0.55, 1.0)
        parts.append(
            f'<path d="{leaf_d}" fill="{fill}" opacity="{op:.2f}" '
            f'transform="translate({x:.1f} {y:.1f}) rotate({rot:.1f}) scale({scale:.2f})"/>'
        )

    # Extra leaves clustered in the four corners
    clusters = [
        (70, 70, 18),
        (1130, 70, 18),
        (80, 560, 14),
        (1120, 560, 14),
        (600, 40, 12),
        (600, 600, 10),
    ]
    for cx, cy, count in clusters:
        for _ in range(count):
            x = cx + rng.gauss(0, 55)
            y = cy + rng.gauss(0, 40)
            scale = rng.uniform(0.65, 1.4)
            rot = rng.uniform(-180, 180)
            fill = rng.choice([SAGE, SAGE, MID, LIT, DEEP])
            op = rng.uniform(0.5, 1.0)
            parts.append(
                f'<path d="{leaf_d}" fill="{fill}" opacity="{op:.2f}" '
                f'transform="translate({x:.1f} {y:.1f}) rotate({rot:.1f}) scale({scale:.2f})"/>'
            )

    svg = "\n".join(parts)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Canopy</title>
<style>
  @font-face {{
    font-family: Fraunces;
    src: url("./fonts/fraunces.ttf") format("truetype");
    font-weight: 600;
    font-style: normal;
  }}
  @font-face {{
    font-family: "IBM Plex Mono";
    src: url("./fonts/ibm-plex-mono.ttf") format("truetype");
    font-weight: 500;
    font-style: normal;
  }}
  html, body {{
    margin: 0;
    padding: 0;
    width: {W}px;
    height: {H}px;
    overflow: hidden;
    background: {OLIVE};
  }}
  .stage {{
    position: relative;
    width: {W}px;
    height: {H}px;
  }}
  svg {{
    position: absolute;
    inset: 0;
    width: {W}px;
    height: {H}px;
  }}
  .lockup {{
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    z-index: 2;
    padding: 0 180px;
  }}
  .kicker {{
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-weight: 500;
    font-size: 15px;
    letter-spacing: 0.42em;
    text-indent: 0.42em;
    text-transform: uppercase;
    color: {SAGE};
    margin: 0 0 18px;
  }}
  h1 {{
    font-family: Fraunces, "Liberation Serif", serif;
    font-weight: 600;
    font-size: 168px;
    line-height: 0.86;
    letter-spacing: -0.03em;
    color: {PAPER};
    margin: 0;
    font-optical-sizing: auto;
    font-variation-settings: "opsz" 144, "SOFT" 20, "WONK" 0;
    text-shadow: 0 2px 0 {INK}33, 0 18px 40px {OLIVE}aa;
  }}
  .rule {{
    width: 88px;
    height: 2px;
    background: {SAGE};
    margin: 22px 0 16px;
    opacity: 0.9;
  }}
  .tag {{
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-weight: 500;
    font-size: 16px;
    letter-spacing: 0.28em;
    text-indent: 0.28em;
    text-transform: uppercase;
    color: {SAGE};
    margin: 0;
  }}
</style>
</head>
<body>
  <div class="stage">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
      {svg}
    </svg>
    <div class="lockup">
      <p class="kicker">Keyword research</p>
      <h1>Canopy</h1>
      <div class="rule"></div>
      <p class="tag">Rank tracking</p>
    </div>
  </div>
</body>
</html>
"""
    OUT.write_text(html)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
