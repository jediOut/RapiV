import { Injectable } from "@nestjs/common";

export type StripeConnectAccountStatus = {
  platformAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[] | null;
};

export type CreateExpressAccountInput = {
  email?: string;
  profileName?: string;
  metadata: Record<string, string>;
  requestCardPayments?: boolean;
  requestTransfers?: boolean;
  fallbackPlatformAccountId?: string | null;
};

@Injectable()
export class StripeConnectService {
  async createExpressAccount(input: CreateExpressAccountInput): Promise<{
    accountId: string;
    platformAccountId: string;
  }> {
    const platformAccountId = await this.currentPlatformAccountIdOrFallback(
      input.fallbackPlatformAccountId
    );
    const params: Record<string, string | undefined> = {
      type: "express",
      country: "MX",
      email: input.email,
      "business_profile[name]": input.profileName
    };

    if (input.requestCardPayments) {
      params["capabilities[card_payments][requested]"] = "true";
    }

    if (input.requestTransfers ?? true) {
      params["capabilities[transfers][requested]"] = "true";
    }

    for (const [key, value] of Object.entries(input.metadata)) {
      params[`metadata[${key}]`] = value;
    }

    const account = await this.stripeRequest<Record<string, unknown>>("/v1/accounts", params);
    const accountId = this.stringField(account, "id");

    if (!accountId) {
      throw new Error("Stripe did not return a connected account id");
    }

    return { accountId, platformAccountId };
  }

  async createOnboardingLink(input: {
    connectedAccountId: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<string> {
    const link = await this.stripeRequest<Record<string, unknown>>("/v1/account_links", {
      account: input.connectedAccountId,
      type: "account_onboarding",
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl
    });
    const url = this.stringField(link, "url");

    if (!url) {
      throw new Error("Stripe did not return an onboarding URL");
    }

    return url;
  }

  async retrieveAccountStatus(connectedAccountId: string): Promise<StripeConnectAccountStatus> {
    const platformAccountId = await this.currentPlatformAccountId();
    const account = await this.stripeGet<Record<string, unknown>>(
      `/v1/accounts/${encodeURIComponent(connectedAccountId)}`
    );
    const requirements = this.objectField(account, "requirements");
    const currentlyDue = requirements?.currently_due;

    return {
      platformAccountId,
      chargesEnabled: account.charges_enabled === true,
      payoutsEnabled: account.payouts_enabled === true,
      detailsSubmitted: account.details_submitted === true,
      requirementsCurrentlyDue: Array.isArray(currentlyDue)
        ? currentlyDue.filter((item): item is string => typeof item === "string")
        : null
    };
  }

  async currentPlatformAccountId(): Promise<string> {
    const account = await this.stripeGet<Record<string, unknown>>("/v1/account");
    const accountId = this.stringField(account, "id");

    if (!accountId) {
      throw new Error("Stripe did not return a platform account id");
    }

    return accountId;
  }

  async currentPlatformAccountIdOrFallback(fallback?: string | null): Promise<string> {
    try {
      return await this.currentPlatformAccountId();
    } catch (error) {
      if (fallback) {
        return fallback;
      }

      throw error;
    }
  }

  requireReturnBaseUrl(input: {
    primaryEnvKey: string;
    fallbackEnvKey?: string;
    label: string;
  }): string {
    const configuredValues = [
      process.env[input.primaryEnvKey],
      input.fallbackEnvKey ? process.env[input.fallbackEnvKey] : undefined
    ].filter((value): value is string => Boolean(value));
    const appBaseUrl = configuredValues.find((value) => /^https:\/\//.test(value));

    if (!appBaseUrl) {
      throw new Error(`${input.label} must be an HTTPS URL for Stripe Connect onboarding`);
    }

    const normalized = appBaseUrl.replace(/\/$/, "");
    return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
  }

  isMissingResourceError(error: unknown): boolean {
    return error instanceof Error && error.message.includes("resource_missing");
  }

  private async stripeRequest<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
    const response = await fetch(`https://api.stripe.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.requireStripeSecretKey()}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(
        Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      )
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Stripe Connect request failed with status ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  private async stripeGet<T>(path: string): Promise<T> {
    const response = await fetch(`https://api.stripe.com${path}`, {
      headers: {
        Authorization: `Bearer ${this.requireStripeSecretKey()}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Stripe Connect lookup failed with status ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  private requireStripeSecretKey(): string {
    const apiKey = process.env.STRIPE_SECRET_KEY;

    if (!apiKey) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    return apiKey;
  }

  private stringField(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === "string" ? value : undefined;
  }

  private objectField(source: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
    const value = source[key];
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
  }
}
