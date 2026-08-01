import { Client, simpleFetchHandler } from '@atcute/client'
import type { BaseSchema, InferInput } from '@atcute/lexicons/validations'
import * as v from '@atcute/lexicons/validations'
import { is } from '@atcute/lexicons'
import { ComBadExampleIdentityResolveMiniDoc } from '@atcute/microcosm'
import {
	ShTangledActorGetProfile,
	ShTangledActorProfile,
	ShTangledRepo,
	ShTangledRepoGetRepoByRepoDid,
	ShTangledRepoGetRepos,
	ShTangledRepoGetRepo,
	ShTangledRepoListRepos,
	ShTangledSearchQuery,
} from '@atcute/tangled'
import {
	bobbinCoverageSchema,
	bobbinKnotListKeysSchema,
	bobbinKnotOwnerSchema,
	bobbinKnotVersionSchema,
	DEFAULT_BOBBIN_SERVICE,
} from './contracts'
import type { BobbinCoverage } from './contracts'
import { BobbinError, errorFromException, errorFromResponse } from './errors'
import { createRequestKey, RequestCache, STALE_TIMES } from './cache'

/** A Bobbin record view after its embedded value has passed schema validation. */
export interface ValidatedRecordView<T> {
	uri: string
	cid?: string
	value: T
}

/** One cursor-based page returned by an indexed Bobbin query. */
export interface CursorPage<T> {
	items: T[]
	cursor?: string
}

/** Constructor options for a configurable, testable Bobbin boundary. */
export interface BobbinClientOptions {
	cache?: RequestCache
	service?: string | URL
	fetch?: typeof globalThis.fetch
}

/** Options shared by abortable Bobbin requests. */
export interface RequestOptions {
	cache?: 'default' | 'reload'
	signal?: AbortSignal
}

/** Parameters accepted by the repository list endpoint. */
export interface ListReposOptions extends RequestOptions {
	cursor?: string
	limit?: number
	order?: 'asc' | 'desc'
}

/** A search hit whose embedded value has been validated and mapped. */
export interface ValidatedSearchHit<T> {
	uri: string
	cid?: string
	nsid: string
	score: number
	value: T
}

/** Parameters for Bobbin's full-text search query. */
export type SearchParams = ShTangledSearchQuery.$params

type XrpcResponse<T> =
	| { ok: true; data: T; status: number; headers: Headers }
	| { ok: false; data: { error: string; message?: string }; status: number; headers: Headers }

type SuccessData<TResponse> = TResponse extends { ok: true; data: infer TData } ? TData : never

interface BobbinSearchResponse {
	cursor?: string
	hits: Array<{ uri: string; cid?: string; nsid: string; score: number; value: Record<string, unknown> }>
}

/**
 * The read-only XRPC boundary used by Twisted views and feature modules.
 *
 * Published endpoints use atcute's generated query schemas. Methods that return
 * embedded records perform a second validation step with the record schema.
 */
export class BobbinClient {
	readonly service: string
	readonly #cache: RequestCache
	readonly #rpc: Client

	constructor(options: BobbinClientOptions = {}) {
		this.service = normalizeBobbinService(options.service ?? DEFAULT_BOBBIN_SERVICE)
		this.#cache = options.cache ?? new RequestCache()
		this.#rpc = new Client({ handler: simpleFetchHandler({ service: this.service, fetch: options.fetch }) })
	}

