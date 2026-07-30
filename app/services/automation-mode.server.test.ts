import { afterEach, describe, expect, it, vi } from "vitest";
import { automationWorkflowsEnabled } from "./automation-mode.server";

describe("automationWorkflowsEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to disabled", () => {
    vi.stubEnv("ENABLE_AUTOMATION_WORKFLOWS", "");
    expect(automationWorkflowsEnabled()).toBe(false);
  });

  it("requires an explicit true value", () => {
    vi.stubEnv("ENABLE_AUTOMATION_WORKFLOWS", "TRUE");
    expect(automationWorkflowsEnabled()).toBe(false);

    vi.stubEnv("ENABLE_AUTOMATION_WORKFLOWS", "true");
    expect(automationWorkflowsEnabled()).toBe(true);
  });
});
