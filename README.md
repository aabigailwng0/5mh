# Skinalizer

**Treat your face like a market price.** One photo a day + your product log →
an explainable read on four skin spectrums, the ingredient "loads" driving them,
same-day product clashes, an AM/PM routine, and — once you've logged ~2 weeks —
a distributed-lag attribution of *what's actually moving your skin* (e.g. "dairy
at lag-2 pushes acne up").

The whole engine is **transparent by design**: every number traces back to a
labelled image feature or a documented coefficient. We deliberately chose
interpretable models over a black-box vision LLM.

---

## What's in the box

```
skinalizer/
├── backend/                      # Python engine + FastAPI (the core)
│   ├── skinalizer/
│   │   ├── engine.py             # SkinalizerEngine — the public façade
│   │   ├── config.py             # all tunable paths / knobs in one place
│   │   ├── models.py             # domain dataclasses (no web deps)
│   │   ├── scoring/              # explainable 4-axis skin scorer
│   │   │   ├── features.py       #   interpretable CV features (colour/texture)
│   │   │   ├── scorer.py         #   features -> spectrum, documented coefficients
│   │   │   └── classifier_backend.py  # OPTIONAL pretrained CNN (dermafyr/ACNE04)
│   │   ├── ingredients/          # ingredient intelligence
│   │   │   ├── knowledge_base.py #   INCI matching + curated properties
│   │   │   ├── interactions.py   #   well-established clash detection
│   │   │   └── scorer.py         #   comedogenic / irritant / interaction numbers
│   │   ├── products/             # product lookup
│   │   │   ├── catalog.py        #   Sephora sample loader (999 products w/ INCI)
│   │   │   ├── open_beauty_facts.py  # free barcode/name API (cached)
│   │   │   └── resolver.py       #   unified lookup (catalog -> OBF -> manual)
│   │   ├── recommendations/      # schedule + warnings + suggestions
│   │   ├── attribution/          # distributed-lag regression + linear SHAP
│   │   ├── storage/              # JSON daily-log store
│   │   ├── api/                  # FastAPI app + request schemas
│   │   └── data/                 # SEEDED knowledge bases + bundled Sephora CSV
│   └── tests/smoke_test.py       # end-to-end test on real ACNE04 photos
├── frontend/                     # React + Vite + Tailwind SPA
│   └── src/components/           # camera, product log, spectrum, panels
├── other-people-codes/           # reference repos (dermafyr, recommender)
└── startingplace-datasets/       # Sephora, ACNE04, SCIN
```

## The four spectrums

Each is a **0–100% position on a spectrum**, not a single grade:

| Axis | Meaning | Primary signals |
|------|---------|-----------------|
| `acne` | inflamed breakout activity | reddish raised-spot blob density |
| `redness` | flushing / inflammation | CIELab a* lift, red dominance |
| `hyperpigmentation` | dark spots & uneven tone | luminance spread, dark-spot share |
| `hydration` | dryness (0%) ↔ hydration (100%) | skin smoothness, healthy glow |

Then the user's **current products are factored in**: comedogenic load nudges
acne up, irritant load nudges redness up, beneficial actives pull their target
axis the good way. The adjustment is shown as a line item on each bar.

## The three ingredient numbers (kept separate on purpose)

- **`comedogenic_load`** — Σ comedogenic ratings (0–5) of matched ingredients → maps to acne
- **`irritant_load`** — Σ irritant / barrier-disruptor weights → maps to redness
- **`active_interaction_flag`** — true if a same-day active stack clashes

Keeping them separate means each can earn its own regression coefficient later.

---

## Install & run

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.10+ | backend engine + API |
| Node.js | 18+ | frontend (Vite) |
| npm | 9+ | ships with Node |

No database, no API keys, and no large dataset download are required — the
~8 MB Sephora product catalogue is **bundled inside the package**
(`backend/skinalizer/data/sephora_products.csv`), and product lookups fall back
to the free Open Beauty Facts API. The app is fully functional after a plain
`git clone`.

### Super-easy start — one command, any OS

```bash
git clone <your-fork-url> skinalizer
cd skinalizer
python run.py            # macOS / Linux / Windows — does EVERYTHING
```

That single command creates the backend virtualenv, installs all Python deps,
runs `npm install`, starts both servers, and opens the app in your browser.
First run takes a minute; after that it's instant. Press **Ctrl+C** to stop both.

Prefer to double-click? Use **`run.bat`** on Windows or **`./run.sh`** on
macOS/Linux — they just call `python run.py`.

