export type FulfillmentWorkflow =
  | "failed_delivery"
  | "shipping_delay"
  | "delivery_feedback";

export function fulfillmentWorkflowForStatus(
  status: string,
): FulfillmentWorkflow | null {
  switch (status.trim().toLowerCase()) {
    case "attempted_delivery":
      return "failed_delivery";
    case "delayed":
      return "shipping_delay";
    case "delivered":
      return "delivery_feedback";
    default:
      return null;
  }
}

export function isHighRiskAssessment(riskLevel: unknown): boolean {
  return typeof riskLevel === "string" && riskLevel.trim().toUpperCase() === "HIGH";
}
