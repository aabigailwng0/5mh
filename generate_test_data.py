#!/usr/bin/env python
"""Generate 10 test daily log entries for attribution testing."""

import json
from pathlib import Path
from datetime import date, timedelta

# Template entry with realistic but varied data
def make_entry(day_offset, acne_base=40, redness_base=35, pigment_base=30, hydrate_base=65):
    """Create a test entry with slightly varying metrics day-to-day."""
    entry_date = (date(2026, 5, 21) + timedelta(days=day_offset)).isoformat()
    
    # Simulate some variation based on products used
    acne = acne_base + (day_offset % 3) * 5 + (day_offset // 2) * 2
    redness = redness_base + (day_offset % 2) * 8 - (day_offset // 3) * 3
    pigment = pigment_base + (day_offset % 4) * 3
    hydrate = hydrate_base - (day_offset % 3) * 5 + (day_offset // 2) * 2
    
    # Clamp to 0-100
    acne = max(0, min(100, acne))
    redness = max(0, min(100, redness))
    pigment = max(0, min(100, pigment))
    hydrate = max(0, min(100, hydrate))
    
    # Ingredient loads correlate with acne
    comedogenic = 2.0 + (acne / 50) * 3  # Higher acne = higher comedogenic
    irritant = 1.5 + (redness / 50) * 2  # Higher redness = higher irritant
    
    # Interactions on some days
    has_clash = (day_offset % 3 == 0)
    
    return {
        "entry_date": entry_date,
        "photo_path": "",
        "product_names": [
            "Cleanser",
            "Toner",
            "Serum",
            "Moisturizer"
        ],
        "analysis": {
            "source": "features",
            "notes": ["Test data generated for attribution testing"],
            "axes": {
                "redness": {
                    "axis": "redness",
                    "value": round(redness, 1),
                    "label": "mild" if redness < 40 else "moderate" if redness < 70 else "severe",
                    "contributions": {
                        "redness_a* (skin)": round(redness * 0.6, 1),
                        "red dominance (R-G)": round(redness * 0.4, 1),
                    },
                    "explanation": "Higher = more visible flushing / inflammation across skin."
                },
                "hyperpigmentation": {
                    "axis": "hyperpigmentation",
                    "value": round(pigment, 1),
                    "label": "mild" if pigment < 40 else "moderate" if pigment < 70 else "severe",
                    "contributions": {
                        "tone unevenness": round(pigment * 0.6, 1),
                        "dark-spot coverage": round(pigment * 0.4, 1),
                    },
                    "explanation": "Higher = more uneven tone and dark spots."
                },
                "acne": {
                    "axis": "acne",
                    "value": round(acne, 1),
                    "label": "mild" if acne < 40 else "moderate" if acne < 70 else "severe",
                    "contributions": {
                        "inflamed-spot density": round(acne * 0.75, 1),
                        "local inflammation": round(acne * 0.25, 1),
                    },
                    "explanation": "Higher = more inflamed breakout activity."
                },
                "hydration": {
                    "axis": "hydration",
                    "value": round(hydrate, 1),
                    "label": "well hydrated" if hydrate > 70 else "normal" if hydrate > 40 else "dry",
                    "contributions": {
                        "smoothness (low roughness)": round(hydrate * 0.6, 1),
                        "healthy glow": round(hydrate * 0.4, 1),
                    },
                    "explanation": "0% = very dry / flaky, 100% = well hydrated and supple."
                }
            }
        },
        "ingredient_score": {
            "comedogenic_load": round(comedogenic, 2),
            "irritant_load": round(irritant, 2),
            "active_interaction_flag": has_clash,
            "matched_ingredients": ["Salicylic Acid", "Niacinamide", "Hyaluronic Acid", "Glycerin"],
            "unmatched_ingredients": [],
            "detail": {
                "per_ingredient": [
                    {"ingredient": "Salicylic Acid", "comedogenic": 0.0, "irritant": 1.5, "product": "Cleanser"},
                    {"ingredient": "Niacinamide", "comedogenic": 0.0, "irritant": 0.2, "product": "Serum"},
                    {"ingredient": "Hyaluronic Acid", "comedogenic": 0.0, "irritant": 0.0, "product": "Moisturizer"},
                ],
                "n_clashes": 1 if has_clash else 0
            }
        },
        "lifestyle": {
            "sleep_hours": 7 + (day_offset % 3) - 1,
            "stress_level": 3 + (day_offset % 5),
            "humidity": 45 + (day_offset % 20)
        }
    }

if __name__ == "__main__":
    # Generate 10 entries (days 0-9 from May 21-30, plus May 31 that already exists)
    entries = [make_entry(i) for i in range(10)]
    
    # Save to file
    log_path = Path("backend/storage_data/daily_log.json")
    log_path.write_text(json.dumps(entries, indent=2), encoding="utf-8")
    
    print(f"✅ Generated {len(entries)} test entries")
    print(f"Dates: {entries[0]['entry_date']} to {entries[-1]['entry_date']}")
    print(f"\nYou can now test attribution!")
    print(f"Run: curl http://localhost:8000/api/attribution?axis=acne")
