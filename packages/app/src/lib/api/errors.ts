import { ClientValidationError } from '@atcute/client'

/** Stable error categories consumed by route-level request states. */
export type BobbinErrorKind =
	| 'aborted'
	| 'invalid-request'
	| 'identity-not-found'
	| 'malformed-response'
	| 'network'
	| 'offline'
	| 'not-found'
	| 'rate-limited'
	| 'service-unavailable'
	| 'upstream-unavailable'

/** A normalized Bobbin failure that keeps transport details out of views. */
export class BobbinError extends Error {
	readonly kind: BobbinErrorKind
	readonly status?: number
	readonly retryAfterMs?: number

	constructor(
		kind: BobbinErrorKind,
		message: string,
		options: { cause?: unknown; status?: number; retryAfterMs?: number } = {},
	) {
		super(message, { cause: options.cause })
		this.name = 'BobbinError'
		this.kind = kind
		this.status = options.status
		this.retryAfterMs = options.retryAfterMs
	}
}

type ErrorResponse = { status: number; headers: Headers; data: { error: string; message?: string } }

/** Converts an unsuccessful XRPC response into Twisted's stable error model. */
export function errorFromResponse(response: ErrorResponse): BobbinError {
	const { status } = response
	const message = response.data.message ?? response.data.error

	if (status === 400) {
		return new BobbinError('invalid-request', message, { status })
	}
	if (status === 404) {
		return new BobbinError('not-found', message, { status })
	}
	if (status === 429) {
		return new BobbinError('rate-limited', message, {
			status,
			retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')),
		})
	}
	if (status === 502) {
		return new BobbinError('upstream-unavailable', message, { status })
	}

	return new BobbinError('service-unavailable', message, { status })
}

/** Converts fetch, abort, and schema exceptions into Twisted's error model. */
export function errorFromException(error: unknown): BobbinError {
	if (error instanceof BobbinError) {
		return error
	}
	if (error instanceof ClientValidationError) {
		if (error.target === 'params' || error.target === 'input') {
			return new BobbinError('invalid-request', 'The Bobbin request is invalid', { cause: error })
		}
		return new BobbinError('malformed-response', 'Bobbin returned malformed data', { cause: error })
	}
	if (isAbortError(error)) {
		return new BobbinError('aborted', 'The Bobbin request was canceled', { cause: error })
	}
	if (typeof navigator !== 'undefined' && navigator.onLine === false) {
		return new BobbinError('offline', 'This device is offline', { cause: error })
	}

	return new BobbinError('network', 'Bobbin could not be reached', { cause: error })
}

function isAbortError(error: unknown): boolean {
	return (
		(error instanceof DOMException && error.name === 'AbortError') ||
		(typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
	)
}

export function parseRetryAfterMs(value: string | null): number | undefined {
	if (value === null) {
		return undefined
	}

	const seconds = Number(value)
	if (Number.isFinite(seconds) && seconds >= 0) {
		return seconds * 1_000
	}

	const date = Date.parse(value)
	return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}
