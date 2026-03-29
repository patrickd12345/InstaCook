from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .models import (
    IngredientSummary,
    InstacartExportRequest,
    InstacartExportResponse,
    MealType,
    MenuPlan,
    MenuPlanRequest,
    Recipe,
    RecipeQuery,
)
from .service import RecipeService

app = FastAPI(title="InstaCook API", version="0.1.0")
service = RecipeService()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/recipes", response_model=list[Recipe])
def get_recipes() -> list[Recipe]:
    return service.list_recipes()


@app.post("/recipes/search", response_model=list[Recipe])
def search_recipe(payload: RecipeQuery) -> list[Recipe]:
    recipes = service.find_recipe(payload.query)
    if not recipes:
        raise HTTPException(status_code=404, detail="No recipes matched the query")
    return recipes


@app.get("/recipes/random", response_model=Recipe)
def random_recipe(meal_type: MealType | None = None) -> Recipe:
    return service.random_recipe(meal_type)


@app.post("/menu-plans", response_model=MenuPlan)
def create_menu_plan(payload: MenuPlanRequest) -> MenuPlan:
    return service.build_menu_plan(payload)


@app.post("/ingredients/summary", response_model=IngredientSummary)
def summarize_ingredients(recipes: list[Recipe]) -> IngredientSummary:
    return service.summarize_ingredients(recipes)


@app.post("/integrations/instacart/export", response_model=InstacartExportResponse)
def export_instacart(payload: InstacartExportRequest) -> InstacartExportResponse:
    cart_payload = [{"name": i.name, "quantity": i.quantity, "unit": i.unit} for i in payload.items]
    return InstacartExportResponse(
        item_count=len(payload.items),
        cart_payload=cart_payload,
        checkout_url=service.instacart_checkout_url(payload.items),
    )
