import { NextResponse } from "next/server";

import { LegalReviewError, toErrorResponse } from "../../../../lib/legal-review/errors";

export const runtime = "nodejs";

type Provider = "OpenAI" | "Anthropic" | "Google AI" | "OpenRouter" | "Local endpoint";

const providers = new Set<Provider>([
  "OpenAI",
  "Anthropic",
  "Google AI",
  "OpenRouter",
  "Local endpoint",
]);

async function parsePayload(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    throw new LegalReviewError("INVALID_JSON", "Request body must be valid JSON.");
  }

  if (!payload || typeof payload !== "object") {
    throw new LegalReviewError("INVALID_REQUEST", "Provider and API key are required.");
  }

  const record = payload as Record<string, unknown>;
  const provider = record.provider;
  const apiKey = record.apiKey;

  if (typeof provider !== "string" || !providers.has(provider as Provider)) {
    throw new LegalReviewError("INVALID_PROVIDER", "Choose a supported provider.");
  }

  if (typeof apiKey !== "string" || apiKey.trim().length < 8) {
    throw new LegalReviewError("INVALID_KEY", "Paste a real provider key before validating.");
  }

  return {
    provider: provider as Provider,
    apiKey: apiKey.trim(),
  };
}

async function validateProviderKey(provider: Provider, apiKey: string) {
  if (provider === "Local endpoint") {
    return {
      valid: true,
      message: "Local endpoint selected. Key validation is skipped.",
    };
  }

  const request =
    provider === "OpenAI"
      ? fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
      : provider === "Anthropic"
        ? fetch("https://api.anthropic.com/v1/models", {
            headers: {
              "anthropic-version": "2023-06-01",
              "x-api-key": apiKey,
            },
          })
        : provider === "Google AI"
          ? fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`)
          : fetch("https://openrouter.ai/api/v1/models", {
              headers: { Authorization: `Bearer ${apiKey}` },
            });

  let response: Response;

  try {
    response = await request;
  } catch {
    return {
      valid: false,
      message: `Could not reach ${provider} for validation. Check your connection and try again.`,
    };
  }

  if (response.ok) {
    return {
      valid: true,
      message: `${provider} key is valid.`,
    };
  }

  if (response.status === 401 || response.status === 403 || response.status === 400) {
    return {
      valid: false,
      message: `${provider} rejected this key. Check the key and provider selection.`,
    };
  }

  return {
    valid: false,
    message: `${provider} validation returned HTTP ${response.status}. Try again or check provider status.`,
  };
}

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await parsePayload(request);
    const result = await validateProviderKey(provider, apiKey);
    return NextResponse.json(result, { status: result.valid ? 200 : 401 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
