import { describe, expect, it } from "vitest";
import {
  fulfillmentWorkflowForStatus,
  isHighRiskAssessment,
} from "./shopify-event-routing";

describe("Shopify event routing", () => {
  it.each([
    ["failure", null],
    ["attempted_delivery", "failed_delivery"],
    ["DELAYED", "shipping_delay"],
    ["delivered", "delivery_feedback"],
    ["in_transit", null],
  ])("maps fulfillment status %s", (status, expected) => {
    expect(fulfillmentWorkflowForStatus(status)).toBe(expected);
  });

  it("triggers verification only for high risk", () => {
    expect(isHighRiskAssessment("HIGH")).toBe(true);
    expect(isHighRiskAssessment(" high ")).toBe(true);
    expect(isHighRiskAssessment("MEDIUM")).toBe(false);
    expect(isHighRiskAssessment(undefined)).toBe(false);
  });
});
