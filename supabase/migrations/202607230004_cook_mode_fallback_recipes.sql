-- Cook Mode fallback recipes — hand-picked full recipes FamOS returns when
-- the live recipe-search upstream (API Ninjas) is rate-limited, key-rotated, or
-- simply has no match for the meal title. Each row carries ingredients +
-- step-by-step instructions in the API Ninjas v3 response shape so the
-- recipe-search edge function can pipe them straight back to the front-end
-- without re-shaping on the client.
--
-- RLS: enabled with NO policies. The service_role key (used by edge
-- functions) bypasses RLS, so only `supabase functions invoke` can read
-- this table. anon / authenticated clients cannot — this is not a public
-- catalogue, only the last-resort cache for cook mode.
create table if not exists public.cook_mode_fallback_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  servings int not null default 4,
  ready_in_minutes int,
  source text not null default 'FamOS curated',
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cook_mode_fallback_recipes_title_idx
  on public.cook_mode_fallback_recipes (lower(title));

-- search_text: a generated text column that flattens title + ingredients
-- (cast from jsonb) + instructions into one lowercased token blob. Lets the
-- recipe-search edge function match a user's TYPED QUERY against any of
-- the three fields with a single ILIKE pattern, so a search for "chicken"
-- finds "Sheet-pan chicken fajitas" both via the title and via the
-- ingredient name "Chicken thighs (boneless, skinless)" inside the
-- ingredients::text blob. Generated column is STORED so the index covers
-- real rows, not source expressions, and Postgres keeps it in sync on
-- every INSERT/UPDATE.
alter table public.cook_mode_fallback_recipes
  add column if not exists search_text text generated always as (
    lower(title) || ' ' ||
    lower(coalesce(ingredients::text, '')) || ' ' ||
    lower(coalesce(instructions::text, ''))
  ) stored;

-- search_text is queried via infix ILIKE (`*term*`), which a btree
-- index cannot accelerate. For the current curated table of ~3 rows, a
-- seq scan is fast enough — drop the index entirely so the migration
-- doesn't quietly mislead future maintainers. When family-submitted
-- recipes land and the table grows past ~50 rows, swap this in for
-- `CREATE EXTENSION pg_trgm; CREATE INDEX ... USING gin (search_text
-- gin_trgm_ops)` at the same time.
drop index if exists cook_mode_fallback_recipes_search_idx;


alter table public.cook_mode_fallback_recipes enable row level security;

-- Hand-picked seed recipes. ~10 minutes of cooking time so cook mode's
-- default "35 min · serves 4" placeholder never shows up in place of these.
insert into public.cook_mode_fallback_recipes
  (slug, title, ingredients, instructions, servings, ready_in_minutes, source, source_url)
