import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDialnexaAgent,
  DialnexaApiError,
  normalizePhoneNumber,
  triggerOutboundCall,
} from "./dialnexa.server";

describe("normalizePhoneNumber", () => {
  it("normalizes common international formatting", () => {
    expect(normalizePhoneNumber("+91 98765-43210")).toBe("+919876543210");
    expect(normalizePhoneNumber("0044 7700 900123")).toBe("+447700900123");
  });

  it("rejects local or invalid numbers", () => {
    expect(normalizePhoneNumber("9876543210")).toBeNull();
    expect(normalizePhoneNumber("+0123")).toBeNull();
    expect(normalizePhoneNumber("not-a-number")).toBeNull();
  });
});

describe("triggerOutboundCall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the current Dialnexa call API contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "call_123" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      triggerOutboundCall("secret", "agt_123", "+919876543210", {
        order_number: "#1001",
      }),
    ).resolves.toMatchObject({ id: "call_123" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.dialnexa.com/v1/calls");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(options.body))).toEqual({
      agent_id: "agt_123",
      to_phone_number: "+919876543210",
      metadata: { order_number: "#1001" },
    });
  });

  it("does not send an invalid phone number", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      triggerOutboundCall("secret", "agt_123", "9876543210"),
    ).rejects.toBeInstanceOf(DialnexaApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a rejected Dialnexa request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Invalid agent", { status: 400 })),
    );

    await expect(
      triggerOutboundCall("secret", "agt_missing", "+919876543210"),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("createDialnexaAgent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a published agent through agents2", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "agt_created" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createDialnexaAgent("secret", {
        title: "Acme — COD verification",
        promptText: "Represent Acme and confirm order {{order_number}}.",
        welcomeMessage: "Hello {{customer_name}}",
      }),
    ).resolves.toMatchObject({ agentId: "agt_created" });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.dialnexa.com/agents2");
    expect(options.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(JSON.parse(String(options.body))).toMatchObject({
      is_published: true,
      conversation_start_type: "agent",
      prompts: {
        prompt_text: "Represent Acme and confirm order {{order_number}}.",
      },
      security: { opt_out_sensitive_data_storage: true },
    });
  });

  it("rejects a successful response without an agent id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ created: true }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      createDialnexaAgent("secret", {
        title: "Agent",
        promptText: "Prompt",
        welcomeMessage: "Hello",
      }),
    ).rejects.toMatchObject({ status: 502 });
  });
});
