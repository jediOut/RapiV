type CrashAttributes = Record<string, string | number | boolean | null | undefined>;

type CrashlyticsModule = {
  getCrashlytics?: () => unknown;
  log?: (crashlytics: unknown, message: string) => void;
  recordError?: (crashlytics: unknown, error: Error) => void;
  setUserId?: (crashlytics: unknown, userId: string) => Promise<void> | void;
  setAttributes?: (crashlytics: unknown, attributes: Record<string, string>) => Promise<void> | void;
  default?: () => {
    log?: (message: string) => void;
    recordError?: (error: Error) => void;
    setUserId?: (userId: string) => Promise<void> | void;
    setAttributes?: (attributes: Record<string, string>) => Promise<void> | void;
  };
};

let cachedClient: { module: CrashlyticsModule; crashlytics: unknown } | null | undefined;

function normalizeAttributes(attributes: CrashAttributes = {}) {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter((entry): entry is [string, string | number | boolean] => entry[1] !== null && entry[1] !== undefined)
      .map(([key, value]) => [key, String(value)])
  );
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
}

function getCrashlyticsClient() {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  try {
    // Keep this dynamic so Expo Go/dev environments without the native module do not crash on import.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crashlyticsModule = require("@react-native-firebase/crashlytics") as CrashlyticsModule;
    const crashlytics = crashlyticsModule.getCrashlytics?.() ?? crashlyticsModule.default?.();

    cachedClient = crashlytics ? { module: crashlyticsModule, crashlytics } : null;
  } catch {
    cachedClient = null;
  }

  return cachedClient;
}

export function logCrashBreadcrumb(message: string) {
  const client = getCrashlyticsClient();

  try {
    if (client?.module.log) {
      client.module.log(client.crashlytics, message);
      return;
    }

    (client?.crashlytics as ReturnType<NonNullable<CrashlyticsModule["default"]>> | undefined)?.log?.(message);
  } catch {
    // Crash reporting must never break the app flow.
  }
}

export function recordNonFatalError(error: unknown, attributes?: CrashAttributes) {
  const client = getCrashlyticsClient();

  try {
    const normalizedAttributes = normalizeAttributes(attributes);

    if (Object.keys(normalizedAttributes).length > 0) {
      if (client?.module.setAttributes) {
        void client.module.setAttributes(client.crashlytics, normalizedAttributes);
      } else {
        void (client?.crashlytics as ReturnType<NonNullable<CrashlyticsModule["default"]>> | undefined)?.setAttributes?.(
          normalizedAttributes
        );
      }
    }

    if (client?.module.recordError) {
      client.module.recordError(client.crashlytics, normalizeError(error));
      return;
    }

    (client?.crashlytics as ReturnType<NonNullable<CrashlyticsModule["default"]>> | undefined)?.recordError?.(
      normalizeError(error)
    );
  } catch {
    // Crash reporting must never break the app flow.
  }
}

export function identifyCrashUser(userId: string | undefined, attributes?: CrashAttributes) {
  const client = getCrashlyticsClient();

  try {
    if (userId) {
      if (client?.module.setUserId) {
        void client.module.setUserId(client.crashlytics, userId);
      } else {
        void (client?.crashlytics as ReturnType<NonNullable<CrashlyticsModule["default"]>> | undefined)?.setUserId?.(
          userId
        );
      }
    }

    const normalizedAttributes = normalizeAttributes({
      app: "negocio",
      role: "BUSINESS_OWNER",
      ...attributes,
    });

    if (client?.module.setAttributes) {
      void client.module.setAttributes(client.crashlytics, normalizedAttributes);
    } else {
      void (client?.crashlytics as ReturnType<NonNullable<CrashlyticsModule["default"]>> | undefined)?.setAttributes?.(
        normalizedAttributes
      );
    }
  } catch {
    // Crash reporting must never break the app flow.
  }
}
