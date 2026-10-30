"""Builds the product overview PDFs in assets/docs using Microsoft Edge.

Run it again after changing screenshots or wording:
    python tools/build_overviews.py
The PDFs leave out prices, so a price change doesn't make them stale.
"""
import html
import subprocess
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
IMG = REPO / "assets" / "img"
OUT = REPO / "assets" / "docs"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
SITE = "raviknight.github.io/website"  # change when the real domain is ready

CSS = """
@page { size: letter; margin: 0.6in; }
* { box-sizing: border-box; }
body { margin: 0; color: #1c1917; font: 10.5pt/1.45 "Segoe UI", Arial, sans-serif; }
.top { border-top: 6pt solid #ea580c; padding-top: 12pt; }
.eyebrow { color: #c2410c; font-size: 8.5pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; margin: 0; }
h1 { font-size: 23pt; line-height: 1.12; margin: 5pt 0 7pt; letter-spacing: -.01em; }
.lede { color: #57534e; font-size: 11.5pt; margin: 0 0 12pt; }
h2 { font-size: 13pt; margin: 14pt 0 5pt; }
ul { margin: 0; padding-left: 13pt; }
li { margin-top: 3pt; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt 20pt; }
.cols h3 { font-size: 10.5pt; margin: 0; }
.cols p { margin: 2pt 0 0; color: #57534e; font-size: 9.5pt; }
figure { margin: 8pt 0 0; border: .75pt solid #e2ddd5; border-radius: 5pt; overflow: hidden; }
figure img { display: block; width: 100%; max-height: 5.4in; object-fit: cover; object-position: top; }
.shots img { height: auto; max-height: 2.3in; object-position: left top; }
figcaption { font-size: 8.5pt; color: #57534e; padding: 4pt 7pt; border-top: .75pt solid #e2ddd5; }
.shots { display: grid; grid-template-columns: 1fr 1fr; gap: 9pt; }
.next { margin-top: 14pt; padding: 10pt 12pt; background: #f3f0eb; border-radius: 5pt; break-inside: avoid; }
.next strong { display: block; font-size: 11.5pt; }
.page2 { break-before: page; }
"""


def figure(name, caption):
    return f'<figure><img src="{(IMG / name).as_uri()}"><figcaption>{html.escape(caption)} Sample data.</figcaption></figure>'


def bullets(items):
    return "<ul>" + "".join(f"<li>{html.escape(i)}</li>" for i in items) + "</ul>"


def features(items):
    return '<div class="cols">' + "".join(
        f"<div><h3>{html.escape(a)}</h3><p>{html.escape(b)}</p></div>" for a, b in items
    ) + "</div>"


def document(p):
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{html.escape(p['title'])}</title><style>{CSS}</style></head><body>
<div class="top">
  <p class="eyebrow">{html.escape(p['eyebrow'])}</p>
  <h1>{html.escape(p['headline'])}</h1>
  <p class="lede">{html.escape(p['lede'])}</p>
