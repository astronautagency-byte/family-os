# FamOS app design system

FamOS is a calm family planner. The interface should help someone find the next action at a glance, using clear groups, generous space and familiar controls. Use colour sparingly as a cue and keep existing family illustrations and the household's chosen accent.

## Foundations

- Use the shared sans-serif stack for headings, controls and body text. Page titles are prominent; section titles and secondary details are smaller and quieter.
- Use the family-selected accent for primary actions and selected navigation. Module colour signals context: calendar blue, tasks rose, meals gold, shopping and kitchen mint, and chat lilac. Use their paired `--color-*-soft` and `--color-*-strong` tokens; never rely on colour alone for meaning.
- Use `--color-surface`, `--color-ink`, borders and semantic status tokens so light, dark and custom colour schemes remain legible.
- Cards use a 22px radius, controls 14px and tabs share the same radius in selected and unselected states. Page gutters are 24px on desktop and 16px on phones. Touch controls should be at least 44px high, with 48px as the standard button height.
- Text fields are at least 16px on phones to avoid iOS focus zoom. Preserve zoom accessibility and visible keyboard focus.

## Components and surfaces

Use the shared components in `src/components/ui.jsx` and shared styles in `src/theme/app-design-system.css` and `src/theme/app-simple.css`. A page header names the task and shows its main action; secondary actions move into a clearly labeled menu. Group related rows rather than nesting cards within cards. Empty states describe what can be done next. Destructive actions remain visibly distinct and retain their confirmations.

Home starts with concise, live household information. Calendar emphasizes dates and events, Tasks makes ownership and completion clear, Meals organizes the day, Shopping keeps list controls reachable, and Chat keeps channel selection and its composer clear. Settings remains available and household page preferences are respected. Children see only the household-enabled destinations permitted for their role.

## Motion and accessibility

Motion should acknowledge an action, not distract from it. Keep transitions short, and disable decorative transitions for reduced-motion preferences. Support keyboard focus, screen-reader names, dark mode, long names, narrow screens, empty/loading/error states and device safe areas. Visual appearance alone does not establish device or accessibility compliance; verify rendered states and interactions.
