"""生成日日办的图标：墨绿圆角方 + 米白「日」字。

用法（Windows，需 Pillow）：
    python scripts/make_icons.py

输出：
    icons/icon-192.png
    icons/icon-512.png
    icons/icon-maskable-512.png   （背景铺满，内容缩到 82%，安卓自适应图标用）
    icons/apple-touch-icon.png    （180，不透明，iOS 主屏用）
    icons/favicon-32.png          （浏览器标签页用）

只改颜色/字号/字体时，改下面这几个常量即可。
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"

GREEN = "#2f5f49"
CREAM = "#f7f1e4"
GLYPH = "日"

# 华文中宋：笔画带衬线脚，缩小后仍比普通宋体厚实，和应用的衬线标题是一套语言
FONT_CANDIDATES = [
    "C:/Windows/Fonts/STZHONGS.TTF",
    "C:/Windows/Fonts/NotoSerifSC-VF.ttf",
    "C:/Windows/Fonts/simsun.ttc",
]

RADIUS_RATIO = 17 / 64   # 和 icon.svg 的 rx=17/64 对齐
GLYPH_RATIO = 0.545      # 字高占图标边长的比例
OPTICAL_SHIFT = -0.012   # 视觉居中：字略微上移 1.2%
SUPERSAMPLE = 4


def pick_font():
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return path
    raise SystemExit("找不到可用的中文字体，请修改 FONT_CANDIDATES")


FONT = pick_font()


def glyph_layer(size):
    """把「日」渲染成透明图层，按墨迹包围盒精确居中。"""
    font = ImageFont.truetype(FONT, int(size * 0.8))
    box = font.getbbox(GLYPH)
    ink_h = box[3] - box[1]

    # 按目标字高反推字号
    target_h = size * GLYPH_RATIO
    font = ImageFont.truetype(FONT, int(font.size * target_h / ink_h))
    box = font.getbbox(GLYPH)
    ink_h = box[3] - box[1]
    ink_w = box[2] - box[0]

    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x = (size - ink_w) / 2 - box[0]
    y = (size - ink_h) / 2 - box[1] + size * OPTICAL_SHIFT
    draw.text((x, y), GLYPH, font=font, fill=CREAM)
    return layer


def render(size, maskable=False, opaque=False, rounded=True):
    canvas = size * SUPERSAMPLE
    icon = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(icon)

    if maskable:
        draw.rectangle([0, 0, canvas, canvas], fill=GREEN)
        inner = int(canvas * 0.82)
        offset = (canvas - inner) // 2
        icon.alpha_composite(glyph_layer(inner), (offset, offset))
    elif not rounded:
        # 交给系统自己切圆角（iOS 主屏）——自己切会和系统遮罩叠出四个浅色角
        draw.rectangle([0, 0, canvas, canvas], fill=GREEN)
        icon.alpha_composite(glyph_layer(canvas))
    else:
        draw.rounded_rectangle(
            [0, 0, canvas - 1, canvas - 1],
            radius=int(canvas * RADIUS_RATIO),
            fill=GREEN,
        )
        icon.alpha_composite(glyph_layer(canvas))

    icon = icon.resize((size, size), Image.LANCZOS)
    if opaque:
        flat = Image.new("RGB", (size, size), CREAM)
        flat.paste(icon, (0, 0), icon)
        return flat
    return icon


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    jobs = [
        ("icon-192.png", 192, {"maskable": False}),
        ("icon-512.png", 512, {"maskable": False}),
        ("icon-maskable-512.png", 512, {"maskable": True}),
        ("apple-touch-icon.png", 180, {"rounded": False, "opaque": True}),
        ("favicon-32.png", 32, {"opaque": True}),
    ]
    for name, size, kwargs in jobs:
        path = OUT / name
        render(size, **kwargs).save(path)
        print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")
