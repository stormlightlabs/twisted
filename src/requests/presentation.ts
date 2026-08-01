import type { BobbinError, BobbinErrorKind } from '@/api'

export interface RequestErrorPresentation {
	message: string
	retryable: boolean
	title: string
}

const presentations: Record<BobbinErrorKind, RequestErrorPresentation> = {
	aborted: { title: 'Request canceled', message: 'The previous request is no longer needed.', retryable: false },
	'invalid-request': {
		title: 'Check this request',
		message: 'One or more identifiers or filters are not valid.',
		retryable: false,
	},
	'malformed-response': {
		title: 'This content could not be displayed',
		message: 'The response was incomplete or in an unexpected format.',
		retryable: false,
	},
	network: {
		title: 'Tangled could not be reached',
		message: 'Check your connection, then try again.',
		retryable: true,
	},
	offline: { title: 'You are offline', message: 'Reconnect to load public Tangled data.', retryable: true },
	'not-found': {
		title: 'Record not found',
		message: 'It may have moved, been deleted, or may not be available yet.',
		retryable: false,
	},
	'rate-limited': {
		title: 'Too many requests',
		message: 'Your current results are safe. Try again after the waiting period.',
		retryable: true,
	},
	'service-unavailable': {
		title: 'Tangled is unavailable',
		message: 'Public content cannot be loaded right now.',
		retryable: true,
	},
	'upstream-unavailable': {
		title: 'Part of Tangled is unavailable',
		message: 'This content cannot be loaded right now.',
		retryable: true,
	},
}

export function presentRequestError(error: BobbinError): RequestErrorPresentation {
	return presentations[error.kind]
}
