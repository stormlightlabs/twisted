export class TangledError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "TangledError";
  }
}

export class NotFoundError extends TangledError {
  constructor(resource: string) {
    super(`Not found: ${resource}`);
    this.name = "NotFoundError";
  }
}

export class NetworkError extends TangledError {
  constructor(message = "Network unavailable") {
    super(message);
    this.name = "NetworkError";
  }
}

export class MalformedResponseError extends TangledError {
  constructor(endpoint: string, cause?: unknown) {
    super(`Malformed response from ${endpoint}`);
    this.name = "MalformedResponseError";
    this.cause = cause;
  }
}

export class RateLimitedError extends TangledError {
  constructor(retryAfter?: number) {
    super(retryAfter ? `Rate limited. Retry after ${retryAfter}s` : "Rate limited");
    this.name = "RateLimitedError";
  }
}
