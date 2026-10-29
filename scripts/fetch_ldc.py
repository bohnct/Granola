"""
Fetch LDC facility prices (cash bids + futures) and write them into data/.

Runs on GitHub Actions (see .github/workflows/fetch-ldc.yml) and can be run locally:
  python scripts/fetch_ldc.py           fetch once
  python scripts/fetch_ldc.py --loop    fetch every 15 min through the trading day,
                                        committing and pushing each change (used by the Action)

Uses only the Python standard library.

Output:
  data/latest.json                       newest snapshot (canola + nexera bids, canola futures)
  data/history/<fac>-<commodity>.json    {"bids": {delivery: [row, ...]}, "changes": [{t,label,from,to,fut}, ...]}
      row = {"d", "sym", "f", "b": [o,h,l,c], "p": [o,h,l,c]}  one per day: futures at the last
      reading, and the day's open/high/low/close of the basis and the cash price
  data/history/<fac>-futures.json        {contract: [{d,o,h,l,c}, ...]}  exchange daily OHLC
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Facilities to pull. Add more LDC facilities here (the id comes from
# https://www.myldc.com/api/general/facility/public?shortcut=<name>).
FACILITIES = [
    {"key": "yorkton", "name": "LDC Yorkton", "id": "6d08687b-e9ed-49aa-b83f-e88e5c27e151"},
]
COMMODITIES = ("canola", "nexera")   # cash bids kept; both price off canola futures
FUTURES = "canola"

API = "https://www.myldc.com/api/general/facility"
UA = "Mozilla/5.0 (grain-pwa price fetcher)"
# Saskatchewan time (no daylight saving) decides which trading day a price belongs to.
LOCAL_TZ = timezone(timedelta(hours=-6))
MONTH_CODES = {"Jan": "F", "Feb": "G", "Mar": "H", "Apr": "J", "May": "K", "Jun": "M",
               "Jul": "N", "Aug": "Q", "Sep": "U", "Oct": "V", "Nov": "X", "Dec": "Z"}
FUTURES_ROOTS = {"canola": "RS"}
HISTORY_KEEP_DAYS = 3650

# --loop: fetch every 15 minutes Mon-Fri from 6:30 to 15:30 Saskatchewan time.
# GitHub stops a job after 6 hours, so a loop hands over to the next scheduled run before that.
WINDOW = ((6, 30), (15, 30))
LOOP_EVERY = 15 * 60
LOOP_MAX = 5 * 3600 + 45 * 60

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
            key = slug(com.get("commodityName", "unknown"))
            if key not in COMMODITIES:
                continue
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
                cash_bids[key] = rows

    futures: dict[str, list] = {}
    for com in fut_raw:
        key = slug(com.get("commodityName", "unknown"))
        if key != FUTURES:
            continue
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


def compact(v) -> str:
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


def rows_per_line(v, ind: int = 0) -> str:
    """JSON with every list item on one line: small files and readable diffs on GitHub."""
    pad, inner = " " * ind, " " * (ind + 1)
    if isinstance(v, dict) and v:
        return "{\n" + ",\n".join(f"{inner}{compact(k)}: {rows_per_line(x, ind + 1)}" for k, x in v.items()) + f"\n{pad}}}"
    if isinstance(v, list) and v:
        return "[\n" + ",\n".join(inner + compact(x) for x in v) + f"\n{pad}]"
    return compact(v)


def write_if_changed(path: Path, data, text: str | None = None) -> bool:
    text = (text if text is not None else json.dumps(data, indent=1, ensure_ascii=False)) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def write_history(path: Path, data) -> bool:
    return write_if_changed(path, data, rows_per_line(data))


def upsert_day(series: list, row: dict) -> list:
    """Replace today's row (same 'd') or append; keep sorted and trimmed."""
    series = [r for r in series if r.get("d") != row["d"]] + [row]
    series.sort(key=lambda r: r["d"])
    return series[-HISTORY_KEEP_DAYS:]


def ohlc(prev: list | None, v):
    """Fold one reading into a day's [open, high, low, close]."""
    if v is None:
        return prev
    if not prev:
        return [v, v, v, v]
    return [prev[0], max(prev[1], v), min(prev[2], v), v]