	/** Returns Bobbin's current Hydrant ingestion coverage. */
	getCoverage(options: RequestOptions = {}): Promise<BobbinCoverage> {
		return this.#cached('sh.tangled.bobbin.getCoverage', {}, options, STALE_TIMES.coverage, (signal) =>
			this.#rpc.call(bobbinCoverageSchema, { signal }),
		)
	}

	/** Resolves a handle or DID through Microcosm's typed identity query. */
	resolveIdentity(
		identifier: ComBadExampleIdentityResolveMiniDoc.$params['identifier'],
		options: RequestOptions = {},
	): Promise<ComBadExampleIdentityResolveMiniDoc.$output> {
		return this.#cached(
			'com.bad-example.identity.resolveMiniDoc',
			{ identifier },
			options,
			STALE_TIMES.identity,
			(signal) => this.#rpc.call(ComBadExampleIdentityResolveMiniDoc, { params: { identifier }, signal }),
		)
	}

	/** Fetches and validates one Tangled actor profile record. */
	async getProfile(
		actor: ShTangledActorGetProfile.$params['actor'],
		options: RequestOptions = {},
	): Promise<ValidatedRecordView<ShTangledActorProfile.Main>> {
		const view = await this.#cached('sh.tangled.actor.getProfile', { actor }, options, STALE_TIMES.record, (signal) =>
			this.#rpc.call(ShTangledActorGetProfile, { params: { actor }, signal }),
		)

		return validateRecordView(view, ShTangledActorProfile.mainSchema, 'actor profile')
	}

	/** Fetches and validates one Tangled repository record. */
	async getRepo(
		repo: ShTangledRepoGetRepo.$params['repo'],
		options: RequestOptions = {},
	): Promise<ValidatedRecordView<ShTangledRepo.Main>> {
		const view = await this.#cached('sh.tangled.repo.getRepo', { repo }, options, STALE_TIMES.record, (signal) =>
			this.#rpc.call(ShTangledRepoGetRepo, { params: { repo }, signal }),
		)

		return validateRecordView(view, ShTangledRepo.mainSchema, 'repository')
	}

	/** Fetches and validates one repository by its repository DID. */
	async getRepoByRepoDid(
		repoDid: ShTangledRepoGetRepoByRepoDid.$params['repoDid'],
		options: RequestOptions = {},
	): Promise<ValidatedRecordView<ShTangledRepo.Main>> {
		const view = await this.#cached(
			'sh.tangled.repo.getRepoByRepoDid',
			{ repoDid },
			options,
			STALE_TIMES.record,
			(signal) => this.#rpc.call(ShTangledRepoGetRepoByRepoDid, { params: { repoDid }, signal }),
		)

		return validateRecordView(view, ShTangledRepo.mainSchema, 'repository')
	}

	/** Fetches and validates repository records in one ordered batch. */
	async getRepos(
		repos: ShTangledRepoGetRepos.$params['repos'],
		options: RequestOptions = {},
	): Promise<ValidatedRecordView<ShTangledRepo.Main>[]> {
		const data = await this.#cached('sh.tangled.repo.getRepos', { repos }, options, STALE_TIMES.record, (signal) =>
			this.#rpc.call(ShTangledRepoGetRepos, { params: { repos }, signal }),
		)

		return data.items.map((item) => validateRecordView(item, ShTangledRepo.mainSchema, 'repository'))
	}

	/** Lists an actor's repositories and validates every embedded record. */
	async listRepos(
		subject: ShTangledRepoListRepos.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledRepo.Main>>> {
		const parameters = { subject, cursor: options.cursor, limit: options.limit, order: options.order }
		const data = await this.#cached('sh.tangled.repo.listRepos', parameters, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledRepoListRepos, { params: parameters, signal }),
		)

		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledRepo.mainSchema, 'repository list item')),
			cursor: data.cursor,
		}
	}

	/**
	 * Searches Bobbin and requires a schema for each collection the caller accepts.
	 * Unknown collections fail closed instead of exposing an unvalidated value.
	 */
	async search<TSchemas extends Readonly<Record<string, BaseSchema>>>(
		params: SearchParams,
		schemas: TSchemas,
		options: RequestOptions = {},
	): Promise<CursorPage<ValidatedSearchHit<InferInput<TSchemas[keyof TSchemas]>>>> {
		if (!is(ShTangledSearchQuery.mainSchema.params, params)) {
			throw new BobbinError('invalid-request', 'The search parameters are invalid')
		}
		const data = await this.#cached('sh.tangled.search.query', params, options, STALE_TIMES.search, (signal) =>
			this.#rpc.get('sh.tangled.search.query', { params, signal }),
		)
		const validated = validateSearchResponse(data)

		return {
			items: validated.hits.map((hit) => {
				const schema = schemas[hit.nsid]
				if (schema === undefined) {
					throw new BobbinError('malformed-response', `Bobbin returned an unsupported search record: ${hit.nsid}`)
				}

				return {
					uri: hit.uri,
					cid: hit.cid,
					nsid: hit.nsid,
					score: hit.score,
					value: validateEmbeddedRecord(schema, hit.value, `search hit ${hit.uri}`),
				}
			}),
			cursor: validated.cursor,
		}
	}

	/** Queries a knot's public owner through Bobbin's documented parameter overlay. */
	getKnotOwner(knot: string, options: RequestOptions = {}) {
		return this.#cached('sh.tangled.owner', { knot }, options, STALE_TIMES.diagnostics, (signal) =>
			this.#rpc.call(bobbinKnotOwnerSchema, { params: { knot }, signal }),
		)
	}

	/** Queries a knot's public version through Bobbin's documented parameter overlay. */
	getKnotVersion(knot: string, options: RequestOptions = {}) {
		return this.#cached('sh.tangled.knot.version', { knot }, options, STALE_TIMES.diagnostics, (signal) =>
			this.#rpc.call(bobbinKnotVersionSchema, { params: { knot }, signal }),
		)
	}

	/** Lists a knot's public keys through Bobbin's documented parameter overlay. */
	listKnotKeys(knot: string, params: { cursor?: string; limit?: number } = {}, options: RequestOptions = {}) {
		const parameters = { knot, ...params }
		return this.#cached('sh.tangled.knot.listKeys', parameters, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(bobbinKnotListKeysSchema, { params: parameters, signal }),
		)
	}

	async #cached<TResponse extends XrpcResponse<unknown>>(
		nsid: string,
		parameters: unknown,
		options: RequestOptions,
		staleTimeMs: number,
		request: (signal: AbortSignal) => Promise<TResponse>,
	): Promise<SuccessData<TResponse>> {
		try {
			return await this.#cache.get(
				createRequestKey(nsid, parameters),
				(signal) => this.#request(() => request(signal)),
				{ force: options.cache === 'reload', signal: options.signal, staleTimeMs },
			)
		} catch (error) {
			throw errorFromException(error)
		}
	}

	async #request<TResponse extends XrpcResponse<unknown>>(
		request: () => Promise<TResponse>,
	): Promise<SuccessData<TResponse>> {
		try {
			const response = await request()
			if (!response.ok) {
				throw errorFromResponse(response)
			}
			return response.data as SuccessData<TResponse>
		} catch (error) {
			throw errorFromException(error)
		}
	}
}

