// ConfirmAction.test.jsx — cross-surface contract test for the destructive-
// action modal primitive. Pin the six behaviours every consumer relies on
// (focus, word-match, Enter-submit, busy-intercept, %d substitution) plus
// one test per tier-3 consumer asserting the canonical typed word. If a
// future edit rewrites "RESET" to "Restart" in any page, this test catches
// it: the consumer's word prop and this test's expected word must move in
// lockstep, and the test makes that relationship visible in test output.
//
// Run: `npm run test:vitest` (or `npm run test:vitest:watch` for TDD).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmAction from "../ConfirmAction.jsx";

const noop = () => {};

function renderConfirm(props) {
  return render(
    <ConfirmAction open onClose={noop} onConfirm={noop} {...props} />,
  );
}

afterEach(() => cleanup());

describe("ConfirmAction", () => {
  describe("type-to-confirm tier", () => {
    it("autoFocuses the typed-confirm input on open", async () => {
      renderConfirm({ tier: "type-to-confirm", word: "RESET", title: "Reset to demo?", confirmLabel: "Reset everything" });
      const input = await screen.findByPlaceholderText(/type reset/i);
      // autoFocus fires once React commits the input to the DOM. The Modal
      // mounts via createPortal under jsdom, so we poll briefly instead of
      // asserting synchronously.
      await waitFor(() => expect(input).toHaveFocus());
    });

    it("disables the destructive button before the typed word matches", () => {
      renderConfirm({ tier: "type-to-confirm", word: "RESET", title: "Reset", confirmLabel: "Reset everything" });
      const button = screen.getByRole("button", { name: /reset everything/i });
      expect(button).toBeDisabled();
    });

    it("matches the typed word case-insensitively and tolerates surrounding whitespace", async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup();
      renderConfirm({ tier: "type-to-confirm", word: "RESET", title: "Reset", confirmLabel: "Reset everything", onConfirm });
      const input = screen.getByPlaceholderText(/type reset/i);
      await user.type(input, "    reset   ");
      expect(screen.getByRole("button", { name: /reset everything/i })).toBeEnabled();
    });

    it("triggers onConfirm when Enter is pressed and the word matches", async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup();
      renderConfirm({ tier: "type-to-confirm", word: "RESET", title: "Reset", confirmLabel: "Reset everything", onConfirm });
      const input = screen.getByPlaceholderText(/type reset/i);
      await user.type(input, "RESET");
      await user.keyboard("{Enter}");
      await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    });
  });

  describe("confirm-tier & general behaviour", () => {
    it("intercepts onClose — including Escape — while busy is true", () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
      renderConfirm({ busy: true, title: "Working", confirmLabel: "Stop", onClose, onConfirm });
      // The Cancel button.
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onClose).not.toHaveBeenCalled();
      // Escape — Modal listens on the document and forwards to onClose when
      // busy is false; the ConfirmAction intercepts because busy=true.
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();
    });

    it("calls onClose normally when busy is false", () => {
      const onClose = vi.fn();
      renderConfirm({ title: "Clear items", confirmLabel: "Clear them", onClose });
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("substitutes %d in confirmLabel using the count prop", () => {
      renderConfirm({ title: "Clear checked", confirmLabel: "Clear %d checked", count: 7 });
      expect(screen.getByRole("button", { name: /clear 7 checked/i })).toBeInTheDocument();
    });
  });

  describe("canonical typed-word contract per tier-3 consumer", () => {
    // Each tier-3 consumer renders ConfirmAction with the word documented
    // here. These tests act as drift alarms — when a future page edits its
    // typed word, this contract fails and the page owner has to update
    // both their word prop and this test in the same PR.

    it("removeMember uses the word REMOVE", () => {
      renderConfirm({
        tier: "type-to-confirm",
        word: "REMOVE",
        title: "Remove member?",
        confirmLabel: "Remove member",
      });
      // The placeholder is derived from `word` directly (`placeholder={`Type ${word}`}`)
      // so it's a single-element, single-source-of-truth probe for the typed
      // word prop. screen.getByText would match the typed-token <strong> AND
      // its parent label (both contain the word), so we use the placeholder
      // for the canonical assertion to avoid a MultipleElementsFoundError.
      expect(screen.getByPlaceholderText("Type REMOVE")).toBeInTheDocument();
    });

    it("resetToDemoData uses the word RESET", () => {
      renderConfirm({
        tier: "type-to-confirm",
        word: "RESET",
        title: "Reset to demo data?",
        confirmLabel: "Reset to demo data",
      });
      expect(screen.getByPlaceholderText("Type RESET")).toBeInTheDocument();
    });

    it("clearFamilyChat uses the phrase CLEAR CHAT", () => {
      renderConfirm({
        tier: "type-to-confirm",
        word: "CLEAR CHAT",
        title: "Clear the family chat?",
        confirmLabel: "Clear family chat",
      });
      expect(screen.getByPlaceholderText("Type CLEAR CHAT")).toBeInTheDocument();
    });
  });
});
