# LDC Basis Tracker

A phone app (PWA) for one job: seeing how LDC Yorkton's offers for **canola** and **health canola (Nexera)** move over time. It shows the basis, the futures each bid is priced off, and the resulting cash price. LDC's website only shows today's numbers. This app keeps every day so you can look back.

- **Bids**: today's bids by delivery month on one phone screen. Each shows its futures contract, futures, basis and cash, the change since the previous saved day (0.00 when unchanged), and the date the basis last changed.
- **Plots**:
  - **All delivery months chart**: every month's basis on one timeline. Tap the month chips under the chart to colour up to 8 months; the rest can show in grey. Months LDC no longer posts fold away under **No longer posted**, by delivery year. Tap the chart title for its settings: Basis / Cash price / Futures, date range, months not picked in grey, and clear picked months. A month's line starts the day LDC first posts it and stops when LDC drops it.
  - **Health canola premium**: Nexera basis minus canola basis by month.
  - **One delivery month**: any month, including ones LDC no longer posts, with its own range: cash price against futures, basis, and every basis change. Tap any of its chart titles for the settings: date range, Lines or Bars (daily OHLC bars like Barchart), and with Lines, **Show daily low–high** to shade each day's range behind the line. Tapping a month on the Bids tab opens it here.

The top bar has the crop switch (Canola / Nexera) and a small $/MT ↔ $/bu button, which apply to every screen. Touch or drag across a chart to read its values; they stay up after you lift your finger. The full-screen button beside a chart title opens that chart on its own, filling the screen (× or Back closes it). On a landscape phone the charts fill the screen.

## How it fits together

```
 LDC website ──(every 15 min, weekdays 6:30-15:30 SK)──> GitHub Action ──> data/*.json in this repo
                                                                   │
 Phone app (GitHub Pages) <── reads ───────────────────────────────┘
```

LDC's site doesn't let other sites read its data, so a GitHub Action (`scripts/fetch_ldc.py --loop`) fetches it and commits it into `data/`. GitHub starts scheduled runs late or skips them when busy, so each run stays up and fetches every 15 minutes until 15:30 Saskatchewan time (handing over to the next run before GitHub's 6-hour job limit). It commits only when a price changed.

## Data files (`data/`)

| File | Contents |
|---|---|
| `latest.json` | Newest snapshot: canola and Nexera bids, canola futures. |
| `history/yorkton-<crop>.json` | `{"bids": {delivery: [row, ...]}, "changes": [{t, label, from, to, fut}, ...]}`. One row per day per delivery month: `{d, sym, f, b: [open, high, low, close], p: [open, high, low, close]}`, i.e. the futures contract and price at the last reading, and the day's range of basis (`b`) and cash price (`p`). `changes` logs every basis move with the time it was seen. |
| `history/yorkton-futures.json` | `{contract: [{d, o, h, l, c}]}`: the exchange's daily bars for canola futures (both crops price off these). |

Days before Oct 29, 2026 had one reading, so their open, high, low and close are the same. Older copies of the app wrote `cashbids-*`, `basischanges-*` and `futures-*` files; the fetcher converts them into the files above on its first run and deletes them, keeping every day.

## Replacing the old Grain Desk app on GitHub (keeps the history)

The history only exists in the GitHub repo's `data/` folder. LDC doesn't publish past prices, so it can't be fetched again.

1. In the existing repo, **delete the old app files**: `js/` (all of it, including `js/calc/`), `css/`, `google-apps-script/`, `index.html`, `sw.js`, `manifest.webmanifest`, `scripts/make_icons.ps1`. **Do not touch `data/`.**
2. Upload everything from this folder **except `data/`**: `index.html`, `sw.js`, `manifest.webmanifest`, `README.md`, `css/`, `js/`, `icons/`, `scripts/fetch_ldc.py`, `.github/workflows/fetch-ldc.yml`.
3. Go to **Actions → Fetch LDC prices → Run workflow** once, so the data is converted right away.
4. Open the app on the phone. The new `sw.js` replaces the old cached app automatically. If the old screens still show, close and reopen it.

To keep a backup: on GitHub, **Code → Download ZIP** now and then.

## Run locally
```
python scripts/fetch_ldc.py
python -m http.server 8766
```
Then open http://localhost:8766. The local `data/` folder is only a snapshot. The live history is on GitHub.

## Notes
- LDC prices are public web data delayed at least 10 minutes. Confirm with LDC before contracting.
- After changing app files, bump `VERSION` in `sw.js` so phones load the new version.
- New chart options go in the chart's `openSettings(...)` list (`js/monthschart.js`, `js/month.js`); the sheet itself is in `js/ui.js`.
- Add another LDC elevator: add it to `FACILITIES` in `scripts/fetch_ldc.py` (its id comes from `https://www.myldc.com/api/general/facility/public?shortcut=<name>`) and set `FACILITY` in `js/config.js`.
- The previous apps (Flask futures monitor, Grain Desk with calculators/inventory/sales) are kept in `../OLD/`.
