import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://recipeapi.io/api/v1";

const recipeFromPayload = (payload: any) => {
  let current = payload?.data || payload?.recipe || payload?.result || payload;
  const seen = new Set();
  while (current && typeof current === "object" && !Array.isArray(current) && current.data && !seen.has(current)) {
    seen.add(current);
    current = current.data;
  }
  return Array.isArray(current) ? current[0] || null : current;
};

const listFromPayload = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.recipes)) return payload.recipes;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const unique = (items: any[] = []) => [...new Set(items.map((item) => String(item || "").replace(/\s+/g, " ").trim()).filter(Boolean))];

const VALID_CUISINES = new Set(["american", "chinese", "french", "greek", "italian", "japanese", "mexican", "portuguese", "spanish", "thai", "turkish"]);
const VALID_MEAL_TYPES = new Set(["starter", "main", "dessert", "appetizer", "breakfast", "brunch", "snack", "side_dish", "soup", "drink", "sauce"]);

const recipeText = (recipe: any) => [
  recipe?.name,
  recipe?.title,
  recipe?.recipeName,
  recipe?.recipe_name,
  recipe?.description,
].filter(Boolean).join(" ").toLowerCase();

const normalizedIngredients = (ingredients: any[] = []) => unique(ingredients)
  .map((item) => item.replace(/\b\w/g, (letter) => letter.toUpperCase()))
  .slice(0, 6);

const searchVariantsFor = (query: string, canonicalQuery = "", alternateQueries: string[] = []) => {
  const clean = String(query || "")
    .replace(/\s+/g, " ")
    .trim();

  const variants = [
    canonicalQuery,
    clean,
    clean.replace(/\s*[+&]\s*/g, " ").trim(),
    clean.split(/\s*[+&]\s*|\s+with\s+/i)[0]?.trim(),
    ...alternateQueries,
  ];

  return unique(variants).slice(0, 5);
};

const scoreRecipe = (recipe: any, options: { queries: string[]; ingredients: string[]; cuisine?: string; mealType?: string }) => {
  const text = recipeText(recipe);
  const cuisine = String(recipe?.cuisine || "").toLowerCase();
  const mealType = String(recipe?.meal_type || recipe?.mealType || "").toLowerCase();
  const ingredientText = JSON.stringify(recipe?.ingredients || recipe?.ingredient_list || recipe?.components || "").toLowerCase();
  let score = 0;

  for (const query of options.queries) {
    const q = query.toLowerCase();
    if (q && text.includes(q)) score += 12;
    else if (q && q.split(" ").some((word) => word.length > 3 && text.includes(word))) score += 3;
  }

  for (const ingredient of options.ingredients) {
    const item = ingredient.toLowerCase();
    if (item && ingredientText.includes(item)) score += 2;
    else if (item && text.includes(item)) score += 1;
  }

  if (options.cuisine && cuisine === options.cuisine) score += 4;
  if (options.mealType && mealType === options.mealType) score += 4;
  return score;
};

const fetchJson = async (url: URL | string, recipeApiKey: string) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${recipeApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Recipe lookup failed with status ${response.status}`);
  }

  return response.json();
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const recipeApiKey = Deno.env.get("RECIPEAPI_KEY");
    if (!recipeApiKey) throw new Error("Recipe lookup is not configured yet.");

    const {
      query = "",
      canonicalQuery = "",
      alternateQueries = [],
      ingredients = [],
      cuisine = "",
      mealType = "",
      searchIn = "both",
      id = "",
    } = await request.json();

    if (id) {
      const detailPayload = await fetchJson(`${API_BASE}/recipes/${encodeURIComponent(id)}`, recipeApiKey);
      return new Response(JSON.stringify({ recipe: recipeFromPayload(detailPayload) }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const safeCuisine = VALID_CUISINES.has(String(cuisine).toLowerCase()) ? String(cuisine).toLowerCase() : "";
    const safeMealType = VALID_MEAL_TYPES.has(String(mealType).toLowerCase()) ? String(mealType).toLowerCase() : "";
    const safeSearchIn = ["name", "description", "both"].includes(searchIn) ? searchIn : "both";
    const cleanIngredients = normalizedIngredients(ingredients);
    const queries = searchVariantsFor(query, canonicalQuery, alternateQueries);

    const buildSearchUrl = (search = "", options: { withIngredients?: boolean; withCuisine?: boolean; withMealType?: boolean } = {}) => {
      const url = new URL(`${API_BASE}/recipes`);
      if (search) url.searchParams.set("search", search);
      url.searchParams.set("search_in", safeSearchIn);
      if (options.withIngredients && cleanIngredients.length) url.searchParams.set("ingredients", cleanIngredients.join(","));
      if (options.withCuisine && safeCuisine) url.searchParams.set("cuisine", safeCuisine);
      if (options.withMealType && safeMealType) url.searchParams.set("meal_type", safeMealType);
      url.searchParams.set("per_page", "8");
      return url;
    };

    let payload: any = null;
    let candidates: any[] = [];
    const searchPlan = [
      ...queries.map((search) => buildSearchUrl(search, { withIngredients: true, withCuisine: true, withMealType: true })),
      ...queries.map((search) => buildSearchUrl(search, { withIngredients: true, withCuisine: true })),
      ...queries.map((search) => buildSearchUrl(search, { withIngredients: true })),
      ...queries.map((search) => buildSearchUrl(search, {})),
      cleanIngredients.length ? buildSearchUrl("", { withIngredients: true, withCuisine: true, withMealType: true }) : null,
      cleanIngredients.length ? buildSearchUrl("", { withIngredients: true }) : null,
    ].filter(Boolean) as URL[];

    for (const url of searchPlan.length ? searchPlan : [buildSearchUrl(String(query || canonicalQuery || ""))]) {
      try {
        payload = await fetchJson(url, recipeApiKey);
        candidates = listFromPayload(payload);
        if (candidates.length) break;
      } catch (error) {
        console.warn("recipe-search candidate lookup failed", String(error));
      }
    }

    const rankedCandidates = [...candidates].sort((a, b) => scoreRecipe(b, { queries, ingredients: cleanIngredients, cuisine: safeCuisine, mealType: safeMealType }) - scoreRecipe(a, { queries, ingredients: cleanIngredients, cuisine: safeCuisine, mealType: safeMealType }));
    const firstRecipe = rankedCandidates[0] || null;
    const recipeId = firstRecipe?.id || firstRecipe?.recipeId || firstRecipe?.recipe_id;

    if (recipeId) {
      try {
        const detailPayload = await fetchJson(`${API_BASE}/recipes/${encodeURIComponent(recipeId)}`, recipeApiKey);
        return new Response(JSON.stringify({ recipe: recipeFromPayload(detailPayload), search: payload }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      } catch {
        // Search results are still useful; fall through and return the best match.
      }
    }

    return new Response(JSON.stringify({ recipe: firstRecipe, search: payload }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("recipe-search failed", error);
    return new Response(JSON.stringify({ error: "Recipe details are temporarily unavailable." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
