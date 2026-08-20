import { useMemo } from "react";
import { Sparkles, ShoppingCart, CheckCircle2, X, Calendar, ChefHat, AlertTriangle, Lightbulb } from "lucide-react";
import { useFamilyIntelligence } from "../hooks/useFamilyIntelligence";
import { useTaskToGrocery } from "../hooks/useFamilyIntelligence";
import { useCalendarToTask } from "../hooks/useFamilyIntelligence";
import { useMealToGrocery } from "../hooks/useFamilyIntelligence";
import { PrimaryButton, SecondaryButton } from "../components/ui";

const TYPE_CONFIG = {
  "calendar-to-task": {
    icon: Calendar,
    label: "Calendar → Task",
    color: "#8B5CF6",
    bg: "var(--color-chat-soft)",
    actionLabel: "Create Task",
  },
  "task-to-grocery": {
    icon: ShoppingCart,
    label: "Task → Shopping",
    color: "#14B8A6",
    bg: "var(--color-shopping-soft)",
    actionLabel: "Add to List",
  },
  "task-to-meal": {
    icon: ChefHat,
    label: "Task → Meal Plan",
    color: "#F59E0B",
    bg: "var(--color-meals-soft)",
    actionLabel: "Open Meal Planner",
  },
  "meal-to-grocery": {
    icon: ChefHat,
    label: "Meal → Shopping",
    color: "#E85D3A",
    bg: "var(--color-meals-soft)",
    actionLabel: "Add Ingredients",
  },
};

