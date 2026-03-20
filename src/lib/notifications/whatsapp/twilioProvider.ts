import type {
  WhatsAppProviderRuntimeConfigContract,
  WhatsAppProviderSendInputContract,
  WhatsAppProviderSendResultContract
} from "./contracts";
import type { WhatsAppProviderAdapter } from "./whatsappProvider";

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeWhatsAppAddress(value: string) {
  const normalized = value.trim();
  return normalized.startsWith("whatsapp:") ? normalized : `whatsapp:${normalized}`;
}

function parseTwilioCredentials(config: WhatsAppProviderRuntimeConfigContract) {
  const apiKey = normalizeOptionalString(config.apiKey);
  const configuredSid = normalizeOptionalString(config.accountSid);

  if (!apiKey) {
    return null;
  }

  if (configuredSid) {
    return {
      accountSid: configuredSid,
      authToken: apiKey
    };
  }

  const separator = apiKey.includes(":") ? ":" : apiKey.includes("|") ? "|" : null;

  if (!separator) {
    return null;
  }

  const [accountSid, authToken] = apiKey
    .split(separator)
    .map((value) => value.trim());

  if (!accountSid || !authToken) {
    return null;
  }

  return {
    accountSid,
    authToken
  };
}

function buildTwilioEndpoint(config: {
  accountSid: string;
  apiBaseUrl: string | null;
}) {
  const base = normalizeOptionalString(config.apiBaseUrl) ?? "https://api.twilio.com";
  const url = new URL(
    `/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
    base
  );

  return url.toString();
}

export function createTwilioWhatsAppProvider(): WhatsAppProviderAdapter {
  return {
    key: "twilio",
    async sendMessage(
      payload: WhatsAppProviderSendInputContract,
      config: WhatsAppProviderRuntimeConfigContract
    ): Promise<WhatsAppProviderSendResultContract> {
      const credentials = parseTwilioCredentials(config);

      if (!credentials) {
        return {
          ok: false,
          provider: "twilio",
          externalMessageId: null,
          statusCode: null,
          providerStatus: null,
          response: null,
          error:
            "Twilio credentials are missing. Configure whatsapp_account_sid plus whatsapp_api_key, or whatsapp_api_key as accountSid:authToken."
        };
      }

      const endpoint = buildTwilioEndpoint({
        accountSid: credentials.accountSid,
        apiBaseUrl: config.apiBaseUrl ?? null
      });
      const headers = {
        Authorization: `Basic ${Buffer.from(
          `${credentials.accountSid}:${credentials.authToken}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      };
      const body = new URLSearchParams({
        To: normalizeWhatsAppAddress(payload.to),
        From: normalizeWhatsAppAddress(payload.from),
        Body: payload.message
      });

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: body.toString(),
          signal: AbortSignal.timeout(7000)
        });

        let parsedBody: unknown = null;
        const raw = await response.text();

        if (raw.trim().length > 0) {
          try {
            parsedBody = JSON.parse(raw);
          } catch {
            parsedBody = {
              raw
            };
          }
        }

        const parsedRecord = parseRecord(parsedBody);
        const sid =
          typeof parsedRecord?.sid === "string" ? parsedRecord.sid : null;
        const status =
          typeof parsedRecord?.status === "string" ? parsedRecord.status : null;
        const errorMessage =
          typeof parsedRecord?.message === "string"
            ? parsedRecord.message
            : typeof parsedRecord?.error_message === "string"
              ? parsedRecord.error_message
              : null;

        return {
          ok: response.ok,
          provider: "twilio",
          externalMessageId: sid,
          statusCode: response.status,
          providerStatus: status,
          response: parsedRecord,
          error: response.ok ? null : errorMessage ?? `Twilio returned ${response.status}.`
        };
      } catch (error) {
        return {
          ok: false,
          provider: "twilio",
          externalMessageId: null,
          statusCode: null,
          providerStatus: null,
          response: null,
          error:
            error instanceof Error
              ? error.message
              : "Unexpected Twilio provider error."
        };
      }
    }
  };
}
