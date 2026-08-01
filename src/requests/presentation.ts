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
		title: 'Bobbin returned unexpected data',
		message: 'Twisted stopped before displaying data it could not validate.',
		retryable: false,
	},
	network: {
		title: 'Bobbin could not be reached',
		message: 'Check the connection or configured service, then try again.',
		retryable: true,
	},
	offline: { title: 'You are offline', message: 'Reconnect to load public Tangled data.', retryable: true },
	'not-found': {
		title: 'Record not found',
		message: 'It may have moved, been deleted, or not reached this Bobbin service yet.',
		retryable: false,
	},
	'rate-limited': {
		title: 'Bobbin asked us to slow down',
		message: 'Existing results remain available. Retry after the waiting period.',
		retryable: true,
	},
	'service-unavailable': {
		title: 'Bobbin is unavailable',
		message: 'The service cannot handle this request right now.',
		retryable: true,
	},
	'upstream-unavailable': {
		title: 'The upstream service is unavailable',
		message: 'Bobbin is reachable, but a service it depends on did not respond.',
		retryable: true,
	},
}

export function presentRequestError(error: BobbinError): RequestErrorPresentation {
	return presentations[error.kind]
}
