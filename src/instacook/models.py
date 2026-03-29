from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class MealType(str, Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"


class Ingredient(BaseModel):
    name: str
    quantity: float = Field(gt=0)
    unit: str


class Recipe(BaseModel):
    id: str
    title: str
    description: str
    servings: int = Field(gt=0)
    meal_type: MealType
    ingredients: list[Ingredient]
    steps: list[str]


class RecipeQuery(BaseModel):
    query: str = Field(min_length=2)


class MenuPlanRequest(BaseModel):
    start_date: date
    days: int = Field(ge=1, le=31)
    meals_per_day: list[MealType] = Field(default_factory=lambda: [MealType.dinner])


class DailyPlan(BaseModel):
    date: date
    meals: dict[MealType, Recipe]


class MenuPlan(BaseModel):
    start_date: date
    days: int
    daily_plans: list[DailyPlan]


class IngredientSummaryItem(BaseModel):
    name: str
    quantity: float
    unit: str


class IngredientSummary(BaseModel):
    items: list[IngredientSummaryItem]


class InstacartExportRequest(BaseModel):
    items: list[IngredientSummaryItem]


class InstacartExportResponse(BaseModel):
    item_count: int
    cart_payload: list[dict[str, str | float]]
    checkout_url: str
