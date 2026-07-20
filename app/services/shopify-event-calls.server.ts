import { unauthenticated } from "../shopify.server";
import { enqueueUseCaseCall } from "./use-case-call-queue.server";
import type { UseCaseTrigger } from "./use-case-runtime";

interface OrderContext {
  order?: {
    id: string;
    name?: string;
    customer?: {
      firstName?: string | null;
      phone?: string | null;
    } | null;
    shippingAddress?: {
      phone?: string | null;
      address1?: string | null;
      address2?: string | null;
      city?: string | null;
      province?: string | null;
      zip?: string | null;
      country?: string | null;
    } | null;
    billingAddress?: { phone?: string | null } | null;
    totalPriceSet?: {
      shopMoney?: { amount?: string; currencyCode?: string };
    };
    lineItems?: { nodes?: Array<{ name?: string; quantity?: number }> };
    fulfillments?: Array<{
      trackingInfo?: Array<{ company?: string | null; number?: string | null }>;
    }>;
  } | null;
}

function orderGid(orderId: string | number): string {
  const value = String(orderId);
  return value.startsWith("gid://") ? value : `gid://shopify/Order/${value}`;
}

async function isUseCaseActive(shop: string, useCaseId: string): Promise<boolean> {
  const { admin } = await unauthenticated.admin(shop);
  const response = await admin.graphql(`
    #graphql
    query WorkflowActivation {
      currentAppInstallation {
        useCasesMetafield: metafield(namespace: "dialnexa", key: "use_cases") { value }
      }
    }
  `);
  const json = (await response.json()) as {
    data?: { currentAppInstallation?: { useCasesMetafield?: { value?: string } } };
    errors?: Array<{ message?: string }>;
  };
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Could not verify workflow activation");
  }
  try {
    const all = JSON.parse(
      json.data?.currentAppInstallation?.useCasesMetafield?.value || "{}",
    ) as Record<string, { enabled?: boolean; consentAttested?: boolean; agentId?: string }>;
    const configuration = all[useCaseId];
    return Boolean(
      configuration?.enabled &&
        configuration.consentAttested &&
        configuration.agentId,
    );
  } catch {
    return false;
  }
}

async function loadOrder(shop: string, orderId: string | number) {
  const { admin } = await unauthenticated.admin(shop);
  const response = await admin.graphql(
    `#graphql
    query WorkflowOrderContext($id: ID!) {
      order(id: $id) {
        id name
        customer { firstName phone }
        shippingAddress { phone address1 address2 city province zip country }
        billingAddress { phone }
        totalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 10) { nodes { name quantity } }
        fulfillments(first: 10) { trackingInfo(first: 10) { company number } }
      }
    }`,
    { variables: { id: orderGid(orderId) } },
  );
  const json = (await response.json()) as {
    data?: OrderContext;
    errors?: Array<{ message?: string }>;
  };
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Shopify order query failed");
  }
  return json.data?.order;
}

