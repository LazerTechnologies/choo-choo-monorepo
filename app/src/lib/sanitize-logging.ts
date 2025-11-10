const SENSITIVE_KEYS = ['secret', 'token', 'key', 'pass', 'rpc', 'url', 'endpoint'];

const SENSITIVE_VALUES = [
  process.env.RPC_URL,
  process.env.NEXT_PUBLIC_RPC_URL,
  process.env.BASE_RPC_URL,
  process.env.BASE_SEPOLIA_RPC_URL,
  process.env.ALCHEMY_API_KEY,
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
].filter((value): value is string => typeof value === 'string' && value.length > 0);

function getUrlReplacement(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);

    if (segments.length === 0) {
      return `${parsed.origin}/<redacted>`;
    }

    segments[segments.length - 1] = '<redacted>';
    const sanitizedPath = `/${segments.join('/')}`;
    const sanitizedSearch = parsed.search ? '?<redacted>' : '';

    return `${parsed.origin}${sanitizedPath}${sanitizedSearch}`;
  } catch {
    return '<redacted-url>';
  }
}

function sanitizeString(value: string): string {
  if (SENSITIVE_VALUES.length === 0) {
    return value;
  }

  return SENSITIVE_VALUES.reduce((acc, token) => {
    if (!token) {
      return acc;
    }

    const replacement = token.startsWith('http') ? getUrlReplacement(token) : '<redacted>';
    return acc.split(token).join(replacement);
  }, value);
}

function shouldRedactKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((pattern) => normalized.includes(pattern));
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (value instanceof Error) {
    const sanitizedError: Record<string, unknown> = {
      name: sanitizeString(value.name),
      message: sanitizeString(value.message),
    };

    if (value.stack) {
      sanitizedError.stack = sanitizeString(value.stack);
    }

    if ('cause' in value) {
      sanitizedError.cause = sanitizeValue((value as { cause?: unknown }).cause, seen);
    }

    for (const [key, entryValue] of Object.entries(value)) {
      sanitizedError[key] = sanitizeValue(entryValue, seen);
    }

    return sanitizedError;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, seen));
  }

  const sanitizedObject: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entryValue === 'string' && shouldRedactKey(key)) {
      sanitizedObject[key] = entryValue.length > 0 ? '<redacted>' : entryValue;
      continue;
    }

    sanitizedObject[key] = sanitizeValue(entryValue, seen);
  }

  return sanitizedObject;
}

function sanitizeArgs(args: unknown[]): unknown[] {
  const seen = new WeakSet<object>();
  return args.map((arg) => sanitizeValue(arg, seen));
}

function attachSanitizedLogger(method: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    method(...sanitizeArgs(args));
  };
}

if (typeof window === 'undefined') {
  const globalWithFlag = globalThis as typeof globalThis & { __loggingSanitized?: boolean };

  if (!globalWithFlag.__loggingSanitized) {
    globalWithFlag.__loggingSanitized = true;

    const originalError = console.error.bind(console);
    const originalWarn = console.warn.bind(console);
    const originalLog = console.log.bind(console);

    console.error = attachSanitizedLogger(originalError);
    console.warn = attachSanitizedLogger(originalWarn);
    console.log = attachSanitizedLogger(originalLog);
  }
}

export {};
