# Adding the Kaggle Skincare Dataset

This project can now use the **Kaggle Skincare Products Clean Dataset** in addition to the bundled Sephora dataset to enhance product recommendations and search capabilities.

## Dataset Information

- **Source**: https://www.kaggle.com/datasets/eward96/skincare-products-clean-dataset
- **Size**: ~761 KB (1000+ skincare products)
- **Columns**: Product name, URL, type, ingredients, price
- **Key Feature**: Cleaned ingredient lists with standardized INCI names (water removed)

## Setup Instructions

### 1. Download the Dataset

1. Visit: https://www.kaggle.com/datasets/eward96/skincare-products-clean-dataset
2. Click the **Download** button (requires Kaggle account)
3. Extract the downloaded ZIP file

### 2. Place the CSV File

The extracted ZIP contains `skincare_products_clean.csv`. 

**Copy it to your project:**
```bash
# From the extracted download, copy to:
backend/skinalizer/data/skincare_products_clean.csv
```

### 3. Verify Installation

Start the backend and check the health endpoint:

```bash
cd backend
python run.py
```

Then in another terminal:
```bash
curl http://localhost:8000/api/health
```

You should see:
```json
{
  "status": "ok",
  "catalog_products": 1000,
  "kaggle_products": 1000,
  "ingredients_known": 350,
  "classifier_backend": false,
  "entries_logged": 0
}
```

The `kaggle_products` field will show the number of products loaded from the Kaggle dataset.

## What's Enabled

### Product Search
- When users search for products, results now come from:
  1. **Sephora Catalog** (~1000 products) - first priority
  2. **Kaggle Catalog** (~1000 products) - second priority
  3. **Open Beauty Facts** (API) - third priority

### Product Recommendations
- The recommender now suggests products from both catalogs based on:
  - Beneficial ingredients for the user's skin concerns
  - Product compatibility with current routine
  - Low irritant and comedogenic ratings

### Dropdown Menu
- Product selection dropdown now includes products from both sources
- Each product shows its source (`sephora` or `kaggle`)

## Data Fields

| Field | Sephora | Kaggle | Notes |
|-------|---------|--------|-------|
| Name | ✓ | ✓ | Product name |
| Brand | ✓ | ✗ | Left empty for Kaggle products |
| Product Type | ✗ | ✓ | Used to infer category |
| Ingredients | ✓ | ✓ | INCI list (water removed in Kaggle) |
| Price | ✓ | ✓ | Product price |
| Image | ✓ | ✗ | Not available in Kaggle |
| URL | ✓ | ✓ | Product page URL |

## Configuration

### Environment Variables

You can override the dataset paths using environment variables:

```bash
# Use a different Kaggle dataset location
export SKINALIZER_KAGGLE_CSV=/path/to/custom/dataset.csv

# Or via Python
python -c "import os; os.environ['SKINALIZER_KAGGLE_CSV']='/path/to/dataset.csv'; import backend.skinalizer"
```

### Optional: Disable Kaggle Dataset

If you want to use only the Sephora dataset, simply don't include the Kaggle CSV file. The system will continue working normally with just the Sephora catalog.

## Troubleshooting

### No Kaggle products showing

1. **Check file location**: Verify `backend/skinalizer/data/skincare_products_clean.csv` exists
2. **Check file format**: Ensure it's the actual CSV (not a shortcut or folder)
3. **Check logs**: Look for `[KaggleCatalog]` messages in backend output
4. **Verify health endpoint**: Check that `kaggle_products` count > 0

### "No module named kaggle_catalog"

Make sure you've updated to the latest backend code. The module should be at:
`backend/skinalizer/products/kaggle_catalog.py`

### Product search is slow

If search is noticeably slower:
1. Check that you're not loading duplicate products from both sources
2. Reduce the number of Open Beauty Facts API calls by setting `SKINALIZER_OFFLINE=1` for testing
3. The recommender may take longer to score more products - this is expected

## Integration Details

The integration maintains the existing API and data model:

- **Catalog**: A new `KaggleCatalog` class mirrors `SephoraCatalog`
- **Resolver**: `ProductResolver` now searches multiple catalogs in priority order
- **Recommender**: Scores products from all available catalogs
- **API**: No changes to endpoints - everything works automatically

All products get a `source` field ("sephora", "kaggle", or "manual") so the frontend can distinguish them if needed.

## Next Steps

- **Frontend**: You can display product source badges (e.g., "from Sephora" vs "from Kaggle dataset")
- **Analytics**: Track which sources users select most often
- **More Datasets**: Add additional sources by following the same pattern