export async function enqueueOrderEventCall(input: {
  shop: string;
  webhookId: string;
  orderId: string | number;
  useCaseId: "high_risk_verification" | "failed_delivery" | "shipping_delay" | "delivery_feedback";
  source: Extract<
    UseCaseTrigger,
    "orders/risk_assessment_changed" | "fulfillment_events/create"
  >;
  eventMetadata?: Record<string, string>;
  delayMinutes?: number;
}): Promise<{ queued: boolean; reason?: string }> {
  if (!(await isUseCaseActive(input.shop, input.useCaseId))) {
    return { queued: false, reason: "Workflow is not active" };
  }
  const order = await loadOrder(input.shop, input.orderId);
  if (!order) return { queued: false, reason: "Order was not found" };
  const phoneNumber =
    order.customer?.phone ||
    order.shippingAddress?.phone ||
    order.billingAddress?.phone ||
    "";
  if (!phoneNumber) return { queued: false, reason: "Order has no phone" };

  const money = order.totalPriceSet?.shopMoney;
  const orderItems = (order.lineItems?.nodes || [])
    .map(({ name, quantity }) =>
      name ? `${quantity && quantity > 1 ? `${quantity} × ` : ""}${name}` : "",
    )
    .filter(Boolean)
    .join(", ");
  const address = order.shippingAddress;
  const tracking = order.fulfillments?.flatMap(({ trackingInfo }) => trackingInfo || [])[0];
  const common = {
    customer_name: order.customer?.firstName || "Valued customer",
    order_number: order.name || String(input.orderId),
    order_items: orderItems,
    order_total: money?.amount || "",
    delivery_locality: address?.city || "",
    delivery_address: [
      address?.address1,
      address?.address2,
      address?.city,
      address?.province,
      address?.zip,
      address?.country,
    ]
      .filter(Boolean)
      .join(", "),
    postal_code: address?.zip || "",
    tracking_reference: tracking?.number || "",
    carrier_name: tracking?.company || "",
  };
  const allowedByUseCase: Record<string, string[]> = {
    high_risk_verification: [
      "customer_name", "order_number", "order_items", "order_total",
      "delivery_locality", "order_context",
    ],
    failed_delivery: [
      "customer_name", "order_number", "order_items", "order_total",
      "delivery_locality", "delivery_failure_reason", "reattempt_options",
      "carrier_name", "order_context",
    ],
    shipping_delay: [
      "customer_name", "order_number", "order_items", "order_total",
      "delivery_locality", "shipping_status", "delay_reason",
      "tracking_reference", "approved_next_step", "order_context",
    ],
    delivery_feedback: [
      "customer_name", "order_number", "order_items", "order_total",
      "delivery_locality", "review_request", "support_route", "order_context",
    ],
  };
  const combined = { ...common, ...(input.eventMetadata || {}) };
  const metadata = Object.fromEntries(
    Object.entries(combined).filter(
      ([key, value]) => allowedByUseCase[input.useCaseId].includes(key) && value,
    ),
  );
  const result = await enqueueUseCaseCall({
    shop: input.shop,
    useCaseId: input.useCaseId,
    source: input.source,
    dedupeKey: `${input.source}:${input.useCaseId}:${input.webhookId}`,
    phoneNumber,
    metadata,
    availableAt:
      input.delayMinutes && input.delayMinutes > 0
        ? new Date(Date.now() + input.delayMinutes * 60_000)
        : undefined,
  });
  return { queued: !result.duplicate };
}

export async function enqueueSubscriptionFailureCall(input: {
  shop: string;
  webhookId: string;
  contractId: string;
  errorMessage?: string;
}): Promise<{ queued: boolean; reason?: string }> {
  if (!(await isUseCaseActive(input.shop, "subscription_payment_recovery"))) {
    return { queued: false, reason: "Workflow is not active" };
  }
  const { admin } = await unauthenticated.admin(input.shop);
  const contractId = input.contractId.startsWith("gid://")
    ? input.contractId
    : `gid://shopify/SubscriptionContract/${input.contractId}`;
  const response = await admin.graphql(
    `#graphql
    query FailedSubscriptionContext($id: ID!) {
      subscriptionContract(id: $id) {
        id appAdminUrl
        customer { firstName defaultPhoneNumber { phoneNumber } }
        lines(first: 10) { nodes { title } }
      }
    }`,
    { variables: { id: contractId } },
  );
  const json = (await response.json()) as {
    data?: {
      subscriptionContract?: {
        id: string;
        appAdminUrl?: string | null;
        customer?: {
          firstName?: string | null;
          defaultPhoneNumber?: { phoneNumber?: string | null } | null;
        } | null;
        lines?: { nodes?: Array<{ title?: string | null }> };
      } | null;
    };
    errors?: Array<{ message?: string }>;
  };
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Subscription query failed");
  }
  const contract = json.data?.subscriptionContract;
  const phoneNumber = contract?.customer?.defaultPhoneNumber?.phoneNumber;
  if (!contract || !phoneNumber) {
    return { queued: false, reason: "Subscription customer has no phone" };
  }
  const paymentUpdateUrl = process.env.SUBSCRIPTION_PAYMENT_UPDATE_URL;
  if (!paymentUpdateUrl) {
    return { queued: false, reason: "SUBSCRIPTION_PAYMENT_UPDATE_URL is not configured" };
  }
  const result = await enqueueUseCaseCall({
    shop: input.shop,
    useCaseId: "subscription_payment_recovery",
    source: "subscription_billing_attempts/failure",
    dedupeKey: `subscription-failure:${input.webhookId}`,
    phoneNumber,
    metadata: {
      customer_name: contract.customer?.firstName || "Valued customer",
      subscription_name:
        contract.lines?.nodes?.map(({ title }) => title).filter(Boolean).join(", ") ||
        "your subscription",
      payment_update_url: paymentUpdateUrl,
      service_impact: input.errorMessage || "The latest payment attempt failed",
      billing_attempt_date: new Date().toISOString(),
    },
  });
  return { queued: !result.duplicate };
}