values
  (
    'sheet-pan-chicken-fajitas',
    'Sheet-pan chicken fajitas',
    '[
      {"name": "Chicken thighs (boneless, skinless)", "quantity": 1.5, "unit": "lb"},
      {"name": "Bell peppers (mixed colors)", "quantity": 3, "unit": ""},
      {"name": "Red onion", "quantity": 1, "unit": ""},
      {"name": "Fajita seasoning", "quantity": 2, "unit": "tbsp"},
      {"name": "Olive oil", "quantity": 2, "unit": "tbsp"},
      {"name": "Lime", "quantity": 1, "unit": ""},
      {"name": "Flour tortillas", "quantity": 8, "unit": ""},
      {"name": "Sour cream", "quantity": 0.5, "unit": "cup"},
      {"name": "Fresh cilantro", "quantity": 0.25, "unit": "cup"},
      {"name": "Avocado", "quantity": 1, "unit": ""}
    ]'::jsonb,
    '[
      "Heat the oven to 425F (220C) and line a large rimmed sheet pan with parchment.",
      "Slice the peppers and red onion into half-inch strips and trim the chicken thighs into one-inch pieces.",
      "Toss the chicken and vegetables on the sheet pan with olive oil and fajita seasoning until everything is evenly coated.",
      "Spread out in a single layer (use two pans if needed) and roast for 18 to 22 minutes, stirring halfway, until the chicken is cooked through and the edges of the vegetables are charred.",
      "Squeeze fresh lime over the hot sheet pan and scatter chopped cilantro on top.",
      "Warm the tortillas in a dry skillet for 30 seconds each, then serve with the roasted filling, sliced avocado, and sour cream."
    ]'::jsonb,
    4, 25, 'FamOS curated', 'https://fam-os.app/recipes/sheet-pan-chicken-fajitas'
  ),
  (
    'spaghetti-bolognese',
    'Spaghetti Bolognese',
    '[
      {"name": "Ground beef", "quantity": 1, "unit": "lb"},
      {"name": "Yellow onion (diced)", "quantity": 1, "unit": ""},
      {"name": "Carrot (diced)", "quantity": 1, "unit": ""},
      {"name": "Celery stalk (diced)", "quantity": 1, "unit": ""},
      {"name": "Garlic cloves (minced)", "quantity": 3, "unit": ""},
      {"name": "Crushed tomatoes", "quantity": 28, "unit": "oz"},
      {"name": "Tomato paste", "quantity": 2, "unit": "tbsp"},
      {"name": "Olive oil", "quantity": 2, "unit": "tbsp"},
      {"name": "Dried oregano", "quantity": 1, "unit": "tsp"},
      {"name": "Salt", "quantity": 1, "unit": "tsp"},
      {"name": "Black pepper", "quantity": 0.5, "unit": "tsp"},
      {"name": "Spaghetti", "quantity": 1, "unit": "lb"}
    ]'::jsonb,
    '[
      "Bring a large pot of salted water to a boil for the spaghetti.",
      "Heat olive oil in a heavy saucepan over medium heat and saute the onion, carrot, and celery for 6 to 8 minutes until softened.",
      "Add garlic and cook for 30 seconds, then crumble in the ground beef and brown for 8 minutes.",
      "Stir in the tomato paste and oregano and cook for 1 minute until fragrant.",
      "Pour in the crushed tomatoes, season with salt and pepper, and simmer uncovered for 25 minutes.",
      "Cook the spaghetti in the boiling water until al dente (about 9 minutes), drain, and toss with the sauce. Serve immediately."
    ]'::jsonb,
    4, 45, 'FamOS curated', 'https://fam-os.app/recipes/spaghetti-bolognese'
  ),
  (
    'one-pan-roasted-vegetables-and-chicken',
    'One-pan roasted vegetables and chicken',
    '[
      {"name": "Chicken breasts (boneless)", "quantity": 4, "unit": ""},
      {"name": "Baby potatoes (halved)", "quantity": 1, "unit": "lb"},
      {"name": "Broccoli florets", "quantity": 2, "unit": "cups"},
      {"name": "Cherry tomatoes", "quantity": 1, "unit": "cup"},
      {"name": "Olive oil", "quantity": 3, "unit": "tbsp"},
      {"name": "Garlic powder", "quantity": 1, "unit": "tsp"},
      {"name": "Paprika", "quantity": 1, "unit": "tsp"},
      {"name": "Salt", "quantity": 1.5, "unit": "tsp"},
      {"name": "Black pepper", "quantity": 0.5, "unit": "tsp"},
      {"name": "Lemon", "quantity": 1, "unit": ""}
    ]'::jsonb,
    '[
      "Heat the oven to 400F (205C) and line a large sheet pan with parchment.",
      "Toss the halved potatoes with 1 tablespoon olive oil, half the salt, and half the pepper. Roast for 15 minutes.",
      "Pat the chicken breasts dry, rub with the remaining olive oil, and season with garlic powder, paprika, and the rest of the salt and pepper.",
      "Push the potatoes to one side of the pan, add the chicken in the middle, and spread the broccoli and cherry tomatoes around the edges.",
      "Roast for another 22 minutes, until the chicken reaches 165F internally and the potatoes are golden.",
      "Squeeze fresh lemon over the pan and serve straight from the roasting tray."
    ]'::jsonb,
    4, 40, 'FamOS curated', 'https://fam-os.app/recipes/one-pan-roasted-vegetables-and-chicken'
  )
on conflict (slug) do nothing;
