"""End-to-end smoke test for the Skinalizer engine.

Runs the full pipeline against real ACNE04 sample photos (no network, no TF) and
prints a readable report so we can eyeball that every component is wired up.

Run:  python -m tests.smoke_test
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

from skinalizer import SkinalizerEngine
from skinalizer.config import EngineConfig

ACNE04 = (
    Path(__file__).resolve().parents[2]
    / "startingplace-datasets"
    / "kaggle-acne04"
    / "acne_1024"
    / "all_1024"
)


def _make_synthetic_face(seed: int) -> bytes:
    """Fallback when the ACNE04 dataset isn't present (lightweight clones)."""
    import io

    import numpy as np
    from PIL import Image

    rng = np.random.default_rng(seed)
    # A skin-toned tile with a little speckle so feature extraction has signal.
    base = np.array([200, 150, 120], dtype=np.float32)
    img = np.tile(base, (256, 256, 1))
    img += rng.normal(0, 12, img.shape)
    buf = io.BytesIO()
    Image.fromarray(np.clip(img, 0, 255).astype("uint8")).save(buf, format="JPEG")
    return buf.getvalue()


def _sample_image(severity_prefix: str) -> bytes:
    matches = sorted(ACNE04.glob(f"{severity_prefix}_*.jpg"))
    if not matches:
        # Dataset absent — fall back to a synthetic face so the test still runs.
        return _make_synthetic_face(hash(severity_prefix) % 1000)
    return matches[len(matches) // 2].read_bytes()


def main() -> None:
    # Use an isolated storage dir so repeated runs start clean.
    config = EngineConfig()
    config.storage_dir = Path(__file__).resolve().parent / "_smoke_storage"
    config.enable_open_beauty_facts = False  # keep the smoke test offline
    engine = SkinalizerEngine(config)

    print("=" * 70)
    print(f"Catalog products with ingredients : {len(engine.catalog)}")
    print(f"Known ingredients                 : {len(engine.knowledge_base.all_ingredients())}")
    print("=" * 70)

    # --- product resolution (manual + catalogue search) ---
    refs = [
        {"name": "Gentle Retinol Night Serum", "ingredients": "Aqua, Glycerin, Retinol, Tocopherol, Phenoxyethanol", "category": "serum"},
        {"name": "AHA Exfoliating Toner", "ingredients": "Water, Glycolic Acid, Aloe Barbadensis Leaf Juice, Fragrance", "category": "toner"},
        {"name": "Daily Moisturiser", "ingredients": "Aqua, Glycerin, Niacinamide, Hyaluronic Acid, Shea Butter, Dimethicone", "category": "moisturiser"},
    ]
    products = engine.resolve_products(refs)
    print(f"\nResolved {len(products)} products:")
    for p in products:
        print(f"  - {p.name} [{p.category}] ({len(p.raw_ingredients)} ingredients)")

    # --- full analysis on a moderate-acne photo ---
    image_bytes = _sample_image("levle2")
    result = engine.analyze(image_bytes, products)

    print("\n--- SKIN SPECTRUM (products factored in) ---")
    for axis, data in result["analysis"]["axes"].items():
        print(f"  {axis:18s} {data['value']:5.1f}%  ({data['label']})  {data['contributions']}")
    print("  source:", result["analysis"]["source"])

    print("\n--- INGREDIENT SCORE ---")
    isc = result["ingredient_score"]
    print(f"  comedogenic_load        : {isc['comedogenic_load']}")
    print(f"  irritant_load           : {isc['irritant_load']}")
    print(f"  active_interaction_flag : {isc['active_interaction_flag']}")
    print(f"  matched                 : {isc['matched_ingredients']}")

    print("\n--- INTERACTION WARNINGS ---")
    for w in result["warnings"]:
        print(f"  [{w['severity']}] {w['ingredient_a']} + {w['ingredient_b']}")
        print(f"      {w['problem']}")
        print(f"      products: {w['products_involved']}")

    print("\n--- AM ROUTINE ---")
    for step in result["schedule"]["am"]:
        print(f"  {step['order']}. {step['step_type']:11s} {step['product_name']}  ({step['note']})")
    print("--- PM ROUTINE ---")
    for step in result["schedule"]["pm"]:
        print(f"  {step['order']}. {step['step_type']:11s} {step['product_name']}  ({step['note']})")

    print("\n--- RECOMMENDATIONS ---")
    for rec in result["recommendations"]:
        print(f"  [{rec['kind']}] {rec['title']} — {rec['reason']}")

    # --- attribution: synthesise ~14 days so the regression has data ---
    print("\n--- ATTRIBUTION (synthetic 14-day history) ---")
    random.seed(7)
    start = date.today() - timedelta(days=14)
    for i in range(14):
        sev = random.choice(["levle0", "levle1", "levle2", "levle3"])
        day_products = products if i % 2 == 0 else products[:1]
        lifestyle = {
            "sleep_hours": round(random.uniform(5, 8.5), 1),
            "dairy_servings": random.randint(0, 3),
        }
        engine.log_day(start + timedelta(days=i), _sample_image(sev), day_products, lifestyle)

    attribution = engine.attribution("acne")
    print(json.dumps(attribution, indent=2))

    print("\nSMOKE TEST OK")


if __name__ == "__main__":
    main()
