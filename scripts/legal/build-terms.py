#!/usr/bin/env python3
"""Genera los PDF de Términos y Condiciones a partir de docs/legal/*.md.

Uso:
  python3 scripts/legal/build-terms.py            # publica en apps/web/public/terms/
  python3 scripts/legal/build-terms.py --draft    # borrador con marca de agua en docs/legal/

Antes de publicar, completa los datos de DATOS_EMPRESA. El script se niega a
publicar si queda algún dato sin completar.

Formato de los .md (subconjunto mínimo):
  % línea de título     (hasta 3, centradas en la portada)
  ## Título de sección
  - viñeta   /   1. ítem numerado
  **negrita**
  {{CLAVE}}             se reemplaza con DATOS_EMPRESA
"""
import base64
import html
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ─── Completar antes de publicar ───────────────────────────────────────────
DATOS_EMPRESA = {
    # Debe coincidir EXACTO con la escritura/SII de la sociedad del RUT.
    "RAZON_SOCIAL": "",
    "RUT": "78.374.984-K",
    "DOMICILIO": "",  # ej: "Av. Apoquindo 1234, oficina 56, Las Condes, Santiago"
    "FECHA_VIGENCIA": "",  # ej: "1 de noviembre de 2026"
}

DOCS = [
    ("terminos-usuario-final.md", "terminos-cliente.pdf"),
    ("terminos-usuario-oferente.md", "terminos-oferente.pdf"),
]

CHROME_CANDIDATES = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "google-chrome",
    "chromium",
    "chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

CSS = """
@page { size: Letter; margin: 22mm 22mm 20mm 22mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.5;
       color: #111; text-align: justify; }
.logo { height: 46px; }
.titles { text-align: center; margin: 18px 0 26px; }
.titles div { font-weight: bold; font-size: 13pt; margin: 4px 0; }
.titles div.version { font-weight: normal; font-size: 10pt; color: #555; }
h2 { font-size: 11pt; margin: 20px 0 8px; page-break-after: avoid; }
p { margin: 0 0 8px; }
ul, ol { margin: 0 0 8px; padding-left: 22px; }
li { margin-bottom: 4px; }
.draft { position: fixed; top: 40%; left: 0; right: 0; text-align: center;
         font-size: 90pt; color: rgba(200,0,0,.12); transform: rotate(-30deg); z-index: -1; }
.missing { background: #ffe066; }
"""


def inline(text: str) -> str:
    text = html.escape(text, quote=False)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    return text


def fill(text: str, draft: bool) -> str:
    def repl(m):
        key = m.group(1)
        val = DATOS_EMPRESA.get(key, "")
        if val:
            return val
        return f"[COMPLETAR {key}]" if draft else m.group(0)

    return re.sub(r"\{\{(\w+)\}\}", repl, text)


def md_to_html(src: str) -> str:
    titles, body, para, list_tag = [], [], [], None

    def flush_para():
        if para:
            body.append(f"<p>{inline(' '.join(para))}</p>")
            para.clear()

    def close_list():
        nonlocal list_tag
        if list_tag:
            body.append(f"</{list_tag}>")
            list_tag = None

    for raw in src.splitlines():
        line = raw.rstrip()
        if line.startswith("% "):
            titles.append(line[2:])
            continue
        m_ul = re.match(r"^- (.*)", line)
        m_ol = re.match(r"^\d+\. (.*)", line)
        if m_ul or m_ol:
            flush_para()
            tag = "ul" if m_ul else "ol"
            if list_tag != tag:
                close_list()
                body.append(f"<{tag}>")
                list_tag = tag
            body.append(f"<li>{inline((m_ul or m_ol).group(1))}</li>")
            continue
        if not line:
            flush_para()
            close_list()
            continue
        if line.startswith("## "):
            flush_para()
            close_list()
            body.append(f"<h2>{inline(line[3:])}</h2>")
            continue
        close_list()
        para.append(line)
    flush_para()
    close_list()

    title_html = "".join(
        f'<div class="{"version" if i == 2 else ""}">{inline(t)}</div>' for i, t in enumerate(titles)
    )
    return title_html, "\n".join(body)


def find_chrome() -> str:
    for c in CHROME_CANDIDATES:
        if os.path.isabs(c) and os.path.exists(c):
            return c
        if not os.path.isabs(c):
            try:
                subprocess.run([c, "--version"], capture_output=True, check=True)
                return c
            except (OSError, subprocess.CalledProcessError):
                pass
    sys.exit("No se encontró Chrome/Chromium para generar el PDF.")


def main():
    draft = "--draft" in sys.argv
    missing = [k for k, v in DATOS_EMPRESA.items() if not v.strip()]
    if missing and not draft:
        sys.exit(
            "Faltan datos en DATOS_EMPRESA: " + ", ".join(missing)
            + "\nCompleta scripts/legal/build-terms.py o usa --draft."
        )

    with open(os.path.join(ROOT, "apps/web/public/brand/logo-black.png"), "rb") as f:
        logo = base64.b64encode(f.read()).decode()

    chrome = find_chrome()
    out_dir = os.path.join(ROOT, "docs/legal") if draft else os.path.join(ROOT, "apps/web/public/terms")

    for md_name, pdf_name in DOCS:
        with open(os.path.join(ROOT, "docs/legal", md_name), encoding="utf-8") as f:
            src = fill(f.read(), draft)
        titles, body = md_to_html(src)
        body = re.sub(r"(\[COMPLETAR \w+\])", r'<span class="missing">\1</span>', body)
        doc = f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>{CSS}</style></head><body>
{'<div class="draft">BORRADOR</div>' if draft else ''}
<img class="logo" src="data:image/png;base64,{logo}" alt="UZEED">
<div class="titles">{titles}</div>
{body}
</body></html>"""
        if draft:
            pdf_name = pdf_name.replace(".pdf", "-BORRADOR.pdf")
        out = os.path.join(out_dir, pdf_name)
        with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tmp:
            tmp.write(doc)
        try:
            subprocess.run(
                [chrome, "--headless=new", "--no-sandbox", "--disable-gpu",
                 "--no-pdf-header-footer", f"--print-to-pdf={out}", f"file://{tmp.name}"],
                check=True, capture_output=True,
            )
        finally:
            os.unlink(tmp.name)
        print("✓", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    main()
