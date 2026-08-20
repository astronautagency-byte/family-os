import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "../context/FamilyContext";
import {
  generateSmartSuggestions,
  recordUserFeedback,
  getSmartDefaults,
  loadIntelligenceState,
} from "../lib/intelligentEngine";

export function useFamilyIntelligence() {
  const { events, tasks, groceries, meals, items: kitchenInventory } = useFamily();
  const [suggestions, setSuggestions] = useState([]);
  const [patterns, setPatterns] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = useCallback(() => {
    setIsAnalyzing(true);
    try {
      const result = generateSmartSuggestions({
        events,
        tasks,
        groceries,
        meals,
        kitchenInventory,
      });
      setSuggestions(result.suggestions);
      setPatterns(result.patterns);
    } finally {
      setIsAnalyzing(false);
    }
  }, [events, tasks, groceries, meals, kitchenInventory]);

  useEffect(() => {
    const timer = setTimeout(analyze, 500);
    return () => clearTimeout(timer);
  }, [analyze]);

  const acceptSuggestion = useCallback(
    (suggestion, onAccept) => {
      recordUserFeedback(`${suggestion.type}-${suggestion.sourceEventId || suggestion.sourceTaskId || suggestion.sourceMealId}`, true);
      onAccept?.(suggestion);
      setSuggestions((prev) => prev.filter((s) => s !== suggestion));
    },
    []
  );

  const dismissSuggestion = useCallback((suggestion) => {
    recordUserFeedback(`${suggestion.type}-${suggestion.sourceEventId || suggestion.sourceTaskId || suggestion.sourceMealId}`, false);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  }, []);

  const smartDefaults = useMemo(() => getSmartDefaults(), [patterns]);

  return {
    suggestions,
    patterns,
    smartDefaults,
    isAnalyzing,
    analyze,
    acceptSuggestion,
    dismissSuggestion,
  };
}

export function useCalendarToTask() {
  const { addTask } = useFamily();
  const { acceptSuggestion } = useFamilyIntelligence();

  const createTaskFromEvent = useCallback(
    async (event, customTask) => {
      const task = {
        title: customTask?.title || `Prepare for ${event.title}`,
        notes: customTask?.notes || `Related to calendar event: ${event.title} on ${event.start}`,
        taskType: customTask?.taskType || "home",
        due: customTask?.due || event.start?.split("T")[0],
        assigneeIds: customTask?.assigneeIds || event.memberIds || [],
      };
      await addTask(task);
      return task;
    },
    [addTask]
  );

  return { createTaskFromEvent };
}

export function useTaskToGrocery() {
  const { addGrocery } = useFamily();
  const { acceptSuggestion } = useFamilyIntelligence();

  const addGroceryFromTask = useCallback(
    async (task, groceryItem) => {
      const item = {
        name: groceryItem.name,
        quantity: groceryItem.quantity || 1,
        unit: groceryItem.unit || "",
        category: groceryItem.category,
        listId: groceryItem.listId,
      };
      await addGrocery(item);
      return item;
    },
    [addGrocery]
  );

  const addGroceriesFromTask = useCallback(
    async (task, groceryItems) => {
      const results = [];
      for (const item of groceryItems) {
        const result = await addGroceryFromTask(task, item);
        results.push(result);
      }
      return results;
    },
    [addGroceryFromTask]
  );

  return { addGroceryFromTask, addGroceriesFromTask };
}

export function useMealToGrocery() {
  const { addGrocery } = useFamily();
  const { acceptSuggestion } = useFamilyIntelligence();

  const addGroceryFromMeal = useCallback(
    async (meal, ingredient) => {
      const item = {
        name: ingredient.name,
        quantity: ingredient.quantity || 1,
        unit: ingredient.unit || "",
        category: ingredient.category,
      };
      await addGrocery(item);
      return item;
    },
    [addGrocery]
  );

  const addAllMealIngredients = useCallback(
    async (meal) => {
      if (!meal.ingredients) return [];
      const results = [];
      for (const ingredient of meal.ingredients) {
        const result = await addGroceryFromMeal(meal, ingredient);
        results.push(result);
      }
      return results;
    },
    [addGroceryFromMeal]
  );

  return { addGroceryFromMeal, addAllMealIngredients };
}