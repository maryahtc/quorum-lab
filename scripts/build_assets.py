"""Gera os derivados de marca e fontes a partir dos arquivos oficiais.

- Símbolo Q: apenas recorte da margem transparente e redimensionamento
  proporcional. Nenhuma alteração de cor, contorno, sombra ou efeito.
- Fontes do PDF: converte os WOFF do @fontsource (subset latin) em TTF e
  embute como base64 nos módulos das Netlify Functions.

Requer: pip install pillow fonttools brotli
Uso: npm run assets
"""
import base64
import io
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_Q = ROOT / "brand/original/q-simbolo.webp"
PUBLIC = ROOT / "public/brand"
FN_ASSETS = ROOT / "netlify/functions/_lib/assets"
BLACK = (11, 11, 11, 255)


def q_symbol() -> Image.Image:
    im = Image.open(SRC_Q).convert("RGBA")
    return im.crop(im.getbbox())


def resized(im: Image.Image, height: int) -> Image.Image:
    w = round(im.width * height / im.height)
    return im.resize((w, height), Image.LANCZOS)


def on_black_square(im: Image.Image, size: int, pad_ratio: float = 0.16) -> Image.Image:
    inner = round(size * (1 - 2 * pad_ratio))
    sym = im.copy()
    sym.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), BLACK)
    canvas.alpha_composite(sym, ((size - sym.width) // 2, (size - sym.height) // 2))
    return canvas


def write_b64_module(path: Path, name: str, data: bytes) -> None:
    b64 = base64.b64encode(data).decode()
    path.write_text(
        "// Arquivo gerado por scripts/build_assets.py — não editar à mão.\n"
        f"export const {name} = \"{b64}\";\n"
    )


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    FN_ASSETS.mkdir(parents=True, exist_ok=True)

    q = q_symbol()
    for h in (96, 192, 384):
        resized(q, h).save(PUBLIC / f"q-{h}.png", optimize=True)
    on_black_square(q, 32).save(PUBLIC / "favicon-32.png", optimize=True)
    on_black_square(q, 180).save(PUBLIC / "apple-touch-icon.png", optimize=True)
    on_black_square(q, 512).save(PUBLIC / "q-512-black.png", optimize=True)

    buf = io.BytesIO()
    resized(q, 480).save(buf, format="PNG", optimize=True)
    write_b64_module(FN_ASSETS / "qSymbol.ts", "Q_SYMBOL_PNG_B64", buf.getvalue())

    fonts = {
        "CORMORANT_LIGHT": "cormorant-garamond/files/cormorant-garamond-latin-300-normal.woff",
        "CORMORANT_REGULAR": "cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff",
        "INTER_LIGHT": "inter/files/inter-latin-300-normal.woff",
        "INTER_REGULAR": "inter/files/inter-latin-400-normal.woff",
        "INTER_MEDIUM": "inter/files/inter-latin-500-normal.woff",
    }
    lines = ["// Arquivo gerado por scripts/build_assets.py — não editar à mão.",
             "// Fontes: @fontsource (SIL Open Font License 1.1)."]
    for name, rel in fonts.items():
        f = TTFont(ROOT / "node_modules/@fontsource" / rel)
        f.flavor = None
        out = io.BytesIO()
        f.save(out)
        lines.append(f'export const {name} = "{base64.b64encode(out.getvalue()).decode()}";')
    (FN_ASSETS / "fonts.ts").write_text("\n".join(lines) + "\n")
    print("ok", q.size)


if __name__ == "__main__":
    main()
