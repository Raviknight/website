"""Price editor for the website. Double-click edit-prices.bat to open it.

Edits data/pricing.json, which the pricing page reads. Nothing is public until you press Publish.
"""
import json
import subprocess
import urllib.request
from pathlib import Path

import pandas as pd
import pytz
import streamlit as st

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data" / "pricing.json"
LIVE = "https://raviknight.github.io/website/pricing/"
RATES = "https://api.frankfurter.dev/v1/latest?base=USD"  # European Central Bank reference rates


def git(*args):
    return subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, text=True)


def clean_text(value):
    return "" if value is None or pd.isna(value) else str(value).strip()


def clean_number(value):
    return None if value is None or pd.isna(value) else (int(value) if float(value).is_integer() else float(value))


def pm_cost(pm, machines, extra=0):
    """The band a plant falls in sets the price of all its machines, down to the band's minimum."""
    tiers = [{"up_to": t["up_to"], "price": t["price"] + extra} for t in pm["tiers"]]
    tier = next(t for t in tiers if machines <= t["up_to"])
    minimum = max((t["up_to"] * t["price"] for t in tiers if t["up_to"] < tier["up_to"]), default=0)
    monthly = max(machines * tier["price"], minimum)
    return monthly, "This band's minimum charge" if monthly == minimum else f"{machines} x ${tier['price']:g}"


def problems(data):
    found = []
    forge, pm = data["forge"], data["pm_tracker"]
    if not forge["plans"]:
        found.append("Forge needs at least one plan.")
    for plan in forge["plans"]:
        if not plan["name"] or plan["price"] is None or plan["price"] < 0:
            found.append(f"Forge plan '{plan['name']}' needs a name and a price of 0 or more.")
    for module in forge["modules"]:
        if not module["name"]:
            found.append("Every module needs a name. Leave the price empty to show 'Ask us'.")
    previous = 0
    if not pm["plans"]:
        found.append("PM Tracker needs at least one plan.")
    for plan in pm["plans"]:
        if not plan["name"]:
            found.append("Every PM Tracker plan needs a name.")
    if not pm["tiers"]:
        found.append("PM Tracker needs at least one price band.")
    for tier in pm["tiers"]:
        if tier["up_to"] is None or tier["price"] is None:
            found.append("Every PM Tracker band needs a machine limit and a price.")
        elif tier["up_to"] <= previous:
            found.append(f"PM Tracker band up to {tier['up_to']} must be above {previous} machines.")
        else:
            previous = tier["up_to"]
    return found


st.set_page_config(page_title="Price editor", layout="wide")
st.title("Price editor")
current = json.loads(DATA.read_text(encoding="utf-8"))

with st.sidebar:
    st.subheader("Other PC")
    st.caption("Pull first if you changed prices on another PC.")
    if st.button("Pull latest prices"):
        result = git("pull", "--ff-only")
        (st.success if result.returncode == 0 else st.error)(result.stdout + result.stderr)
    st.link_button("Open the live pricing page", LIVE)

note = st.text_input(
    "Note shown at the top of the pricing page", current["note"],
    help="Visitors shown a currency other than their own also see a sentence in front of this, for example 'Prices are in euros, and we can quote in your local currency.'",
)
setup_note = st.text_area("One-time deployment text", current["setup_note"])

with st.expander("Regional prices"):
    st.caption(
        "Visitors in these countries see every price at this percentage of the list price. "
        "The site guesses the country from the visitor's time zone, and says nothing about it on the page. "
        "Leave the list empty to show everyone the list price."
    )
    regional_now = current.get("regional", {"percent": 100, "countries": []})
    countries = dict(sorted(pytz.country_names.items(), key=lambda item: item[1]))
    regional_percent = st.number_input("Percentage of the list price", 1, 100, int(regional_now["percent"]), step=1)
    regional_countries = st.multiselect(
        "Countries", list(countries), default=regional_now["countries"], format_func=lambda code: countries[code]
    )

if "exchange" not in st.session_state:
    st.session_state.exchange = current.get("exchange", {"date": "", "rates": {}})