</div>
<h2>{html.escape(p['problem_title'])}</h2>
{bullets(p['problems'])}
{figure(*p['hero'])}
<div class="page2">
<h2>What's in it</h2>
{features(p['features'])}
<h2>A look inside</h2>
<div class="shots">{''.join(figure(*s) for s in p['shots'])}</div>
<h2>{html.escape(p['trust_title'])}</h2>
<p style="margin:0">{html.escape(p['trust'])}</p>
<div class="next"><strong>{html.escape(p['next'])}</strong>Pricing, a calculator and the contact form are at {SITE}.</div>
</div>
</body></html>"""


PRODUCTS = {
    "forge-overview.pdf": {
        "title": "Forge overview",
        "eyebrow": "Forge manufacturing ERP",
        "headline": "Replace the spreadsheets, or the ERP your team works around.",
        "lede": "Forge is for contract manufacturers: machine shops, aerospace, medical device, defense and ISO 9001 shops.",
        "problem_title": "Who it's for",
        "problems": [
            "Shops running on Excel and Word, where quotes, travelers and NCRs are separate files and the schedule depends on one person.",
            "Shops on an old ERP, with dated screens, workflows from years ago, and a team that keeps its own spreadsheets to get around them.",
        ],
        "hero": ("forge-routing.png", "A routing with its steps and inspections."),
        "features": [
            ("Quote to cash", "Quotes, orders, work orders, shipping, certificates of conformance and invoicing."),
            ("Parts, BOMs and routings", "A part master with revisions, bills of materials and routings."),
            ("Scheduling", "Jobs plan back from their due dates using routing estimates. A module adds machine lanes you can drag."),
            ("Job costing", "See what a job actually cost, and compare it with the quote."),
            ("Purchasing and inventory", "Purchasing, receiving and stock, with lot traceability."),
            ("Ballooning and inspection", "Balloon your prints and inspect against inspection guide sheets (IGS)."),
            ("Quality", "NCR and CAPA, gages and calibration, and internal audits."),
            ("Documents and change control", "Controlled documents, a form designer, and engineering and document change notices."),
            ("Maintenance", "PM Tracker runs inside Forge as its maintenance module."),
        ],
        "shots": [
            ("forge-job-schedule.png", "The job schedule flags late work."),
            ("forge-change-notice.png", "A change notice sent back for revision."),
        ],
        "trust_title": "Designed to support regulated work",
        "trust": "Forge supports practices that AS9100, ISO 13485 and 21 CFR Part 11 ask for, including audit trails, electronic signatures and controlled documents. Certification and validation remain with your shop. Forge runs on your own PC or server.",
        "next": "See Forge on a job like yours.",
    },
    "pm-tracker-overview.pdf": {
        "title": "PM Tracker overview",
        "eyebrow": "PM Tracker maintenance software",
        "headline": "Get your PMs off paper and your records out of Excel.",
        "lede": "A self-hosted maintenance system for manufacturers regulated by the FDA, EMA and Health Canada.",
        "problem_title": "Who it's for",
        "problems": [
            "Plants with PMs on paper, where sheets get lost and signed copies end up in binders.",
            "Teams keeping records in Excel, where anyone can overwrite a cell and finding out what's overdue means asking around.",
            "People who have never used maintenance software. Import your asset list and start small.",
        ],
        "hero": ("pm-dashboard.png", "The dashboard shows what's overdue, which machines are on hold and what's waiting for approval."),
        "features": [
            ("Drag-and-drop planning", "Supervisors move PMs where they fit as the week changes."),
            ("Auto scheduling", "If nobody has planned the week, the work is scheduled and marked as auto-scheduled."),
            ("Live board", "A wall display of work due, your team, machine availability and planned downtime."),
            ("PMs and checklists", "Reusable PM templates, with checklists for each task."),
            ("Work orders", "Work saves as it goes, and supervisors approve it when it's done."),
            ("Breakdown requests", "Report a breakdown, get it repaired, then send it for QA review."),
            ("Machine holds", "Take a machine out of service, and lift the hold when it's ready."),
            ("Spare parts", "Track the spares your team uses and what's left in stock."),
            ("Reports and history", "Maintenance cost reports and a printable history for each machine."),
        ],
        "shots": [
            ("pm-weekly-plan.png", "The weekly plan, by technician and day."),
            ("pm-live-board.png", "The live board's machine availability view."),
        ],
        "trust_title": "Built for regulated plants",
        "trust": "Every action goes into an append-only audit trail, designed to support your validation. Access follows each person's level and discipline. PM Tracker runs on your own server, licenses are checked locally, and every plan includes unlimited users.",
        "next": "See PM Tracker on your equipment list.",
    },
}

OUT.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    for filename, product in PRODUCTS.items():
        page = Path(tmp) / (filename + ".html")
        page.write_text(document(product), encoding="utf-8")
        subprocess.run(
            [EDGE, "--headless", "--disable-gpu", "--no-pdf-header-footer",
             f"--user-data-dir={Path(tmp) / ('edge-' + filename)}",  # a shared profile can hang the next run
             f"--print-to-pdf={OUT / filename}", page.as_uri()],
            check=True, capture_output=True, timeout=120,
        )
        print("built", OUT / filename)
