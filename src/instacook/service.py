from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from random import Random
from urllib.parse import quote

from .models import (
    DailyPlan,
    Ingredient,
    IngredientSummary,
    IngredientSummaryItem,
    MealType,
    MenuPlan,
    MenuPlanRequest,
    Recipe,
)


class RecipeService:
    def __init__(self, random_seed: int = 42) -> None:
        self._rng = Random(random_seed)
        self._recipes = self._seed_recipes()

    def list_recipes(self) -> list[Recipe]:
        return self._recipes

    def random_recipe(self, meal_type: MealType | None = None) -> Recipe:
        choices = [r for r in self._recipes if meal_type is None or r.meal_type == meal_type]
        return self._rng.choice(choices)

    def find_recipe(self, query: str) -> list[Recipe]:
        normalized = query.lower()
        return [
            recipe
            for recipe in self._recipes
            if normalized in recipe.title.lower() or normalized in recipe.description.lower()
        ]

    def build_menu_plan(self, request: MenuPlanRequest) -> MenuPlan:
        plan: list[DailyPlan] = []
        for offset in range(request.days):
            day = request.start_date + timedelta(days=offset)
            meals: dict[MealType, Recipe] = {}
            for meal_type in request.meals_per_day:
                meals[meal_type] = self.random_recipe(meal_type)
            plan.append(DailyPlan(date=day, meals=meals))
        return MenuPlan(start_date=request.start_date, days=request.days, daily_plans=plan)

    def summarize_ingredients(self, recipes: list[Recipe]) -> IngredientSummary:
        grouped: dict[tuple[str, str], float] = defaultdict(float)
        for recipe in recipes:
            for ingredient in recipe.ingredients:
                grouped[(ingredient.name.lower(), ingredient.unit)] += ingredient.quantity

        items = [
            IngredientSummaryItem(name=name, quantity=round(quantity, 2), unit=unit)
            for (name, unit), quantity in sorted(grouped.items(), key=lambda x: x[0][0])
        ]
        return IngredientSummary(items=items)

    def instacart_checkout_url(self, items: list[IngredientSummaryItem]) -> str:
        query = ",".join(f"{item.quantity:g} {item.unit} {item.name}" for item in items)
        return f"https://www.instacart.com/store/search_v3/{quote(query)}"

    @staticmethod
    def _seed_recipes() -> list[Recipe]:
        return [
            Recipe(
                id="r1",
                title="Lemon Garlic Chicken Bowl",
                description="Protein-rich dinner bowl with roasted vegetables and quinoa.",
                servings=4,
                meal_type=MealType.dinner,
                ingredients=[
                    Ingredient(name="Chicken breast", quantity=1.5, unit="lb"),
                    Ingredient(name="Lemon", quantity=2, unit="unit"),
                    Ingredient(name="Garlic", quantity=4, unit="clove"),
                    Ingredient(name="Quinoa", quantity=1.5, unit="cup"),
                ],
                steps=["Season chicken", "Roast with garlic", "Cook quinoa", "Assemble bowls"],
            ),
            Recipe(
                id="r2",
                title="Creamy Overnight Oats",
                description="Make-ahead oats with chia and berries for quick breakfast.",
                servings=2,
                meal_type=MealType.breakfast,
                ingredients=[
                    Ingredient(name="Rolled oats", quantity=1, unit="cup"),
                    Ingredient(name="Greek yogurt", quantity=0.5, unit="cup"),
                    Ingredient(name="Blueberries", quantity=1, unit="cup"),
                ],
                steps=["Mix oats and yogurt", "Refrigerate overnight", "Top with berries"],
            ),
            Recipe(
                id="r3",
                title="Turkey Avocado Wrap",
                description="Quick lunch wrap for busy weekdays.",
                servings=2,
                meal_type=MealType.lunch,
                ingredients=[
                    Ingredient(name="Whole wheat tortilla", quantity=4, unit="unit"),
                    Ingredient(name="Turkey slices", quantity=0.75, unit="lb"),
                    Ingredient(name="Avocado", quantity=2, unit="unit"),
                ],
                steps=["Layer ingredients", "Roll tortilla", "Slice and serve"],
            ),
            Recipe(
                id="r4",
                title="Chickpea Curry",
                description="Budget-friendly vegetarian curry.",
                servings=4,
                meal_type=MealType.dinner,
                ingredients=[
                    Ingredient(name="Chickpeas", quantity=2, unit="can"),
                    Ingredient(name="Coconut milk", quantity=1, unit="can"),
                    Ingredient(name="Spinach", quantity=5, unit="oz"),
                ],
                steps=["Simmer chickpeas", "Add coconut milk", "Fold in spinach"],
            ),
        ]