Other modes:

```bash
python run.py setup      # install everything, don't start the servers
python run.py backend    # run only the API   (http://127.0.0.1:8000)
python run.py frontend   # run only the web UI (http://localhost:5173)
```

Then open <http://localhost:5173>, capture/upload a face photo, log a couple of
products, and hit **Analyze skin**.

### Manual setup (if you'd rather run the steps yourself)

**Backend:**

```bash
cd backend
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows (PowerShell):    .venv\Scripts\Activate.ps1
# Windows (cmd):           .venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn skinalizer.api.app:app --reload --port 8000
```

**Frontend (second terminal):**

```bash
cd frontend
npm install
npm run dev                            # dev server on :5173
# or: npm run build && npm run preview  # production build
```

### Environment variables (all optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SKINALIZER_SEPHORA_CSV` | bundled CSV | Point the catalogue at a different product CSV |
| `SKINALIZER_STORAGE` | `backend/storage_data` | Where the daily log + OBF cache + uploads live |
| `SKINALIZER_OFFLINE` | unset | Set to `1` to disable all network calls (offline demo) |
| `SKINALIZER_KERAS_MODEL` | unset | Path to a Keras model to enable the optional CNN backend |

### Smoke test (no frontend needed)

```bash
cd backend && source .venv/bin/activate
python -m tests.smoke_test     # full pipeline; uses ACNE04 photos if present,
                               # otherwise a synthetic face so it always runs
```

### Optional: plug in the pretrained CNN

The engine runs fully on explainable features alone. To *additionally* blend in
dermafyr's shipped MobileNetV2 model for the acne axis:

```bash
pip install tensorflow                 # see requirements.txt (commented out)
export SKINALIZER_KERAS_MODEL=/path/to/dermafyr/backend/model/tf_model.keras
./run.sh
```

(The backend reports `classifier_backend: true` in `/api/health` when active.)

### Optional: the full reference datasets

The large datasets (ACNE04 ≈335 MB, SCIN, full Sephora sample) are **not**
required to run the app and are git-ignored. To validate/fine-tune against them,
drop them under `startingplace-datasets/` (see paths in the master prompt) — the
smoke test will automatically pick up ACNE04 images if that folder is present.

### Troubleshooting

- **`uvicorn: command not found`** → activate the venv (`source backend/.venv/bin/activate`).
- **Frontend can't reach the API** → make sure the backend is up on :8000; the Vite dev server proxies `/api` there.
- **Webcam blocked** → use the "upload instead" link to pick a photo file.
- **`[SephoraCatalog] catalogue not found`** → harmless; search just uses Open Beauty Facts / manual entry until the CSV is restored.

---

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | liveness + capability report |
| GET | `/api/products/search?q=` | product autocomplete |
| POST | `/api/products/barcode` | barcode lookup (OBF → Sephora SKU) |
| POST | `/api/analyze` | photo + products → full analysis bundle |
| POST | `/api/log` | persist a day (photo optional) + analysis |
| GET | `/api/attribution?axis=` | driver decomposition (needs ≥10 days) |
| GET | `/api/history` | raw daily-entry history |

---

## What we reused vs. wrote

**Reused from the reference repos / datasets:**
- dermafyr's `react-webcam` capture pattern and tabbed-dashboard layout (rewired, no Electron/Auth0/MySQL)
- dermafyr's pretrained MobileNetV2 model — wired as an *optional* backend (with its preprocessing bug fixed)
- the **Sephora dataset** (999 products with INCI lists) as the product catalogue
- **ACNE04** photos as the validation/demo image set

**Wrote new (the scoring/attribution layer the repos didn't give us):**
- the explainable 4-axis feature scorer + transparent product-factoring
- the curated ingredient knowledge base, interaction table, and 3-number scorer
- the AM/PM schedule builder, interaction-warning service, and recommender
- the distributed-lag regression with closed-form linear SHAP attribution

## Design notes / extending

- **All coefficients are data, not code.** Scorer ranges/weights live in
  `scoring/scorer.py` as named constants; ingredient properties, interactions
  and routine rules live in `skinalizer/data/`. Tune without touching logic.
- **Swap the model** by implementing `ClassifierBackend` (two methods).
- **Add ingredients/interactions** by editing the CSVs in `skinalizer/data/`.
  Only seed *well-established* interactions — don't invent pairs.
- The attribution is intentionally **linear** — the coefficients are the
  user-facing product. As more data arrives, the documented product-factoring
  rules can be replaced by learned coefficients.

Not medical advice.
