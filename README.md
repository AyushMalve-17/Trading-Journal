# Trading Journal (Beginner-Friendly)

Modern, responsive trading journal web app (dark/light themes) built with **HTML/CSS/JavaScript**.

Features: dashboard, add trade, trade history CRUD, statistics charts, CSV + JSON backup/restore, PDF export (A4), localStorage persistence, autosave, notifications.

## Run
1. Open `index.html` in a browser.
   - Recommended: run a local static server (to avoid any browser restrictions).

### Option A: VSCode Live Server
- Install **Live Server** extension.
- Right-click `index.html` → **Open with Live Server**.

### Option B: Simple server (Python)
```bash
python -m http.server 8080
```
Then open: `http://localhost:8080`.

## Tech
- Chart.js (charts)
- jsPDF + html2canvas (PDF export)

## Data storage
- Default: `localStorage`
- Code is structured so swapping in Firebase/Supabase later can be done by replacing the `dataStore` module.

