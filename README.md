# LDC Basis Tracker

A phone app (PWA) for one job: seeing how LDC Yorkton's offers for **canola** and **health canola (Nexera)** move over time. It shows the basis, the futures each bid is priced off, and the resulting cash price. LDC's website only shows today's numbers. This app keeps every day so you can look back.

- **Bids**: today's bids by delivery month. Each shows futures, basis and cash, the change since the previous saved day, and the date the basis last changed.
- **History**: one delivery month at a time, including months LDC no longer posts. Charts cash price against futures and plots basis on its own chart, with low/high/average basis, every basis change, and the full daily record.
- **Basis**:
  - **All delivery months chart**: every month's basis on one timeline. Tap chips to turn months on or off (up to 8 coloured at once; the rest can show in grey). Layers switch the chart between Basis, Cash price and Futures. A month's line starts the day LDC first posts it and stops when LDC drops it.
  - **Basis board**: basis now vs 1 week, 1 month and 3 months ago.
  - **Health canola premium**: Nexera basis minus canola basis by month.
  - **Recent basis changes**: both crops, newest first.

$/tonne or $/bushel can be picked on every screen.

## How it fits together

```
 LDC website ──(every 15 min, weekdays)──> GitHub Action ──> data/*.json in this repo
                                                                   │
 Phone app (GitHub Pages) <── reads ───────────────────────────────┘
```

LDC's site doesn't let other sites read its data, so a GitHub Action (`scripts/fetch_ldc.py`) fetches it on a schedule and commits it into `data/`.

## Data files (`data/history/`)

| File | Contents |
|---|---|
| `cashbids-yorkton-<crop>.json` | `{delivery: [{d, basis, fut, price, sym}]}`: one row per day per delivery month (last reading of the day). `sym` (the futures contract) is recorded from Oct 27, 2026 on. |
| `basischanges-yorkton-<crop>.json` | `[{t, label, from, to, fut}]`: every basis move, timestamped as the fetcher saw it, including several in one day. Starts Oct 27, 2026. Before that, the app works out changes from the daily rows. |
| `futures-yorkton-<crop>.json` | `{contract: [{d, o, h, l, c}]}`: daily futures OHLC. |

These are the same files the old Grain Desk app wrote, so all history it collected carries over unchanged.

## Replacing the old Grain Desk app on GitHub (keeps the history)

The history only exists in the GitHub repo's `data/` folder. LDC doesn't publish past prices, so it can't be fetched again.

1. In the existing repo, **delete the old app files**: `js/` (all of it, including `js/calc/`), `css/`, `google-apps-script/`, `index.html`, `sw.js`, `manifest.webmanifest`, `scripts/make_icons.ps1`. **Do not touch `data/`.**
2. Upload everything from this folder **except `data/`**: `index.html`, `sw.js`, `manifest.webmanifest`, `README.md`, `css/`, `js/`, `icons/`, `scripts/fetch_ldc.py`, `.github/workflows/fetch-ldc.yml`.
3. Open the app on the phone. The new `sw.js` replaces the old cached app automatically. If the old screens still show, close and reopen it.

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
- Add another LDC elevator: add it to `FACILITIES` in `scripts/fetch_ldc.py` (its id comes from `https://www.myldc.com/api/general/facility/public?shortcut=<name>`) and set `FACILITY` in `js/config.js`.
- The previous apps (Flask futures monitor, Grain Desk with calculators/inventory/sales) are kept in `../OLD/`.
