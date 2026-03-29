# InstaCook

InstaCook is a lightweight FastAPI app that supports:

- Asking for recipes by keyword.
- Getting random recipe suggestions.
- Building menu plans for a period (1-31 days).
- Compiling a combined ingredient list across selected recipes.
- Exporting ingredient lists to an Instacart-ready checkout search URL.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
uvicorn instacook.main:app --reload
```

## API endpoints

- `GET /recipes`
- `POST /recipes/search`
- `GET /recipes/random?meal_type=dinner`
- `POST /menu-plans`
- `POST /ingredients/summary`
- `POST /integrations/instacart/export`

## Example menu planning request

```json
{
  "start_date": "2026-03-29",
  "days": 10,
  "meals_per_day": ["breakfast", "dinner"]
}
```
