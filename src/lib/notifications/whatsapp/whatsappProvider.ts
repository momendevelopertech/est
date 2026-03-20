import {
  type WhatsAppProviderRuntimeConfigContract,
  type WhatsAppProviderSendInputContract,
  type WhatsAppProviderSendResultContract
} from "./contracts";
import { createTwilioWhatsAppProvider } from "./twilioProvider";

export type WhatsAppProviderAdapter = {
  readonly key: string;
  sendMessage: (
    payload: WhatsAppProviderSendInputContract,
    config: WhatsAppProviderRuntimeConfigContract
  ) => Promise<WhatsAppProviderSendResultContract>;
};

const metaWhatsAppCloudProvider: WhatsAppProviderAdapter = {
  key: "meta_whatsapp_cloud",
  async sendMessage(_payload, config) {
    const token = config.apiKey.trim().toLowerCase();

    if (token === "simulate_success") {
      return {
        ok: true,
        provider: "meta_whatsapp_cloud",
        externalMessageId: `meta_sim_${Date.now()}`,
        statusCode: 200,
        providerStatus: "queued",
        response: {
          simulated: true
        },
        error: null
      };
    }

    if (token === "simulate_failure") {
      return {
        ok: false,
        provider: "meta_whatsapp_cloud",
        externalMessageId: null,
        statusCode: 503,
        providerStatus: "failed",
        response: {
          simulated: true
        },
        error: "Simulated provider failure."
      };
    }

    return {
      ok: false,
      provider: "meta_whatsapp_cloud",
      externalMessageId: null,
      statusCode: null,
      providerStatus: null,
      response: null,
      error: "Meta WhatsApp Cloud provider adapter is not implemented yet."
    };
  }
};

const providerRegistry = new Map<string, WhatsAppProviderAdapter>([
  ["twilio", createTwilioWhatsAppProvider()],
  ["meta_whatsapp_cloud", metaWhatsAppCloudProvider]
]);

export function normalizeWhatsAppProviderKey(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "meta" || normalized === "meta_cloud") {
    return "meta_whatsapp_cloud";
  }

  if (normalized === "twilio") {
    return "twilio";
  }

  if (providerRegistry.has(normalized)) {
    return normalized;
  }

  return normalized;
}

export function resolveWhatsAppProviderAdapter(
  provider: string | null | undefined
): WhatsAppProviderAdapter | null {
  const normalized = normalizeWhatsAppProviderKey(provider);

  if (!normalized) {
    return null;
  }

  return providerRegistry.get(normalized) ?? null;
}