def migrate(fac_key: str) -> list[str]:
    """One-time move from the old layout (cashbids-*, basischanges-*, futures-* per crop).
    Old days had a single reading, so open = high = low = close."""
    done = []
    fut_old = HIST / f"futures-{fac_key}-{FUTURES}.json"
    fut_new = HIST / f"{fac_key}-futures.json"
    if fut_old.exists():
        if not fut_new.exists():
            write_history(fut_new, read_json(fut_old, {}))
        fut_old.unlink()
        done.append(fut_new.name)
    for old in HIST.glob(f"futures-{fac_key}-*.json"):  # corn, soybeans, wheat: never used
        old.unlink()
        done.append(f"-{old.name}")
    futures = read_json(fut_new, {})

    def guess_sym(d, fut):
        # Before Oct 27, 2026 rows didn't record the contract: find the one that closed at that price.
        for sym, rows in futures.items():
            if any(r["d"] == d and r.get("c") is not None and abs(r["c"] - fut) < 0.05 for r in rows):
                return sym
        return None

    for com in COMMODITIES:
        bids_old = HIST / f"cashbids-{fac_key}-{com}.json"
        log_old = HIST / f"basischanges-{fac_key}-{com}.json"
        if not bids_old.exists() and not log_old.exists():
            continue
        new = HIST / f"{fac_key}-{com}.json"
        store = read_json(new, {"bids": {}, "changes": []})
        for label, rows in read_json(bids_old, {}).items():
            have = {r["d"] for r in store["bids"].get(label, [])}
            for r in rows:
                if r["d"] in have:
                    continue
                store["bids"][label] = upsert_day(store["bids"].get(label, []), {
                    "d": r["d"], "sym": r.get("sym") or (guess_sym(r["d"], r["fut"]) if r.get("fut") is not None else None),
                    "f": r.get("fut"), "b": ohlc(None, r.get("basis")), "p": ohlc(None, r.get("price")),
                })
            # Still unknown (a holiday, a price that didn't line up): a delivery month keeps
            # the same contract, so borrow it from the nearest day that has one.
            series = store["bids"].get(label, [])
            known = [r["sym"] for r in series if r["sym"]]
            for i, r in enumerate(series):
                if not r["sym"] and known:
                    r["sym"] = next((x["sym"] for x in series[i:] if x["sym"]), known[-1])
        seen = {(c["t"], c["label"]) for c in store["changes"]}
        store["changes"] += [c for c in read_json(log_old, []) if (c["t"], c["label"]) not in seen]
        store["changes"].sort(key=lambda c: c["t"])
        write_history(new, store)
        for old in (bids_old, log_old):
            old.unlink(missing_ok=True)
        done.append(new.name)
    return done


def update_history(fac_key: str, snap: dict) -> list[str]:
    changed = []
    path = HIST / f"{fac_key}-futures.json"
    hist = read_json(path, {})
    for r in snap["futures"].get(FUTURES, []):
        if r["last"] is None:
            continue
        key = r["symbol"] or r["month"]
        hist[key] = upsert_day(hist.get(key, []), {
            "d": local_date(r["time"]), "o": r["open"], "h": r["high"],
            "l": r["low"], "c": r["last"],
        })
    if write_history(path, hist):
        changed.append(path.name)

    now = datetime.now(timezone.utc).isoformat(timespec="minutes")
    today = datetime.now(LOCAL_TZ).date().isoformat()
    for com, rows in snap["cashBids"].items():
        path = HIST / f"{fac_key}-{com}.json"
        store = read_json(path, {"bids": {}, "changes": []})
        for r in rows:
            series = store["bids"].get(r["label"], [])
            last = series[-1] if series else None
            # The daily row only keeps open/high/low/close, so log every basis move as it happens.
            prev = last["b"][3] if last and last.get("b") else None
            if prev is not None and r["basis"] is not None and r["basis"] != prev:
                store["changes"].append({"t": now, "label": r["label"], "from": prev, "to": r["basis"], "fut": r["futures"]})
            day = last if last and last["d"] == today else {}
            store["bids"][r["label"]] = upsert_day(series, {
                "d": today, "sym": r["futuresSymbol"], "f": r["futures"],
                "b": ohlc(day.get("b"), r["basis"]), "p": ohlc(day.get("p"), r["price"]),
            })
        if write_history(path, store):
            changed.append(path.name)
    return changed


def run_once() -> int:
    migrated = []
    for fac in FACILITIES:
        migrated += migrate(fac["key"])

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
    if changed_prices and not errors:
        for key, snap in facilities.items():
            hist_changed += update_history(key, snap)

    stamp = datetime.now(LOCAL_TZ).strftime("%H:%M")
    print(f"{stamp} latest.json {'updated' if wrote else 'unchanged'}; history: {', '.join(hist_changed) or 'unchanged'}"
          + (f"; migrated: {', '.join(migrated)}" if migrated else ""))
    for e in errors:
        print("WARN", e)
    return 0


def git(*args: str) -> bool:
    return subprocess.run(["git", *args], cwd=ROOT).returncode == 0


def commit_and_push() -> None:
    git("add", "-A", "data")
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
        return
    git("commit", "-q", "-m", f"Update LDC prices {datetime.now(timezone.utc):%Y-%m-%dT%H:%MZ}")
    for _ in range(3):  # someone else may have pushed (an upload, another run)
        if git("pull", "-q", "--rebase") and git("push", "-q"):
            return
        time.sleep(10)
    print("WARN push failed; will retry with the next change")


def in_window(now: datetime | None = None) -> bool:
    now = now or datetime.now(LOCAL_TZ)
    return now.weekday() < 5 and WINDOW[0] <= (now.hour, now.minute) < WINDOW[1]


def loop(every: int) -> None:
    started = time.monotonic()
    while True:
        try:
            run_once()
            commit_and_push()
        except Exception as exc:  # one bad pass shouldn't end the day's fetching
            print("WARN", exc)
        if not in_window():
            print("Outside trading hours; done.")
            return
        # Sleep to the next quarter hour, so readings line up whenever the job started.
        wait = every - time.time() % every
        if time.monotonic() - started + wait > LOOP_MAX:
            print("Near GitHub's 6-hour job limit; the next scheduled run takes over.")
            return
        time.sleep(wait)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", action="store_true", help="fetch every 15 min during trading hours, committing each change")
    ap.add_argument("--interval", type=int, default=LOOP_EVERY, help="seconds between fetches with --loop (for testing)")
    args = ap.parse_args()
    if args.loop:
        loop(args.interval)
        return 0
    return run_once()


if __name__ == "__main__":
    sys.exit(main())