with st.expander("Exchange rates"):
    st.caption(
        "Enter prices in US dollars. Visitors whose currency is in this list see prices converted with these rates "
        "and rounded to tidy amounts; everyone else sees US dollars. Update the rates now and then: the site only "
        "changes when you publish."
    )
    exchange = st.session_state.exchange
    st.write(f"Rates from {exchange['date'] or 'never'}, per US dollar.")
    if st.button("Update exchange rates"):
        try:
            with urllib.request.urlopen(RATES, timeout=15) as response:
                fetched = json.load(response)
            st.session_state.exchange = {"date": fetched["date"], "rates": fetched["rates"]}
            st.rerun()
        except Exception as error:  # no internet, or the service is down
            st.error(f"Couldn't get the rates: {error}")
    if exchange["rates"]:
        st.dataframe(
            pd.DataFrame(sorted(exchange["rates"].items()), columns=["currency", "per US dollar"]),
            hide_index=True, use_container_width=True,
        )

forge_tab, pm_tab = st.tabs(["Forge", "PM Tracker"])

with forge_tab:
    seat_label = st.text_input("Forge prices are per...", current["forge"]["seat_label"])

    st.subheader("Plans")
    st.caption("Separate the 'includes' items with a semicolon. Add a row for a new plan, or select a row and press Delete to remove it.")
    plans_df = pd.DataFrame(
        [{"name": p["name"], "price": float(p["price"]), "summary": p["summary"], "includes": "; ".join(p["includes"])}
         for p in current["forge"]["plans"]]
    )
    plans = st.data_editor(
        plans_df, num_rows="dynamic", use_container_width=True, hide_index=True, key="plans",
        column_config={
            "price": st.column_config.NumberColumn("price ($/month)", min_value=0.0, step=0.01, format="$%.2f"),
            "includes": st.column_config.TextColumn("includes", width="large"),
        },
    )

    st.subheader("Modules")
    modules_note = st.text_input("Text above the modules table", current["forge"]["modules_note"])
    st.caption("Leave the price empty to show 'Ask us'. Leave the unit empty to charge per Forge user.")
    modules_df = pd.DataFrame(current["forge"]["modules"], columns=["name", "price", "unit", "summary"])
    modules_df["price"] = pd.to_numeric(modules_df["price"], errors="coerce").astype(float)
    modules = st.data_editor(
        modules_df, num_rows="dynamic", use_container_width=True, hide_index=True, key="modules",
        column_config={
            "price": st.column_config.NumberColumn("price ($/month)", min_value=0.0, step=0.01, format="$%.2f"),
            "unit": st.column_config.TextColumn("charged per (for example terminal)"),
            "summary": st.column_config.TextColumn("what it adds", width="large"),
        },
    )

with pm_tab:
    left, right = st.columns(2)
    free_months = left.number_input("Gift trial licence, months (for people who contact us)", 0, value=current["pm_tracker"]["free_months"], step=1)
    grace_days = right.number_input("Grace period after it ends, days", 0, value=current["pm_tracker"]["grace_days"], step=1)

    st.subheader("Plans")
    st.caption("Each plan pays the band price plus its extra per machine. Separate the 'includes' items with a semicolon.")
    pm_plans = st.data_editor(
        pd.DataFrame(
            [{"name": p["name"], "extra": float(p.get("extra", 0)), "summary": p["summary"], "includes": "; ".join(p["includes"])}
             for p in current["pm_tracker"].get("plans", [])],
            columns=["name", "extra", "summary", "includes"],
        ),
        num_rows="dynamic", use_container_width=True, hide_index=True, key="pm_plans",
        column_config={
            "extra": st.column_config.NumberColumn("extra per machine per month", min_value=0.0, step=0.01, format="$%.2f"),
            "includes": st.column_config.TextColumn("includes", width="large"),
        },
    )

    st.subheader("Price bands")
    st.caption("A plant's band sets the price of all its machines. Each band's minimum charge is the most a smaller plant pays, so a bill never drops when machines are added. Each row runs from the end of the row above up to its limit. The last limit is the machine cap: above it, the site says 'Contact us'. Add a row for a new band.")
    tiers = st.data_editor(
        pd.DataFrame(current["pm_tracker"]["tiers"], columns=["up_to", "price"]).astype({"price": float}),
        num_rows="dynamic", use_container_width=True, hide_index=True, key="tiers",
        column_config={
            "up_to": st.column_config.NumberColumn("up to this many machines", min_value=1, step=1, format="%d"),
            "price": st.column_config.NumberColumn("price per machine per month, before the plan's extra", min_value=0.0, step=0.01, format="$%.2f"),
        },
    )