/** Creates a Bobbin boundary with the default service and browser fetch. */
export function createBobbinClient(options: BobbinClientOptions = {}): BobbinClient {
	return new BobbinClient(options)
}

/** Validates an embedded record value with an atcute-generated schema. */
export function validateEmbeddedRecord<const TSchema extends BaseSchema>(
	schema: TSchema,
	value: unknown,
	context: string,
): InferInput<TSchema> {
	if (!is(schema, value)) {
		throw new BobbinError('malformed-response', `Bobbin returned an invalid ${context}`)
	}
	return value
}

/** Normalizes and validates a configurable Bobbin base URL. */
export function normalizeBobbinService(service: string | URL): string {
	const url = new URL(service)
	if (url.protocol !== 'https:') {
		throw new TypeError('Data source addresses must use HTTPS')
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new TypeError('Data source addresses cannot contain credentials, a query, or a page fragment')
	}

	return url.toString().replace(/\/$/, '')
}

function validateRecordView<const TSchema extends BaseSchema>(
	view: { uri: string; cid?: string; value: unknown },
	schema: TSchema,
	context: string,
): ValidatedRecordView<InferInput<TSchema>> {
	return { uri: view.uri, cid: view.cid, value: validateEmbeddedRecord(schema, view.value, context) }
}

/**
 * Validates the search envelope around embedded record values.
 *
 * The published schema uses an AT Protocol `unknown` value for Bobbin's
 * floating-point score. atcute correctly limits that type to objects, while
 * Bobbin returns a JSON number, so the compatibility check stays local here.
 */
function validateSearchResponse(data: unknown): BobbinSearchResponse {
	if (typeof data !== 'object' || data === null || !('hits' in data)) {
		throw new BobbinError('malformed-response', 'Bobbin returned invalid search results')
	}
	const result = data as Record<string, unknown>
	if (!Array.isArray(result.hits) || (result.cursor !== undefined && typeof result.cursor !== 'string')) {
		throw new BobbinError('malformed-response', 'Bobbin returned invalid search results')
	}

	for (const hit of result.hits) {
		if (
			typeof hit !== 'object' ||
			hit === null ||
			!is(v.resourceUriString(), hit.uri) ||
			!is(v.nsidString(), hit.nsid) ||
			(hit.cid !== undefined && !is(v.cidString(), hit.cid)) ||
			typeof hit.score !== 'number' ||
			!Number.isFinite(hit.score) ||
			typeof hit.value !== 'object' ||
			hit.value === null
		) {
			throw new BobbinError('malformed-response', 'Bobbin returned an invalid search hit')
		}
	}

	return result as unknown as BobbinSearchResponse
}
