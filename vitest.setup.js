// vitest.setup.js — runs before every vitest file. Imports jest-dom matchers
// (`toBeDisabled`, `toHaveFocus`, `toBeInTheDocument`, `toHaveTextContent`)
// so destructive-action contract tests can assert on rendered DOM without
// repeating the matcher registration per file. The "/vitest" path registers
// the matchers into vitest's expect API directly rather than the legacy
// Jest globals — keeps the imports scoped to the test scope.
import "@testing-library/jest-dom/vitest";
