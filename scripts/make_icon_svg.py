"""从字体里取出「日」的轮廓，生成矢量版 icon.svg。

图标 PNG 是 Pillow 画的（scripts/make_icons.py），SVG 版必须用同一条轮廓，
否则浏览器标签页的图标和主屏图标会长得不一样。

用法：
    python scripts/make_icon_svg.py
输出：
    icon.svg
"""

from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT_PATH = "C:/Windows/Fonts/STZHONGS.TTF"
GLYPH = "日"

SIZE = 64.0
RADIUS = 17.0
GLYPH_RATIO = 0.545
OPTICAL_SHIFT = -0.012
GREEN = "#2f5f49"
CREAM = "#f7f1e4"


def build():
    font = TTFont(FONT_PATH)
    glyph_name = font.getBestCmap()[ord(GLYPH)]
    glyph_set = font.getGlyphSet()
    glyph = glyph_set[glyph_name]

    path_pen = SVGPathPen(glyph_set)
    glyph.draw(path_pen)
    d = path_pen.getCommands()

    bounds_pen = BoundsPen(glyph_set)
    glyph.draw(bounds_pen)
    x_min, y_min, x_max, y_max = bounds_pen.bounds

    ink_w = x_max - x_min
    ink_h = y_max - y_min
    scale = (SIZE * GLYPH_RATIO) / ink_h

    # 字体坐标 y 向上，SVG y 向下：scale(s, -s) 翻转后再平移到视觉中心
    tx = (SIZE - ink_w * scale) / 2 - x_min * scale
    ty = (SIZE + ink_h * scale) / 2 + y_min * scale + SIZE * OPTICAL_SHIFT

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="{RADIUS:g}" fill="{GREEN}"/>
  <g transform="translate({tx:.3f} {ty:.3f}) scale({scale:.5f} -{scale:.5f})">
    <path d="{d}" fill="{CREAM}"/>
  </g>
</svg>
"""


if __name__ == "__main__":
    out = ROOT / "icon.svg"
    out.write_text(build(), encoding="utf-8")
    print(f"wrote {out.name}")
