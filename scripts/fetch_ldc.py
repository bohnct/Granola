"""
Fetch LDC facility prices (cash bids + futures) and write them into data/.

Runs on GitHub Actions on a schedule (see .github/workflows/fetch-ldc.yml),
and can be run locally:  python scripts/fetch_ldc.py

Uses only the Python standard library.

Output:
  data/latest.json                      newest snapshot of everything
  data/history/futures-<commodity>.json {contract: [{d,o,h,l,c}, ...]}  one row per day
  data/history/cashbids-<commodity>.json {delivery: [{d,basis,fut,price}, ...]}
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Facilities to pull. Add more LDC facilities here (the id comes from
# https://www.myldc.com/api/general/facility/public?shortcut=<name>).
FACILITIES = [
    {"key": "yorkton", "name": "LDC Yorkton", "id": "6d08687b-e9ed-49aa-b83f-e88e5c27e151"},
]

API = "https://www.myldc.com/api/general/facility"
UA = "Mozilla/5.0 (grain-pwa price fetcher)"
# Saskatchewan time (no daylight saving) decides which trading day a price belongs to.
LOCAL_TZ = timezone(timedelta(hours=-6))
MONTH_CODES = {"Jan": "F", "Feb": "G", "Mar": "H", "Apr": "J", "May": "K", "Jun": "M",
               "Jul": "N", "Aug": "Q", "Sep": "U", "Oct": "V", "Nov": "X", "Dec": "Z"}
FUTURES_ROOTS = {"canola": "RS", "soybeans": "ZS", "corn": "ZC", "wheat": "ZW"}
HISTORY_KEEP_DAYS = 3650

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
HIST = DATA / "history"


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def local_date(iso: str | None) -> str:
    if not iso:
        return datetime.now(LOCAL_TZ).date().isoformat()
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(LOCAL_TZ).date().isoformat()


def contract_symbol(commodity: str, month: str) -> str | None:
    """'Nov 26' -> 'RSX26'."""
    m = re.match(r"([A-Za-z]{3})\w*\s+(\d{2})", month or "")
    root = FUTURES_ROOTS.get(commodity)
    if not m or not root or m.group(1).title() not in MONTH_CODES:
        return None
    return f"{root}{MONTH_CODES[m.group(1).title()]}{m.group(2)}"


def fetch_facility(fac: dict) -> dict:
    bids_raw = get_json(f"{API}/client-cashbids/{fac['id']}")
    fut_raw = get_json(f"{API}/market-prices/{fac['id']}")

    cash_bids: dict[str, list] = {}
    for population in bids_raw:
        for com in population.get("cashBidCommodities", []):
            rows = []
            for b in com.get("cashBids", []):
                if not b.get("isPriceAvailable", True):
                    continue
                sym = (b.get("commoditySymbol") or "").lstrip("@") or None
                rows.append({
                    "label": b.get("label"),
                    "start": (b.get("startDate") or "")[:10],
                    "end": (b.get("endDate") or "")[:10],
                    "basis": b.get("basis"),
                    "futures": b.get("futuresPrice"),
                    "futuresSymbol": sym,
                    "price": b.get("price"),
                    "unit": b.get("unitOfMeasure"),
                    "currency": b.get("currency"),
                    "buPerUnit": b.get("mTtoBUConversionFactor"),
                })
            if rows:
                cash_bids[slug(com.get("commodityName", "unknown"))] = rows

    futures: dict[str, list] = {}
    for com in fut_raw:
        key = slug(com.get("commodityName", "unknown"))
        futures[key] = [{
            "month": p.get("month"),
            "symbol": contract_symbol(key, p.get("month")),
            "open": p.get("open"),
            "high": p.get("high"),
            "low": p.get("low"),
            "last": p.get("last"),
            "change": p.get("change"),
            "time": p.get("time"),
        } for p in com.get("marketPrices", [])]

    return {"name": fac["name"], "cashBids": cash_bids, "futures": futures}


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_if_changed(path: Path, data) -> bool:
    text = json.dumps(data, indent=1, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def upsert_day(series: list, row: dict) -> list:
    """Replace today's row (same 'd') or append; keep sorted and trimmed."""
    series = [r for r in series if r.get("d") != row["d"]] + [row]
    series.sort(key=lambda r: r["d"])
    return series[-HISTORY_KEEP_DAYS:]


def update_history(fac_key: str, snap: dict) -> list[str]:
    changed = []
    for com, rows in snap["futures"].items():
        path = HIST / f"futures-{fac_key}-{com}.json"
        hist = read_json(path, {})
        for r in rows:
            if r["last"] is None:
                continue
            key = r["symbol"] or r["month"]
            hist[key] = upsert_day(hist.get(key, []), {
                "d": local_date(r["time"]), "o": r["open"], "h": r["high"],
                "l": r["low"], "c": r["last"],
            })
        if write_if_changed(path, hist):
            changed.append(path.name)

    today = datetime.now(LOCAL_TZ).date().isoformat()
    for com, rows in snap["cashBids"].items():
        path = HIST / f"cashbids-{fac_key}-{com}.json"
        hist = read_json(path, {})
        for r in rows:
            hist[r["label"]] = upsert_day(hist.get(r["label"], []), {
                "d": today, "basis": r["basis"], "fut": r["futures"], "price": r["price"],
            })
        if write_if_changed(path, hist):
            changed.append(path.name)
    return changed


def main() -> int:
    latest_path = DATA / "latest.json"
    previous = read_json(latest_path, {})
    facilities = {}
    errors = []
    for fac in FACILITIES:
        try:
            facilities[fac["key"]] = fetch_facility(fac)
        except Exception as exc:  # keep the last good data for this facility
            errors.append(f"{fac['key']}: {exc}")
            if fac["key"] in previous.get("facilities", {}):
                facilities[fac["key"]] = previous["facilities"][fac["key"]]

    if not facilities:
        print("No data fetched:", *errors, sep="\n  ")
        return 1

    # Only bump the timestamp when prices actually changed, so quiet runs
    # don't create a commit.
    changed_prices = facilities != previous.get("facilities")
    latest = {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds") if changed_prices
        else previous.get("updatedAt"),
        "errors": errors,
        "facilities": facilities,
    }
    wrote = write_if_changed(latest_path, latest)

    hist_changed = []
    if changed_prices:
        for key, snap in facilities.items():
            hist_changed += update_history(key, snap)

    print(f"latest.json {'updated' if wrote else 'unchanged'}; history: {', '.join(hist_changed) or 'unchanged'}")
    for e in errors:
        print("WARN", e)
    return 0


if __name__ == "__main__":
    sys.exit(main())
