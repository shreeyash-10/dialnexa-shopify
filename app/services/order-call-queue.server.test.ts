import { describe, expect, it } from "vitest";
import {
  isCashOnDelivery,
  isInQuietHours,
  selectOrderWorkflow,
} from "./use-case-runtime";

describe("order-call workflow selection", () => {
  const useCases = {
    new_order_confirmation: {
      enabled: true,
      agentId: "agt_order",
      consentAttested: true,
    },
    cod_verification: {
      enabled: true,
      agentId: "agt_cod",
      consentAttested: true,
    },
  };

  it("recognizes common COD gateway labels", () => {
    expect(isCashOnDelivery(["Cash on Delivery (COD)"])).toBe(true);
    expect(isCashOnDelivery(["COD"])).toBe(true);
    expect(isCashOnDelivery(["Shopify Payments"])).toBe(false);
  });

  it("prefers the COD agent for COD orders", () => {
    expect(selectOrderWorkflow(["Cash on Delivery"], useCases)).toMatchObject({
      workflow: "cod_verification",
      agentId: "agt_cod",
    });
  });

  it("uses general confirmation for non-COD orders", () => {
    expect(selectOrderWorkflow(["Shopify Payments"], useCases)).toMatchObject({
      workflow: "new_order_confirmation",
      agentId: "agt_order",
    });
  });
});

describe("quiet hours", () => {
  it("blocks overnight local hours", () => {
    expect(
      isInQuietHours(
        new Date("2026-07-20T17:30:00.000Z"),
        "Asia/Kolkata",
        "20:00",
        "09:00",
      ),
    ).toBe(true);
    expect(
      isInQuietHours(
        new Date("2026-07-20T06:30:00.000Z"),
        "Asia/Kolkata",
        "20:00",
        "09:00",
      ),
    ).toBe(false);
  });

  it("treats equal start and end as calls disabled all day", () => {
    expect(isInQuietHours(new Date(), "UTC", "09:00", "09:00")).toBe(true);
  });
});