function SmartSuggestionCard({ suggestion, onAccept, onDismiss }) {
  const config = TYPE_CONFIG[suggestion.type] || {
    icon: Lightbulb,
    label: "Suggestion",
    color: "var(--color-accent)",
    bg: "var(--color-accent-soft)",
    actionLabel: "Accept",
  };
  const Icon = config.icon;

  return (
    <div
      className="smart-suggestion-card animate-fade-in-up"
      style={{
        borderLeftColor: config.color,
        background: config.bg,
      }}
    >
      <div className="smart-suggestion-header">
        <div className="smart-suggestion-type">
          <Icon size={14} style={{ color: config.color }} />
          <span style={{ color: config.color }}>{config.label}</span>
          <span className="smart-suggestion-confidence">
            {Math.round(suggestion.confidence * 100)}%
          </span>
        </div>
        <button
          className="smart-suggestion-dismiss"
          onClick={() => onDismiss(suggestion)}
          aria-label="Dismiss suggestion"
        >
          <X size={14} />
        </button>
      </div>

      <div className="smart-suggestion-content">
        {suggestion.sourceEventTitle && (
          <p className="smart-suggestion-source">
            <span className="smart-suggestion-source-label">From:</span>
            {suggestion.sourceEventTitle}
          </p>
        )}
        {suggestion.sourceTaskTitle && (
          <p className="smart-suggestion-source">
            <span className="smart-suggestion-source-label">From task:</span>
            {suggestion.sourceTaskTitle}
          </p>
        )}
        {suggestion.sourceMealTitle && (
          <p className="smart-suggestion-source">
            <span className="smart-suggestion-source-label">From meal:</span>
            {suggestion.sourceMealTitle}
          </p>
        )}

        {suggestion.suggestedTask && (
          <div className="smart-suggestion-preview">
            <strong>Creates task:</strong> {suggestion.suggestedTask.title}
            {suggestion.suggestedTask.due && (
              <span> · Due {suggestion.suggestedTask.due}</span>
            )}
          </div>
        )}

        {suggestion.suggestedGrocery && (
          <div className="smart-suggestion-preview">
            <strong>Adds to shopping:</strong> {suggestion.suggestedGrocery.name}
            {suggestion.suggestedGrocery.quantity && (
              <span> · {suggestion.suggestedGrocery.quantity} {suggestion.suggestedGrocery.unit}</span>
            )}
          </div>
        )}

        {suggestion.suggestedAction === "open-meal-planner" && (
          <div className="smart-suggestion-preview">
            <strong>Opens Meal Planner</strong> to plan this meal
          </div>
        )}
      </div>

      <div className="smart-suggestion-actions">
        <PrimaryButton
          size="sm"
          onClick={() => onAccept(suggestion)}
          className="smart-suggestion-accept"
          style={{ backgroundColor: config.color, borderColor: config.color }}
        >
          <CheckCircle2 size={13} /> {config.actionLabel}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function SmartSuggestionsPanel({ maxItems = 3, className = "", currentPage = "today" }) {
  const { suggestions, acceptSuggestion, dismissSuggestion, isAnalyzing } = useFamilyIntelligence(currentPage);
  const { createTaskFromEvent } = useCalendarToTask();
  const { addGroceryFromTask } = useTaskToGrocery();
  const { addGroceryFromMeal } = useMealToGrocery();

  const visibleSuggestions = useMemo(
    () => suggestions.slice(0, maxItems),
    [suggestions, maxItems]
  );

  if (visibleSuggestions.length === 0 && !isAnalyzing) return null;

  const handleAccept = (suggestion) => {
    switch (suggestion.type) {
      case "calendar-to-task":
        createTaskFromEvent(
          { id: suggestion.sourceEventId, title: suggestion.sourceEventTitle, start: suggestion.suggestedTask?.due },
          suggestion.suggestedTask
        ).then(() => acceptSuggestion(suggestion));
        break;
      case "task-to-grocery":
        addGroceryFromTask(
          { id: suggestion.sourceTaskId, title: suggestion.sourceTaskTitle },
          suggestion.suggestedGrocery
        ).then(() => acceptSuggestion(suggestion));
        break;
      case "task-to-meal":
        acceptSuggestion(suggestion);
        break;
      case "meal-to-grocery":
        addGroceryFromMeal(
          { id: suggestion.sourceMealId, title: suggestion.sourceMealTitle },
          suggestion.suggestedGrocery
        ).then(() => acceptSuggestion(suggestion));
        break;
      default:
        acceptSuggestion(suggestion);
    }
  };

  return (
    <section className={`smart-suggestions-panel ${className}`} aria-label="Smart suggestions">
      <div className="smart-suggestions-header">
        <div className="smart-suggestions-title">
          <Sparkles size={16} style={{ color: "var(--color-accent)" }} />
          <h3>Smart suggestions</h3>
        </div>
        {isAnalyzing && (
          <span className="smart-suggestions-analyzing">
            <span className="spinner" />
            Analyzing...
          </span>
        )}
      </div>

      <div className="smart-suggestions-list">
        {visibleSuggestions.map((suggestion) => (
          <SmartSuggestionCard
            key={`${suggestion.type}-${suggestion.sourceEventId || suggestion.sourceTaskId || suggestion.sourceMealId}`}
            suggestion={suggestion}
            onAccept={handleAccept}
            onDismiss={dismissSuggestion}
          />
        ))}
      </div>
    </section>
  );
}

export function SmartSuggestionBanner({ suggestion, onAccept, onDismiss }) {
  if (!suggestion) return null;

  const config = TYPE_CONFIG[suggestion.type] || TYPE_CONFIG["calendar-to-task"];
  const Icon = config.icon;

  return (
    <div
      className="smart-suggestion-banner animate-slide-in-right"
      style={{ borderLeftColor: config.color }}
    >
      <div className="smart-banner-content">
        <div className="smart-banner-icon" style={{ backgroundColor: config.color }}>
          <Icon size={16} color="white" />
        </div>
        <div className="smart-banner-text">
          <p className="smart-banner-label">{config.label}</p>
          <p className="smart-banner-message">
            {suggestion.suggestedTask?.title ||
              suggestion.suggestedGrocery?.name ||
              "Smart suggestion available"}
          </p>
        </div>
      </div>
      <div className="smart-banner-actions">
        <SecondaryButton size="sm" onClick={() => onDismiss(suggestion)}>
          Dismiss
        </SecondaryButton>
        <PrimaryButton
          size="sm"
          onClick={() => onAccept(suggestion)}
          style={{ backgroundColor: config.color, borderColor: config.color }}
        >
          {config.actionLabel}
        </PrimaryButton>
      </div>
    </div>
  );
}