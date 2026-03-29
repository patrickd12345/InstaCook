from datetime import date

from fastapi.testclient import TestClient

from instacook.main import app, service
from instacook.models import IngredientSummaryItem

client = TestClient(app)


def test_healthcheck() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_search_recipe_found() -> None:
    response = client.post("/recipes/search", json={"query": "curry"})
    assert response.status_code == 200
    assert response.json()[0]["title"] == "Chickpea Curry"


def test_menu_plan_duration() -> None:
    response = client.post(
        "/menu-plans",
        json={
            "start_date": str(date(2026, 3, 29)),
            "days": 7,
            "meals_per_day": ["breakfast", "dinner"],
        },
    )
    data = response.json()
    assert response.status_code == 200
    assert data["days"] == 7
    assert len(data["daily_plans"]) == 7


def test_instacart_url_generation() -> None:
    items = [
        IngredientSummaryItem(name="Garlic", quantity=2, unit="clove"),
        IngredientSummaryItem(name="Spinach", quantity=1, unit="bag"),
    ]
    url = service.instacart_checkout_url(items)
    assert "instacart.com" in url
    assert "Garlic" in url
