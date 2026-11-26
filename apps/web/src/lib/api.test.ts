import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
// Restore the browser network boundary between independent request scenarios.
afterEach(() => vi.unstubAllGlobals());
describe("scoped case API", () => {
  // Preserve the selected identity and proposal version on human decisions.
  it("sends a versioned decision under the selected identity", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetch);
    await api("/cases/DSP-1/actions", "reviewer-1", {
      action: "approve",
      version: 3,
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/cases/DSP-1/actions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Identity": "reviewer-1" }),
        body: JSON.stringify({ action: "approve", version: 3 }),
      }),
    );
  });
  // Surface stale-version errors to the interface rather than treating them as success.
  it("rejects stale approval responses with the server explanation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          detail: "Case changed; refresh before taking action",
        }),
      }),
    );
    await expect(
      api("/cases/DSP-1/actions", "reviewer-1", {
        action: "approve",
        version: 2,
      }),
    ).rejects.toThrow("Case changed");
  });
});
