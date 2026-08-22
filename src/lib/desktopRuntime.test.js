import { describe, expect, it } from "vitest";
import {
  buildDesktopSignInUrl,
  getDesktopHandoffRequest,
  isSafeDesktopCallback,
  parseDesktopAuthUrl,
} from "./desktopRuntime";

describe("desktop authentication helpers", () => {
  it("builds a state-bound web sign-in URL", () => {
    const url = new URL(buildDesktopSignInUrl("state_1234567890"));
    expect(url.origin).toBe("https://home.fam-os.app");
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("desktop")).toBe("1");
    expect(url.searchParams.get("callback")).toBe("famos://auth/callback");
    expect(url.searchParams.get("state")).toBe("state_1234567890");
  });

  it("accepts only the FamOS callback scheme", () => {
    expect(isSafeDesktopCallback("famos://auth/callback")).toBe(true);
    expect(isSafeDesktopCallback("https://attacker.example/callback")).toBe(false);
    expect(parseDesktopAuthUrl("famos://auth/callback?code=abc&state=xyz")).toEqual({ code: "abc", state: "xyz" });
    expect(parseDesktopAuthUrl("famos://auth/callback?code=abc")).toBeNull();
  });

  it("extracts a valid browser handoff request", () => {
    const location = { search: "?desktop=1&callback=famos%3A%2F%2Fauth%2Fcallback&state=state_1234567890" };
    expect(getDesktopHandoffRequest(location)).toEqual({ callback: "famos://auth/callback", state: "state_1234567890" });
    expect(getDesktopHandoffRequest({ search: "?desktop=1&callback=https%3A%2F%2Fevil.example&state=state_1234567890" })).toBeNull();
  });
});
