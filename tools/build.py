#!/usr/bin/env python3
"""Build the static Pure Hair Spa site from the design source files.

Usage: python3 tools/build.py SOURCE_DIR

SOURCE_DIR holds the design files (Main.dc.html, Services.dc.html, ...).
Writes index.html, services.html, faq.html and contact.html to the repo root.
Assets are expected in assets/ already (see ASSETS below).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PAGES = {
    "Main": ("index.html", "Pure Hair Spa | Hair & Scalp Spa in Bloomfield Township, MI",
             "Pure Hair Spa is a family owned boutique hair and scalp spa in Bloomfield Township, Michigan: cuts, color, Halo extensions, scalp care, hair reconstruction, nails and threading."),
    "Services": ("services.html", "Services | Pure Hair Spa",
                 "Cuts, color, Halo extensions, styling, scalp care, hair treatments, nails and threading at Pure Hair Spa in Bloomfield Township, MI."),
    "FAQ": ("faq.html", "FAQ | Pure Hair Spa",
            "Answers to common questions about booking, services, scalp care and Halo extensions at Pure Hair Spa."),
    "Contact": ("contact.html", "Contact & Booking | Pure Hair Spa",
                "Book an appointment or contact Pure Hair Spa at 3655 W Maple Rd, Bloomfield Township, MI 48301. Call (248) 792-3146."),
}
COMPONENTS = ["Footer", "Transition", "Falls"]

ASSETS = {
    "094c17f6799e48911a8db9e6ff9cf158": "results-reconstruction-before.jpg",
    "1ed357b5731fa5405a55b1191e88ca85": "results-reconstruction-after.jpg",
    "313b9f3f729bc6bae951a4febf0a5d1d": "results-halo-before.jpg",
    "3a737b6067c53249966f58b3f6449098": "results-halo-after.jpg",
    "1134c036b31f643218f9df52e38fe195": "waterfall-poster.jpg",
    "1dfa195d2e15fbb4cfa1d44522f3fb67": "waterfall.mp4",
    "3ee74958a0985a22e3410f51ac0927de": "waterfall-mask.png",
    "ec7fe47f07b85e408d351a4770f5a2e1": "logo.png",
    "f53a52ba6404ce4c46a5af8b1ab2efd9": "ig-pink-color.jpg",
    "5184189e24121603b99a14a5dcd374dc": "ig-14-years.jpg",
    "701eb079284d17939f7da70bb15eeb42": "ig-glaze-drops.jpg",
    "f1eab54f4777d6cbe500f1ca742de751": "ig-blonde-layers.jpg",
    "7b7130050f75fd96a3f79306d528c13d": "ig-13-years.jpg",
    "39376e351b721b76223c2193868b3bfa": "ig-fall-planter.jpg",
    "99adcd84c2620bf329d11d3861f0c53c": "service-cuts.jpg",
    "955428b62c29ff784084adf652affdbc": "service-color.jpg",
    "ec2b464e93809067ce891f63ec121da2": "service-halo.jpg",
    "ee684283c05c65262682028c8e2af341": "service-styling.jpg",
    "4967793be986662e6685f13c41359f62": "service-scalp.jpg",
    "289d721aa1bafd38ca9594cf2a11fa9e": "service-treatments.jpg",
    "23988ce11713a1da8f3156fce7e81907": "service-threading.jpg",
}


def fix_refs(text):
    def blob(m):
        name = ASSETS.get(m.group(1))
        if not name:
            raise SystemExit(f"unmapped asset {m.group(1)}")
        return "assets/" + name
    text = re.sub(r"/_blob/([0-9a-f]{32})", blob, text)
    for comp, (fname, _, _) in PAGES.items():
        text = text.replace(f"{comp}.dc.html", fname)
    # The page transition only intercepted links to design files; point it at site pages.
    text = text.replace(r"!/\.dc\.html/i.test(href)", r"!/^(?![a-z][a-z0-9+.-]*:)[^#?]*\.html/i.test(href)")
    return text


def parse(path):
    src = path.read_text(encoding="utf-8")
    xdc = re.search(r"<x-dc>(.*)</x-dc>", src, re.S).group(1)
    helmet = ""
    m = re.search(r"<helmet>(.*?)</helmet>", xdc, re.S)
    if m:
        helmet = m.group(1).strip()
        xdc = xdc[:m.start()] + xdc[m.end():]
    sm = re.search(r"<script type=\"text/x-dc\" data-dc-script data-props='(.*?)'>(.*?)</script>", src, re.S)
    props = json.loads(sm.group(1)) if sm else {}
    code = sm.group(2) if sm else "class Component extends DCLogic { renderVals() { return {}; } }"
    return {"tpl": xdc.strip(), "helmet": helmet, "props": props, "code": code.strip()}


def imports_of(tpl):
    return re.findall(r"<dc-import name=\"([A-Za-z0-9_]+)\"", tpl)


def collect(name, parsed, seen):
    if name in seen:
        return
    seen.append(name)
    for child in imports_of(parsed[name]["tpl"]):
        collect(child, parsed, seen)


def split_head(helmets):
    links, styles = [], []
    for h in helmets:
        for ln in re.findall(r"<link[^>]*>", h):
            if ln not in links:
                links.append(ln)
        styles.extend(re.findall(r"<style>(.*?)</style>", h, re.S))
    return links, styles


def build(src_dir):
    parsed = {}
    for name in list(PAGES) + COMPONENTS:
        parsed[name] = parse(src_dir / f"{name}.dc.html")

    for page, (fname, title, desc) in PAGES.items():
        order = []
        collect(page, parsed, order)
        links, styles = split_head([parsed[n]["helmet"] for n in order])
        templates = "\n".join(
            f'<template id="tpl-{n}">\n{parsed[n]["tpl"]}\n</template>' for n in order)
        defines = "\n".join(
            "DC.define({name}, document.getElementById({tid}), (function () {{\n{code}\nreturn Component;\n}})(), {props});".format(
                name=json.dumps(n), tid=json.dumps("tpl-" + n), code=parsed[n]["code"],
                props=json.dumps(parsed[n]["props"]))
            for n in order)
        html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="assets/waterfall-poster.jpg">
<meta name="theme-color" content="#f8f8f8">
<link rel="icon" type="image/png" href="assets/favicon.png">
{chr(10).join(links)}
<style>
{chr(10).join(s.strip() for s in styles)}
</style>
</head>
<body>
<div id="app"></div>
<noscript><p style="padding:24px;font-family:sans-serif">Pure Hair Spa, 3655 W Maple Rd, Bloomfield Township, MI 48301. Call (248) 792-3146 or email info@purehairspa.com. Please enable JavaScript to view this site.</p></noscript>
{templates}
<script src="js/dc-lite.js"></script>
<script>
{defines}
DC.mount({json.dumps(page)}, document.getElementById("app"));
</script>
</body>
</html>
"""
        (ROOT / fname).write_text(fix_refs(html), encoding="utf-8")
        print("wrote", fname)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    build(Path(sys.argv[1]))