data = {
    "note": note,
    "setup_note": setup_note,
    "regional": {"percent": int(regional_percent), "countries": sorted(regional_countries)},
    "exchange": st.session_state.exchange,
    "forge": {
        "seat_label": seat_label,
        "plans": [
            {
                "name": clean_text(row["name"]),
                "price": clean_number(row["price"]),
                "summary": clean_text(row["summary"]),
                "includes": [item.strip() for item in clean_text(row["includes"]).split(";") if item.strip()],
            }
            for row in plans.to_dict("records")
        ],
        "modules_note": modules_note,
        "modules": [
            {
                "name": clean_text(row["name"]),
                "price": clean_number(row["price"]),
                "unit": clean_text(row["unit"]),
                "summary": clean_text(row["summary"]),
            }
            for row in modules.to_dict("records")
        ],
    },
    "pm_tracker": {
        "free_months": int(free_months),
        "grace_days": int(grace_days),
        "plans": [
            {
                "name": clean_text(row["name"]),
                "extra": clean_number(row["extra"]) or 0,
                "summary": clean_text(row["summary"]),
                "includes": [item.strip() for item in clean_text(row["includes"]).split(";") if item.strip()],
            }
            for row in pm_plans.dropna(how="all").to_dict("records")
        ],
        "tiers": [
            {"up_to": clean_number(row["up_to"]), "price": clean_number(row["price"])}
            for row in tiers.dropna(how="all").to_dict("records")
        ],
    },
}

errors = problems(data)
for error in errors:
    st.error(error)

st.divider()
st.subheader("Check it")
if not errors:
    data["pm_tracker"]["tiers"].sort(key=lambda t: t["up_to"])
    left, right = st.columns(2)
    with left:
        plan_names = [p["name"] for p in data["forge"]["plans"]]
        plan_name = st.selectbox("Forge plan", plan_names)
        users = st.number_input("Forge users", 1, value=10, step=1)
        price = next(p["price"] for p in data["forge"]["plans"] if p["name"] == plan_name)
        st.metric("Forge per year", f"${price * users * 12:,.2f}", f"${price * users:,.2f} per month", delta_color="off")
        if regional_countries:
            st.caption(f"Regional: \\${price * users * 12 * regional_percent / 100:,.2f} per year")
    with right:
        pm_plan = st.selectbox("PM Tracker plan", [p["name"] for p in data["pm_tracker"]["plans"]])
        extra = next(p["extra"] for p in data["pm_tracker"]["plans"] if p["name"] == pm_plan)
        machines = st.number_input("PM Tracker machines", 1, value=20, step=1)
        if machines > data["pm_tracker"]["tiers"][-1]["up_to"]:
            st.info("Above the machine cap: the site says 'Contact us'.")
        else:
            monthly, line = pm_cost(data["pm_tracker"], machines, extra)
            st.metric("PM Tracker per year", f"${monthly * 12:,.2f}", f"${monthly:,.2f} per month", delta_color="off")
            st.caption(line.replace("$", r"\$"))
            if regional_countries:
                st.caption(f"Regional: \\${monthly * 12 * regional_percent / 100:,.2f} per year")

st.divider()
text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
saved = DATA.read_text(encoding="utf-8")
changed = json.loads(saved) != data

save_col, publish_col = st.columns(2)
with save_col:
    st.subheader("1. Save")
    st.caption("Saves on this PC only.")
    if st.button("Save", disabled=bool(errors) or not changed, type="primary"):
        DATA.write_text(text, encoding="utf-8")
        st.success("Saved.")
        st.rerun()
    if changed:
        st.warning("You have unsaved changes.")

with publish_col:
    st.subheader("2. Publish")
    st.caption("Sends the saved prices to the public website. They appear about a minute later.")
    pending = git("status", "--porcelain", "--", "data/pricing.json").stdout.strip()
    unpushed = git("rev-list", "--count", "@{u}..HEAD").stdout.strip() not in ("", "0")  # an earlier push didn't finish
    waiting = pending or unpushed
    confirm = st.checkbox("Yes, make these prices public", disabled=not waiting or changed)
    if st.button("Publish", disabled=not (waiting and confirm) or changed):
        result = git("add", "data/pricing.json")
        # A second click can find the commit already made, so only the push is left to do.
        if result.returncode == 0 and git("diff", "--cached", "--quiet", "--", "data/pricing.json").returncode != 0:
            result = git("commit", "-m", "Update pricing", "--", "data/pricing.json")
        if result.returncode == 0:
            result = git("push")
        if result.returncode != 0:
            st.error(result.stdout + result.stderr)
        else:
            st.success(f"Published. Check {LIVE} in about a minute.")
