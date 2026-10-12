# Bohn AgVentures (Grain Desk)

An iPhone home-screen app (PWA) for grain marketing:

- **Offers**: LDC Yorkton cash bids for Canola and Nexera by delivery month ($/MT and $/bu), with daily history.
- **Futures**: ICE canola, soybean and corn futures from LDC's feed (10-min delay), with daily closes saved from launch day.
- **Inventory**: production, sales targets, price targets, sold vs unsold, income, and unsold value at today's LDC bid.
- **Sales**: record every sale (bu or MT, $/bu or $/MT, contract #, delivery month). Stored in **your Google Sheet**.
- **Calc**: bu↔tonnes, $/bu↔$/MT, cash = futures + basis, truck load value after dockage, bin value, yield.

## How it fits together

```
 LDC website ──(every 15 min)──> GitHub Action ──> data/*.json in this repo
                                                         │
 iPhone app (GitHub Pages) <── reads prices ─────────────┘
      │
      └── reads/writes inventory & sales ──> Google Apps Script ──> your Google Sheet
```

- The phone can't read LDC directly (LDC's site doesn't allow other sites to load its data), so a GitHub Action fetches it on a schedule and saves it into `data/`.
- Inventory and sales are saved on the phone first, then uploaded to the Google Sheet whenever there's a connection.

## File guide

| Path | What it does |
|---|---|
| `index.html`, `css/app.css` | App layout and styling |
| `js/config.js` | **Edit to expand**: commodities, bushel weights, which crops appear in Inventory |
| `js/offers.js`, `futures.js`, `inventory.js`, `sales.js`, `calc.js` | One file per tab |
| `js/units.js`, `ledger.js` | Conversions and inventory/sales math |
| `js/sheets.js`, `google-apps-script/Code.gs` | Google Sheet sync (app side / Google side) |
| `js/data.js`, `chart.js` | Load price data, draw history charts |
| `sw.js`, `manifest.webmanifest`, `icons/` | Make it installable and work offline |
| `scripts/fetch_ldc.py` | Fetches LDC prices (run by GitHub) |
| `.github/workflows/fetch-ldc.yml` | Schedule for the fetcher |
| `data/` | Price data. Written only by the fetcher |

## Setup

### 1. GitHub (hosting + price fetcher)
1. Create a **public** repository on GitHub (e.g. `grain-desk`). Free GitHub Pages needs a public repo. Only LDC prices are stored there; your sales are not.
2. Upload the contents of this `grain-pwa` folder to it.
3. Repo **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`. Your app URL will be `https://<username>.github.io/<repo>/`.
4. Repo **Settings → Actions → General → Workflow permissions**: choose *Read and write permissions*.
5. **Actions** tab → *Fetch LDC prices* → **Run workflow** to fetch prices right away. After that it runs every 15 minutes on weekdays.

### 2. Google Sheet (inventory + sales)
1. Create a new Google Sheet (e.g. "Grain Desk").
2. **Extensions → Apps Script**. Replace the code with `google-apps-script/Code.gs` and save.
3. **Project Settings (⚙) → Script properties → Add**: name `TOKEN`, value = a long secret passphrase you make up.
4. In the editor, choose the `setup` function and press **Run**. Approve the permissions. This creates the *CropYears*, *Targets* and *Sales* tabs.
5. **Deploy → New deployment →** type *Web app*. Set *Execute as*: **Me** and *Who has access*: **Anyone**. Deploy and copy the **Web app URL**.
   - "Anyone" means anyone with the URL can reach the script, but it refuses every request without your TOKEN.
   - If you ever change the script: **Deploy → Manage deployments → Edit → Version: New version**. This keeps the same URL.

### 3. iPhone
1. Open the GitHub Pages URL in **Safari** → Share → **Add to Home Screen**.
2. Open the app **from the home-screen icon** → ⚙ Settings → paste the Web app URL and your TOKEN → **Save & connect**.
3. Always use the home-screen icon. Safari tabs keep separate storage.

## Notes
- The Sheet is the master copy. You can view, sort or chart it in Google Sheets. Edits made in the Sheet show up in the app after a refresh. Keep the `id` column intact. You can add your own columns to the right; the app keeps them.
- Futures/bid history starts the day the GitHub Action first runs (LDC doesn't publish past prices).
- LDC prices are public web data delayed at least 10 minutes. Confirm with LDC before contracting.
- After changing app files, bump `VERSION` in `sw.js` so phones load the new version.
- Add another LDC elevator: add it to `FACILITIES` in `scripts/fetch_ldc.py` (its id comes from `https://www.myldc.com/api/general/facility/public?shortcut=<name>`) and to `js/config.js`.

## Run locally
```
python scripts/fetch_ldc.py
python -m http.server 8765
```
Then open http://localhost:8765.
