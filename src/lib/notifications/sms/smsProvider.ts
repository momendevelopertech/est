import {
  type SmsProviderRuntimeConfigContract,
  type SmsProviderSendInputContract,
  type SmsProviderSendResultContract
} from "./contracts";
import { createTwilioSmsProvider } from "./twilioSmsProvider";

export type SmsProviderAdapter = {
  readonly key: string;
  sendMessage: (
    payload: SmsProviderSendInputContract,
    config: SmsProviderRuntimeConfigContract
  ) => Promise<SmsProviderSendResultContract>;
};

const mockSmsCloudProvider: SmsProviderAdapter = {
  key: "mock_sms_cloud",
  async sendMessage(_payload, config) {
    const token = config.apiKey.trim().toLowerCase();

    if (token === "simulate_success") {
      return {
        ok: true,
        provider: "mock_sms_cloud",
        externalMessageId: `sms_sim_${Date.now()}`,
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
        provider: "mock_sms_cloud",
        externalMessageId: null,
        statusCode: 503,
        providerStatus: "failed",
        response: {
          simulated: true
        },
        error: "Simulated SMS provider failure."
      };
    }

    return {
      ok: false,
      provider: "mock_sms_cloud",
      externalMessageId: null,
      statusCode: null,
      providerStatus: null,
      response: null,
      error: "Mock SMS Cloud provider is not implemented for real transport."
    };
  }
};

const providerRegistry = new Map<string, SmsProviderAdapter>([
  ["twilio", createTwilioSmsProvider()],
  ["mock_sms_cloud", mockSmsCloudProvider]
]);

export function normalizeSmsProviderKey(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "mock" || normalized === "mock_sms") {
    return "mock_sms_cloud";
  }

  if (normalized === "twilio") {
    return "twilio";
  }

  if (providerRegistry.has(normalized)) {
    return normalized;
  }

  return normalized;
}

export function resolveSmsProviderAdapter(
  provider: string | null | undefined
): SmsProviderAdapter | null {
  const normalized = normalizeSmsProviderKey(provider);

  if (!normalized) {
    return null;
  }

  return providerRegistry.get(normalized) ?? null;
}
