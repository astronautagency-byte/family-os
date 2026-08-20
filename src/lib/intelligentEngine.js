import { canonicalIngredientName } from "./mealIngredientCache";

const ENGINE_STORAGE_KEY = "famos:intelligence:v1";

export function loadIntelligenceState() {
  try {
    const raw = localStorage.getItem(ENGINE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not load intelligence state", e);
  }
  return {
    patterns: {},
    suggestions: {},
    lastAnalyzed: null,
    userFeedback: {},
  };
}

export function saveIntelligenceState(state) {
  try {
    localStorage.setItem(ENGINE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save intelligence state", e);
  }
}

export function analyzeCalendarForTasks(events, existingTasks) {
  const suggestions = [];
  const taskTitles = new Set(existingTasks.map((t) => t.title.toLowerCase()));

  for (const event of events) {
    if (!event.title) continue;

    const lowerTitle = event.title.toLowerCase();

    if (
      /party|celebration|birthday|anniversary|holiday|gathering|dinner|bbq|cookout/i.test(lowerTitle)
    ) {
      const taskTitle = `Prepare for ${event.title}`;
      if (!taskTitles.has(taskTitle.toLowerCase())) {
        suggestions.push({
          type: "calendar-to-task",
          sourceEventId: event.id,
          sourceEventTitle: event.title,
          suggestedTask: {
            title: taskTitle,
            notes: `Related to calendar event: ${event.title} on ${event.start}`,
            taskType: "home",
            due: event.start?.split("T")[0] || undefined,
          },
          confidence: 0.85,
        });
      }
    }

    if (
      /appointment|doctor|dentist|checkup|meeting|interview|deadline|due/i.test(lowerTitle)
    ) {
      const taskTitle = `Prepare for ${event.title}`;
      if (!taskTitles.has(taskTitle.toLowerCase())) {
        suggestions.push({
          type: "calendar-to-task",
          sourceEventId: event.id,
          sourceEventTitle: event.title,
          suggestedTask: {
            title: taskTitle,
            notes: `Related to calendar event: ${event.title}`,
            taskType: "home",
            due: event.start?.split("T")[0] || undefined,
          },
          confidence: 0.75,
        });
      }
    }

    if (
      /grocery|shopping|market|store|errand/i.test(lowerTitle)
    ) {
      const taskTitle = `Shopping for ${event.title}`;
      if (!taskTitles.has(taskTitle.toLowerCase())) {
        suggestions.push({
          type: "calendar-to-task",
          sourceEventId: event.id,
          sourceEventTitle: event.title,
          suggestedTask: {
            title: taskTitle,
            notes: `Related to calendar event: ${event.title}`,
            taskType: "shopping",
            due: event.start?.split("T")[0] || undefined,
          },
          confidence: 0.9,
        });
      }
    }
  }

  return suggestions;
}

export function analyzeTasksForGroceries(tasks, existingGroceries) {
  const suggestions = [];
  const groceryNames = new Set(existingGroceries.map((g) => g.name.toLowerCase()));

  for (const task of tasks) {
    if (!task.title) continue;

    const lowerTitle = task.title.toLowerCase();

    if (
      /shopping|grocery|buy|pick up|get|grab/i.test(lowerTitle) &&
      !task.done
    ) {
      const commonItems = [
        "milk", "bread", "eggs", "cheese", "yogurt", "butter",
        "chicken", "beef", "pork", "fish", "salmon",
        "apples", "bananas", "berries", "oranges", "grapes",
        "lettuce", "spinach", "tomatoes", "cucumber", "carrots", "broccoli",
        "rice", "pasta", "bread", "cereal", "oats",
        "coffee", "tea", "juice", "water",
        "snacks", "chips", "cookies", "chocolate",
      ];

      for (const item of commonItems) {
        if (!groceryNames.has(item) && Math.random() > 0.7) {
          suggestions.push({
            type: "task-to-grocery",
            sourceTaskId: task.id,
            sourceTaskTitle: task.title,
            suggestedGrocery: {
              name: item,
              quantity: 1,
              unit: "",
              category: categorizeGroceryItem(item),
            },
            confidence: 0.6,
          });
        }
      }
    }

    if (
      /cook|make|prepare|bake|dinner|lunch|breakfast|meal/i.test(lowerTitle) &&
      !task.done
    ) {
      suggestions.push({
        type: "task-to-meal",
        sourceTaskId: task.id,
        sourceTaskTitle: task.title,
        suggestedAction: "open-meal-planner",
        confidence: 0.7,
      });
    }
  }

  return suggestions;
}

export function analyzeMealsForGroceries(meals, existingGroceries, kitchenInventory) {
  const suggestions = [];
  const groceryNames = new Set(existingGroceries.map((g) => g.name.toLowerCase()));
  const inventoryNames = new Set(
    kitchenInventory.map((i) => i.name.toLowerCase())
  );

  for (const meal of meals) {
    if (!meal.title || !meal.ingredients) continue;

    for (const ingredient of meal.ingredients) {
      const canonical = canonicalIngredientName(ingredient.name || ingredient);
      const lowerCanonical = canonical.toLowerCase();

      if (!groceryNames.has(lowerCanonical) && !inventoryNames.has(lowerCanonical)) {
        suggestions.push({
          type: "meal-to-grocery",
          sourceMealId: meal.id,
          sourceMealTitle: meal.title,
          suggestedGrocery: {
            name: canonical,
            quantity: ingredient.quantity || 1,
            unit: ingredient.unit || "",
            category: categorizeGroceryItem(canonical),
          },
          confidence: 0.8,
        });
      }
    }
  }

  return suggestions;
}

export function analyzePatterns(events, tasks, groceries, meals) {
  const patterns = {
    weeklyGroceryDay: null,
    commonMealTimes: {},
    recurringTasks: [],
    frequentGroceryItems: {},
    eventTaskPatterns: {},
  };

  const groceryDays = {};
  for (const g of groceries) {
    if (g.addedAt) {
      const day = new Date(g.addedAt).getDay();
      groceryDays[day] = (groceryDays[day] || 0) + 1;
    }
  }
  let maxDay = 0;
  let maxCount = 0;
  for (const [day, count] of Object.entries(groceryDays)) {
    if (count > maxCount) {
      maxCount = count;
      maxDay = parseInt(day);
    }
  }
  if (maxCount > 3) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    patterns.weeklyGroceryDay = dayNames[maxDay];
  }

  for (const g of groceries) {
    if (g.name) {
      patterns.frequentGroceryItems[g.name] = (patterns.frequentGroceryItems[g.name] || 0) + 1;
    }
  }

  for (const task of tasks) {
    if (task.recurring && task.title) {
      patterns.recurringTasks.push({
        title: task.title,
        recurrence: task.recurring,
        count: tasks.filter((t) => t.title === task.title && t.done).length,
      });
    }
  }

  for (const event of events) {
    if (event.title) {
      const key = event.title.toLowerCase().slice(0, 30);
      patterns.eventTaskPatterns[key] = (patterns.eventTaskPatterns[key] || 0) + 1;
    }
  }

  return patterns;
}

export function generateSmartSuggestions(state) {
  const { events, tasks, groceries, meals, kitchenInventory } = state;
  const intelligence = loadIntelligenceState();

  const allSuggestions = [];

  const calendarTasks = analyzeCalendarForTasks(events || [], tasks || []);
  allSuggestions.push(...calendarTasks);

  const taskGroceries = analyzeTasksForGroceries(tasks || [], groceries || []);
  allSuggestions.push(...taskGroceries);

  const mealGroceries = analyzeMealsForGroceries(meals || [], groceries || [], kitchenInventory || []);
  allSuggestions.push(...mealGroceries);

  const patterns = analyzePatterns(events || [], tasks || [], groceries || [], meals || []);
  intelligence.patterns = patterns;

  allSuggestions.sort((a, b) => b.confidence - a.confidence);

  intelligence.suggestions = allSuggestions.slice(0, 10);
  intelligence.lastAnalyzed = new Date().toISOString();
  saveIntelligenceState(intelligence);

  return {
    suggestions: intelligence.suggestions,
    patterns: intelligence.patterns,
  };
}

export function categorizeGroceryItem(name) {
  const lower = name.toLowerCase();
  if (/milk|cheese|yogurt|butter|cream|dairy/i.test(lower)) return "Dairy & Eggs";
  if (/chicken|beef|pork|fish|salmon|meat|seafood|turkey|ham|bacon/i.test(lower)) return "Meat & Seafood";
  if (/apple|banana|berry|orange|grape|fruit|melon|pear|peach|plum|kiwi|mango/i.test(lower)) return "Produce";
  if (/lettuce|spinach|tomato|cucumber|carrot|broccoli|vegetable|onion|pepper|potato|garlic|ginger/i.test(lower)) return "Produce";
  if (/bread|pasta|rice|cereal|oats|flour|grain|bakery/i.test(lower)) return "Pantry";
  if (/coffee|tea|juice|water|soda|drink|beer|wine|alcohol/i.test(lower)) return "Beverages";
  if (/snack|chip|cookie|chocolate|candy|dessert|ice cream/i.test(lower)) return "Snacks";
  if (/clean|soap|detergent|paper|toilet|towel|tissue|trash/i.test(lower)) return "Household";
  return "Other";
}

export function recordUserFeedback(suggestionId, accepted) {
  const intelligence = loadIntelligenceState();
  intelligence.userFeedback[suggestionId] = {
    accepted,
    timestamp: new Date().toISOString(),
  };
  saveIntelligenceState(intelligence);
}

export function getSmartDefaults() {
  const intelligence = loadIntelligenceState();
  return {
    suggestedGroceryDay: intelligence.patterns?.weeklyGroceryDay,
    topGroceryItems: Object.entries(intelligence.patterns?.frequentGroceryItems || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name),
    recurringTaskTemplates: intelligence.patterns?.recurringTasks || [],
  };
}