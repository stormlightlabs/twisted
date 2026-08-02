import { Client, simpleFetchHandler } from '@atcute/client'
import type { BaseSchema, InferInput } from '@atcute/lexicons/validations'
import * as v from '@atcute/lexicons/validations'
import { is } from '@atcute/lexicons'
import { ComBadExampleIdentityResolveMiniDoc } from '@atcute/microcosm'
import { ComAtprotoRepoGetRecord } from '@atcute/atproto'
import {
	ShTangledFeedComment,
	ShTangledFeedCountComments,
	ShTangledFeedCountReactions,
	ShTangledFeedCountStars,
	ShTangledFeedCountStarsBy,
	ShTangledFeedListComments,
	ShTangledFeedListCommentsBy,
	ShTangledFeedListReactions,
	ShTangledFeedListReactionsBy,
	ShTangledFeedListStars,
	ShTangledFeedListStarsBy,
	ShTangledFeedReaction,
	ShTangledFeedStar,
	ShTangledGitListRefUpdates,
	ShTangledGitListRefUpdatesBy,
	ShTangledGitRefUpdate,
	ShTangledGraphFollow,
	ShTangledGraphCountFollows,
	ShTangledGraphCountFollowsBy,
	ShTangledGraphCountVouches,
	ShTangledGraphCountVouchesBy,
	ShTangledGraphListFollows,
	ShTangledGraphListFollowsBy,
	ShTangledGraphListVouches,
	ShTangledGraphListVouchesBy,
	ShTangledGraphVouch,
	ShTangledKnotListMembersBy,
	ShTangledKnot,
	ShTangledKnotListKnots,
	ShTangledKnotListMembers,
	ShTangledLabelDefinition,
	ShTangledLabelListDefinitions,
	ShTangledLabelListOps,
	ShTangledLabelListOpsBy,
	ShTangledLabelOp,
	ShTangledPipeline,
	ShTangledPipelineListPipelines,
	ShTangledPipelineListPipelinesBy,
	ShTangledPipelineListStatuses,
	ShTangledPipelineListStatusesBy,
	ShTangledPipelineStatus,
	ShTangledActorGetProfile,
	ShTangledActorProfile,
	ShTangledRepo,
	ShTangledRepoArchive,
	ShTangledRepoArtifact,
	ShTangledRepoBlob,
	ShTangledRepoBranches,
	ShTangledRepoCompare,
	ShTangledRepoCountIssues,
	ShTangledRepoCountPulls,
	ShTangledRepoCountCollaborators,
	ShTangledRepoCountCollaboratorsBy,
	ShTangledRepoDiff,
	ShTangledRepoGetDefaultBranch,
	ShTangledRepoGetIssue,
	ShTangledRepoGetPull,
	ShTangledRepoGetRepoByRepoDid,
	ShTangledRepoGetRepos,
	ShTangledRepoGetRepo,
	ShTangledRepoIssue,
	ShTangledRepoIssueComment,
	ShTangledRepoIssueListStates,
	ShTangledRepoIssueListStatesBy,
	ShTangledRepoIssueState,
	ShTangledRepoLanguages,
	ShTangledRepoLog,
	ShTangledRepoListArtifactsBy,
	ShTangledRepoListArtifacts,
	ShTangledRepoListCollaborators,
	ShTangledRepoListCollaboratorsBy,
	ShTangledRepoListIssues,
	ShTangledRepoListIssuesBy,
	ShTangledRepoListPulls,
	ShTangledRepoListPullsBy,
	ShTangledRepoListRepos,
	ShTangledRepoPull,
	ShTangledRepoPullComment,
	ShTangledRepoPullListStatuses,
	ShTangledRepoPullListStatusesBy,
	ShTangledRepoPullStatus,
	ShTangledRepoTree,
	ShTangledRepoTags,
	ShTangledSearchQuery,
	ShTangledSpindle,
	ShTangledSpindleMember,
	ShTangledSpindleListMembers,
	ShTangledSpindleListMembersBy,
	ShTangledSpindleListSpindles,
	ShTangledPublicKey,
	ShTangledPublicKeyListKeys,
	ShTangledString,
	ShTangledStringListStrings,
} from '@atcute/tangled'
import {
	bobbinCoverageSchema,
	bobbinKnotListKeysSchema,
	bobbinKnotOwnerSchema,
	bobbinKnotVersionSchema,
	bobbinRepoBlobSchema,
	DEFAULT_BOBBIN_SERVICE,
} from './contracts'
import type { BobbinCoverage } from './contracts'
import { BobbinError, errorFromException, errorFromResponse } from './errors'
import { createRequestKey, RequestCache, STALE_TIMES } from './cache'
import { createRateLimitedFetch } from './request-scheduler'
import { createNormalizedResponseFetch } from './response-normalizer'

/** A Bobbin record view after its embedded value has passed schema validation. */
export type ValidatedRecordView<T> = { uri: string; cid?: string; value: T }

/** One cursor-based page returned by an indexed Bobbin query. */
export type CursorPage<T> = { items: T[]; cursor?: string }

export type CountSummary = { count: number; distinctAuthors: number }

export type IssueListItem = Omit<ShTangledRepoListIssues.IssueListItem, 'value'> & { value: ShTangledRepoIssue.Main }

export type PullListItem = Omit<ShTangledRepoListPulls.PullListItem, 'value'> & { value: ShTangledRepoPull.Main }

export type TangledComment = ShTangledFeedComment.Main | ShTangledRepoIssueComment.Main | ShTangledRepoPullComment.Main

export const actorActivityKinds = [
	'comments',
	'reactions',
	'stars',
	'follows',
	'vouches',
	'issues',
	'pulls',
	'issue-states',
	'pull-statuses',
	'ref-updates',
	'collaborators',
	'label-operations',
	'pipelines',
	'pipeline-statuses',
	'artifacts',
	'knot-memberships',
	'spindle-memberships',
] as const

export type ActorActivityKind = (typeof actorActivityKinds)[number]

export type ActorActivityItem = { cid?: string; uri?: string; value: Record<string, unknown> }

type TState = 'open' | 'closed'

export type ActorActivityOptions = ListReposOptions & { state?: TState; status?: TState | 'merged' }

export type AuthoredRelationshipKind = 'collaborators' | 'follows' | 'stars' | 'vouches'

export type RepositoryCounts = { issues: number; pulls: number; stars: number }

export const MAX_TEXT_BLOB_BYTES = 512 * 1024
export const MAX_RENDERED_PATCH_BYTES = 512 * 1024

export type RepositoryPatch =
	| { kind: 'patch'; bytes: number; text: string; contentType?: string; filename?: string }
	| { kind: 'too-large'; bytes?: number; contentType?: string; filename?: string }

export type RepositoryArchiveFormat = Extract<ShTangledRepoArchive.$params['format'], 'tar.gz' | 'zip'>

export type RepositoryArchiveOptions = RequestOptions & {
	format?: RepositoryArchiveFormat
	prefix?: string
	range?: string
	ref?: string
}

export type RepositoryDownload = {
	body: ReadableStream<Uint8Array> | null
	cacheControl?: string
	contentLength?: number
	contentRange?: string
	contentType?: string
	etag?: string
	filename?: string
	lastModified?: string
	status: number
}

export type PublicRecordKind = 'artifact' | 'string'

export type RepositorySignature = { email?: string; name: string; when?: string }

export type RepositoryBranch = {
	author?: RepositorySignature
	hash: string
	isDefault: boolean
	message?: string
	name: string
	when?: string
}

export type RepositoryTag = { hash: string; message?: string; name: string; tagger?: RepositorySignature }

export type RepositoryCommit = {
	author?: RepositorySignature
	committer?: RepositorySignature
	hash: string
	message: string
	parents: readonly string[]
	tree?: string
}

export type RepositoryLogPage = CursorPage<RepositoryCommit> & { ref: string; total?: number }

export type RepositoryRefOptions = RequestOptions & { cursor?: string; limit?: number }

export type RepositoryLogOptions = RepositoryRefOptions & { path?: string; ref: string }

type ActorDid = ShTangledRepoListIssuesBy.$params['subject']

/** Constructor options for a configurable, testable Bobbin boundary. */
export type BobbinClientOptions = { cache?: RequestCache; service?: string | URL; fetch?: typeof globalThis.fetch }

/** Options shared by abortable Bobbin requests. */
export type RequestOptions = { cache?: 'default' | 'reload'; signal?: AbortSignal }

/** Parameters accepted by the repository list endpoint. */
export type ListReposOptions = RequestOptions & { cursor?: string; limit?: number; order?: 'asc' | 'desc' }

export type IssueListOptions = ListReposOptions & {
	author?: ShTangledRepoListIssues.$params['author']
	state?: 'open' | 'closed'
}

export type PullListOptions = ListReposOptions & {
	author?: ShTangledRepoListPulls.$params['author']
	status?: 'open' | 'closed' | 'merged'
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

type SearchHit = { uri: string; cid?: string; nsid: string; score: number; value: Record<string, unknown> }

type BobbinSearchResponse = { cursor?: string; hits: Array<SearchHit> }

const defaultBobbinFetch = createRateLimitedFetch((input, init) => globalThis.fetch(input, init))

/**
 * The read-only XRPC boundary used by Twisted views and feature modules.
 *
 * Published endpoints use atcute's generated query schemas. Methods that return
 * embedded records perform a second validation step with the record schema.
 */
export class BobbinClient {
	readonly service: string
	readonly #cache: RequestCache
	readonly #fetch: typeof globalThis.fetch
	readonly #rpc: Client

	constructor(options: BobbinClientOptions = {}) {
		this.service = normalizeBobbinService(options.service ?? DEFAULT_BOBBIN_SERVICE)
		this.#cache = options.cache ?? new RequestCache()
		this.#fetch = createNormalizedResponseFetch(options.fetch ?? defaultBobbinFetch)
		this.#rpc = new Client({ handler: simpleFetchHandler({ service: this.service, fetch: this.#fetch }) })
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

		return validateRecordView(
			{ ...view, value: normalizeProfilePlaceholders(view.value) },
			ShTangledActorProfile.mainSchema,
			'actor profile',
		)
	}

	/** Fetches a public profile image through CORS so it can be displayed under COEP. */
	async getProfileAvatar(pds: string, did: string, cid: string, options: RequestOptions = {}): Promise<Blob> {
		let url: URL
		try {
			url = new URL('/xrpc/com.atproto.sync.getBlob', pds)
		} catch (error) {
			throw new BobbinError('invalid-request', 'The profile image address is invalid', { cause: error })
		}
		if (url.protocol !== 'https:') throw new BobbinError('invalid-request', 'Profile images must use HTTPS')
		url.searchParams.set('did', did)
		url.searchParams.set('cid', cid)

		try {
			const response = await this.#fetch(url, {
				credentials: 'omit',
				mode: 'cors',
				referrerPolicy: 'no-referrer',
				signal: options.signal,
			})
			if (!response.ok) {
				throw new BobbinError(
					response.status === 404 ? 'not-found' : 'service-unavailable',
					'The profile image is unavailable',
					{ status: response.status },
				)
			}
			const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
			if (!contentType?.startsWith('image/')) {
				throw new BobbinError('malformed-response', 'The profile image has an unsupported format')
			}
			const blob = await response.blob()
			if (blob.size > 5 * 1024 * 1024) throw new BobbinError('malformed-response', 'The profile image is too large')
			return blob
		} catch (error) {
			throw errorFromException(error)
		}
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

	async getIssue(
		issue: ShTangledRepoGetIssue.$params['issue'],
		options: RequestOptions = {},
	): Promise<ValidatedRecordView<ShTangledRepoIssue.Main>> {
		const view = await this.#cached('sh.tangled.repo.getIssue', { issue }, options, STALE_TIMES.record, (signal) =>
			this.#rpc.call(ShTangledRepoGetIssue, { params: { issue }, signal }),
		)
		return validateRecordView(view, ShTangledRepoIssue.mainSchema, 'issue')
	}

	async listIssues(
		subject: ShTangledRepoListIssues.$params['subject'],
		options: IssueListOptions = {},
	): Promise<CursorPage<IssueListItem>> {
		const params = pickListParams(subject, options, { author: options.author, state: options.state })
		const data = await this.#cached('sh.tangled.repo.listIssues', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledRepoListIssues, { params, signal }),
		)
		return {
			items: data.items.map((item) => ({
				...item,
				value: validateEmbeddedRecord(ShTangledRepoIssue.mainSchema, item.value, `issue ${item.uri}`),
			})),
			cursor: data.cursor,
		}
	}

	async getPull(
		pull: ShTangledRepoGetPull.$params['pull'],
		options: RequestOptions = {},
	): Promise<ValidatedRecordView<ShTangledRepoPull.Main>> {
		const view = await this.#cached('sh.tangled.repo.getPull', { pull }, options, STALE_TIMES.record, (signal) =>
			this.#rpc.call(ShTangledRepoGetPull, { params: { pull }, signal }),
		)
		return validateRecordView(view, ShTangledRepoPull.mainSchema, 'pull request')
	}

	async listPulls(
		subject: ShTangledRepoListPulls.$params['subject'],
		options: PullListOptions = {},
	): Promise<CursorPage<PullListItem>> {
		const params = pickListParams(subject, options, { author: options.author, status: options.status })
		const data = await this.#cached('sh.tangled.repo.listPulls', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledRepoListPulls, { params, signal }),
		)
		return {
			items: data.items.map((item) => ({
				...item,
				value: validateEmbeddedRecord(ShTangledRepoPull.mainSchema, item.value, `pull request ${item.uri}`),
			})),
			cursor: data.cursor,
		}
	}

	async listComments(
		subject: ShTangledFeedListComments.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<TangledComment>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.feed.listComments', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledFeedListComments, { params, signal }),
		)
		return { items: data.items.map((item) => validateCommentView(item)), cursor: data.cursor }
	}

	async listReactions(
		subject: ShTangledFeedListReactions.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledFeedReaction.Main>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.feed.listReactions', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledFeedListReactions, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledFeedReaction.mainSchema, 'reaction')),
			cursor: data.cursor,
		}
	}

	async listIssueStates(
		subject: ShTangledRepoIssueListStates.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledRepoIssueState.Main>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.repo.issue.listStates', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledRepoIssueListStates, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledRepoIssueState.mainSchema, 'issue state')),
			cursor: data.cursor,
		}
	}

	async listPullStatuses(
		subject: ShTangledRepoPullListStatuses.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledRepoPullStatus.Main>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.repo.pull.listStatuses', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledRepoPullListStatuses, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledRepoPullStatus.mainSchema, 'pull status')),
			cursor: data.cursor,
		}
	}

	countComments(
		subject: ShTangledFeedCountComments.$params['subject'],
		options: RequestOptions = {},
	): Promise<CountSummary> {
		return this.#count('sh.tangled.feed.countComments', subject, options, (signal) =>
			this.#rpc.call(ShTangledFeedCountComments, { params: { subject }, signal }),
		)
	}

	countReactions(
		subject: ShTangledFeedCountReactions.$params['subject'],
		options: RequestOptions = {},
	): Promise<CountSummary> {
		return this.#count('sh.tangled.feed.countReactions', subject, options, (signal) =>
			this.#rpc.call(ShTangledFeedCountReactions, { params: { subject }, signal }),
		)
	}

	/** Lists one actor-authored record family through its generated reverse-lookup schema. */
	async listActorActivity(
		kind: ActorActivityKind,
		subject: ActorDid,
		options: ActorActivityOptions = {},
	): Promise<CursorPage<ActorActivityItem>> {
		const params = { subject, cursor: options.cursor, limit: options.limit ?? 10, order: options.order ?? 'desc' }
		switch (kind) {
			case 'comments':
				return this.#actorRecords(kind, params, options, ShTangledFeedComment.mainSchema, (signal) =>
					this.#rpc.call(ShTangledFeedListCommentsBy, { params, signal }),
				)
			case 'reactions':
				return this.#actorRecords(kind, params, options, ShTangledFeedReaction.mainSchema, (signal) =>
					this.#rpc.call(ShTangledFeedListReactionsBy, { params, signal }),
				)
			case 'stars':
				return this.#actorRecords(kind, params, options, ShTangledFeedStar.mainSchema, (signal) =>
					this.#rpc.call(ShTangledFeedListStarsBy, { params, signal }),
				)
			case 'follows':
				return this.#actorRecords(kind, params, options, ShTangledGraphFollow.mainSchema, (signal) =>
					this.#rpc.call(ShTangledGraphListFollowsBy, { params, signal }),
				)
			case 'vouches':
				return this.#actorRecords(kind, params, options, ShTangledGraphVouch.mainSchema, (signal) =>
					this.#rpc.call(ShTangledGraphListVouchesBy, { params, signal }),
				)
			case 'issues': {
				const filtered = { ...params, state: options.state }
				return this.#actorRecords(kind, filtered, options, ShTangledRepoIssue.mainSchema, (signal) =>
					this.#rpc.call(ShTangledRepoListIssuesBy, { params: filtered, signal }),
				)
			}
			case 'pulls': {
				const filtered = { ...params, status: options.status }
				return this.#actorRecords(kind, filtered, options, ShTangledRepoPull.mainSchema, (signal) =>
					this.#rpc.call(ShTangledRepoListPullsBy, { params: filtered, signal }),
				)
			}
			case 'issue-states':
				return this.#actorRecords(kind, params, options, ShTangledRepoIssueState.mainSchema, (signal) =>
					this.#rpc.call(ShTangledRepoIssueListStatesBy, { params, signal }),
				)
			case 'pull-statuses':
				return this.#actorRecords(kind, params, options, ShTangledRepoPullStatus.mainSchema, (signal) =>
					this.#rpc.call(ShTangledRepoPullListStatusesBy, { params, signal }),
				)
			case 'ref-updates':
				return this.#actorRecords(kind, params, options, ShTangledGitRefUpdate.mainSchema, (signal) =>
					this.#rpc.call(ShTangledGitListRefUpdatesBy, { params, signal }),
				)
			case 'collaborators':
				return this.#actorRecords(kind, params, options, undefined, (signal) =>
					this.#rpc.call(ShTangledRepoListCollaboratorsBy, { params, signal }),
				)
			case 'label-operations':
				return this.#actorRecords(kind, params, options, ShTangledLabelOp.mainSchema, (signal) =>
					this.#rpc.call(ShTangledLabelListOpsBy, { params, signal }),
				)
			case 'pipelines':
				return this.#actorRecords(kind, params, options, ShTangledPipeline.mainSchema, (signal) =>
					this.#rpc.call(ShTangledPipelineListPipelinesBy, { params, signal }),
				)
			case 'pipeline-statuses':
				return this.#actorRecords(kind, params, options, ShTangledPipelineStatus.mainSchema, (signal) =>
					this.#rpc.call(ShTangledPipelineListStatusesBy, { params, signal }),
				)
			case 'artifacts':
				return this.#actorRecords(kind, params, options, ShTangledRepoArtifact.mainSchema, (signal) =>
					this.#rpc.call(ShTangledRepoListArtifactsBy, { params, signal }),
				)
			case 'knot-memberships':
				return this.#actorRecords(kind, params, options, undefined, (signal) =>
					this.#rpc.call(ShTangledKnotListMembersBy, { params, signal }),
				)
			case 'spindle-memberships':
				return this.#actorRecords(kind, params, options, undefined, (signal) =>
					this.#rpc.call(ShTangledSpindleListMembersBy, { params, signal }),
				)
		}
	}

	getRepositoryLanguages(repo: ShTangledRepoLanguages.$params['repo'], options: RequestOptions = {}) {
		return this.#cached('sh.tangled.repo.languages', { repo, ref: 'HEAD' }, options, STALE_TIMES.record, (signal) =>
			this.#rpc.call(ShTangledRepoLanguages, { params: { repo, ref: 'HEAD' }, signal }),
		)
	}

	getRepositoryTree(
		repo: ShTangledRepoTree.$params['repo'],
		params: { path?: string; ref?: string } = {},
		options: RequestOptions = {},
	) {
		const request = { repo, ref: params.ref ?? 'HEAD', path: params.path ?? '' }
		return this.#cached('sh.tangled.repo.tree', request, options, STALE_TIMES.record, (signal) =>
			this.#rpc.call(ShTangledRepoTree, { params: request, signal }),
		)
	}

	getRepositoryBlob(
		repo: string,
		ref: ShTangledRepoBlob.$params['ref'],
		path: ShTangledRepoBlob.$params['path'],
		options: RequestOptions = {},
	) {
		const params = { repo, ref, path, raw: false }
		return this.#cached('sh.tangled.repo.blob', params, options, STALE_TIMES.record, (signal) =>
			this.#rpc.call(bobbinRepoBlobSchema, { params, signal }),
		)
	}

	getRepositoryDefaultBranch(repo: string, options: RequestOptions = {}) {
		return this.#cached('sh.tangled.repo.getDefaultBranch', { repo }, options, STALE_TIMES.record, (signal) =>
			this.#rpc.call(ShTangledRepoGetDefaultBranch, { params: { repo }, signal }),
		)
	}

	async listRepositoryBranches(
		repo: string,
		options: RepositoryRefOptions = {},
	): Promise<CursorPage<RepositoryBranch>> {
		const limit = clampPageSize(options.limit)
		const cursor = parseOffsetCursor(options.cursor)
		const params = { repo, cursor: cursor ? String(cursor) : undefined, limit: limit + 1 }
		const blob = await this.#cached('sh.tangled.repo.branches', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledRepoBranches, { as: 'blob', params, signal }),
		)
		const branches = parseBranches(await parseJsonBlob(blob, 'branches'))
		return { items: branches.slice(0, limit), cursor: branches.length > limit ? String(cursor + limit) : undefined }
	}

	async listRepositoryTags(repo: string, options: RepositoryRefOptions = {}): Promise<CursorPage<RepositoryTag>> {
		const limit = clampPageSize(options.limit)
		const cursor = parseOffsetCursor(options.cursor)
		const params = { repo, cursor: cursor ? String(cursor) : undefined, limit: limit + 1 }
		const blob = await this.#cached('sh.tangled.repo.tags', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledRepoTags, { as: 'blob', params, signal }),
		)
		const tags = parseTags(await parseJsonBlob(blob, 'tags'))
		return { items: tags.slice(0, limit), cursor: tags.length > limit ? String(cursor + limit) : undefined }
	}

	async getRepositoryLog(repo: string, options: RepositoryLogOptions): Promise<RepositoryLogPage> {
		const limit = Math.min(100, Math.max(1, options.limit ?? 20))
		const page = Math.max(1, Number.parseInt(options.cursor ?? '1', 10) || 1)
		const params = { repo, ref: options.ref, path: options.path ?? '', cursor: String(page), limit }
		const blob = await this.#cached('sh.tangled.repo.log', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledRepoLog, { as: 'blob', params, signal }),
		)
		return parseRepositoryLog(await parseJsonBlob(blob, 'commit history'), options.ref, page, limit)
	}

	getRepositoryDiff(repo: string, ref: string, options: RequestOptions = {}): Promise<RepositoryPatch> {
		const params = { repo, ref }
		if (!is(ShTangledRepoDiff.mainSchema.params, params)) {
			return Promise.reject(new BobbinError('invalid-request', 'The repository revision is invalid'))
		}
		return this.#getRepositoryPatch(this.repositoryDiffUrl(repo, ref), options)
	}

	getRepositoryCompare(
		repo: string,
		base: string,
		head: string,
		options: RequestOptions = {},
	): Promise<RepositoryPatch> {
		const params = { repo, rev1: base, rev2: head }
		if (!is(ShTangledRepoCompare.mainSchema.params, params)) {
			return Promise.reject(new BobbinError('invalid-request', 'The comparison revisions are invalid'))
		}
		return this.#getRepositoryPatch(this.repositoryCompareUrl(repo, base, head), options)
	}

	repositoryDiffUrl(repo: string, ref: string): string {
		return this.#repositoryQueryUrl('sh.tangled.repo.diff', { repo, ref })
	}

	repositoryCompareUrl(repo: string, base: string, head: string): string {
		return this.#repositoryQueryUrl('sh.tangled.repo.compare', { repo, rev1: base, rev2: head })
	}

	repositoryBlobUrl(repo: string, ref: string, path: string): string {
		const url = new URL('/xrpc/sh.tangled.repo.blob', this.service)
		url.searchParams.set('repo', repo)
		url.searchParams.set('ref', ref)
		url.searchParams.set('path', path)
		url.searchParams.set('raw', 'true')
		return url.href
	}

	async listRepositoryCollaborators(
		subject: ActorDid,
		options: ListReposOptions = {},
	): Promise<CursorPage<ShTangledRepoListCollaborators.ListItem>> {
		const params = pickListParams(subject, { limit: 8, ...options })
		const data = await this.#cached('sh.tangled.repo.listCollaborators', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledRepoListCollaborators, { params, signal }),
		)
		return { items: [...data.items], cursor: data.cursor }
	}

	async listStars(
		subject: ShTangledFeedListStars.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledFeedStar.Main>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.feed.listStars', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledFeedListStars, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledFeedStar.mainSchema, 'star')),
			cursor: data.cursor,
		}
	}

	async listFollows(
		subject: ShTangledGraphListFollows.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledGraphFollow.Main>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.graph.listFollows', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledGraphListFollows, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledGraphFollow.mainSchema, 'follow')),
			cursor: data.cursor,
		}
	}

	async listVouches(
		subject: ShTangledGraphListVouches.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledGraphVouch.Main>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.graph.listVouches', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledGraphListVouches, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledGraphVouch.mainSchema, 'vouch')),
			cursor: data.cursor,
		}
	}

	countStars(subject: ShTangledFeedCountStars.$params['subject'], options: RequestOptions = {}): Promise<CountSummary> {
		return this.#count('sh.tangled.feed.countStars', subject, options, (signal) =>
			this.#rpc.call(ShTangledFeedCountStars, { params: { subject }, signal }),
		)
	}

	countFollows(
		subject: ShTangledGraphCountFollows.$params['subject'],
		options: RequestOptions = {},
	): Promise<CountSummary> {
		return this.#count('sh.tangled.graph.countFollows', subject, options, (signal) =>
			this.#rpc.call(ShTangledGraphCountFollows, { params: { subject }, signal }),
		)
	}

	countVouches(
		subject: ShTangledGraphCountVouches.$params['subject'],
		options: RequestOptions = {},
	): Promise<CountSummary> {
		return this.#count('sh.tangled.graph.countVouches', subject, options, (signal) =>
			this.#rpc.call(ShTangledGraphCountVouches, { params: { subject }, signal }),
		)
	}

	countCollaborators(
		subject: ShTangledRepoCountCollaborators.$params['subject'],
		options: RequestOptions = {},
	): Promise<CountSummary> {
		return this.#count('sh.tangled.repo.countCollaborators', subject, options, (signal) =>
			this.#rpc.call(ShTangledRepoCountCollaborators, { params: { subject }, signal }),
		)
	}

	countAuthoredRelationships(
		kind: AuthoredRelationshipKind,
		subject: ActorDid,
		options: RequestOptions = {},
	): Promise<CountSummary> {
		switch (kind) {
			case 'stars':
				return this.#count('sh.tangled.feed.countStarsBy', subject, options, (signal) =>
					this.#rpc.call(ShTangledFeedCountStarsBy, { params: { subject }, signal }),
				)
			case 'follows':
				return this.#count('sh.tangled.graph.countFollowsBy', subject, options, (signal) =>
					this.#rpc.call(ShTangledGraphCountFollowsBy, { params: { subject }, signal }),
				)
			case 'vouches':
				return this.#count('sh.tangled.graph.countVouchesBy', subject, options, (signal) =>
					this.#rpc.call(ShTangledGraphCountVouchesBy, { params: { subject }, signal }),
				)
			case 'collaborators':
				return this.#count('sh.tangled.repo.countCollaboratorsBy', subject, options, (signal) =>
					this.#rpc.call(ShTangledRepoCountCollaboratorsBy, { params: { subject }, signal }),
				)
		}
	}

	async listRepositoryLabels(subject: string, options: RequestOptions = {}) {
		const params = { subject, limit: 12, order: 'asc' }
		const data = await this.#cached('sh.tangled.label.listDefinitions', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledLabelListDefinitions, { params, signal }),
		)
		return data.items.map((item) => validateRecordView(item, ShTangledLabelDefinition.mainSchema, 'label definition'))
	}

	async listLabelDefinitions(
		subject: string,
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledLabelDefinition.Main>>> {
		assertScopeIdentifier(subject, 'label scope')
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.label.listDefinitions', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledLabelListDefinitions, { params, signal }),
		)
		return {
			items: data.items.map((item) =>
				validateRecordView(item, ShTangledLabelDefinition.mainSchema, 'label definition'),
			),
			cursor: data.cursor,
		}
	}

	async listLabelOperations(
		subject: ShTangledLabelListOps.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledLabelOp.Main>>> {
		assertScopeIdentifier(subject, 'label scope')
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.label.listOps', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledLabelListOps, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledLabelOp.mainSchema, 'label operation')),
			cursor: data.cursor,
		}
	}

	async listPipelines(
		subject: string,
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledPipeline.Main>>> {
		assertScopeIdentifier(subject, 'pipeline subject')
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.pipeline.listPipelines', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledPipelineListPipelines, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledPipeline.mainSchema, 'pipeline')),
			cursor: data.cursor,
		}
	}

	async listPipelineStatuses(
		subject: ShTangledPipelineListStatuses.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledPipelineStatus.Main>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.pipeline.listStatuses', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledPipelineListStatuses, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledPipelineStatus.mainSchema, 'pipeline status')),
			cursor: data.cursor,
		}
	}

	async listArtifacts(
		subject: string,
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledRepoArtifact.Main>>> {
		assertScopeIdentifier(subject, 'artifact subject')
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.repo.listArtifacts', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledRepoListArtifacts, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledRepoArtifact.mainSchema, 'artifact')),
			cursor: data.cursor,
		}
	}

	async listStrings(
		subject: string,
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledString.Main>>> {
		assertScopeIdentifier(subject, 'string scope')
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.string.listStrings', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledStringListStrings, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledString.mainSchema, 'string')),
			cursor: data.cursor,
		}
	}

	getString(uri: string, options: RequestOptions = {}) {
		return this.#getPublicRecord(uri, 'sh.tangled.string', ShTangledString.mainSchema, 'string', options)
	}

	getArtifact(uri: string, options: RequestOptions = {}) {
		return this.#getPublicRecord(uri, 'sh.tangled.repo.artifact', ShTangledRepoArtifact.mainSchema, 'artifact', options)
	}

	getPipeline(uri: string, options: RequestOptions = {}) {
		return this.#getPublicRecord(uri, 'sh.tangled.pipeline', ShTangledPipeline.mainSchema, 'pipeline', options)
	}

	async listRepositoryRefUpdates(subject: ActorDid, options: RequestOptions = {}) {
		const params = { subject, limit: 6, order: 'desc' as const }
		const data = await this.#cached('sh.tangled.git.listRefUpdates', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledGitListRefUpdates, { params, signal }),
		)
		return data.items.map((item) => validateRecordView(item, ShTangledGitRefUpdate.mainSchema, 'ref update'))
	}

	async getRepositoryCounts(subject: ActorDid, options: RequestOptions = {}): Promise<RepositoryCounts> {
		const request = (nsid: string, call: (signal: AbortSignal) => Promise<XrpcResponse<{ count: number }>>) =>
			this.#cached(nsid, { subject }, options, STALE_TIMES.list, call)
		const [stars, issues, pulls] = await Promise.all([
			request('sh.tangled.feed.countStars', (signal) =>
				this.#rpc.call(ShTangledFeedCountStars, { params: { subject }, signal }),
			),
			request('sh.tangled.repo.countIssues', (signal) =>
				this.#rpc.call(ShTangledRepoCountIssues, { params: { subject }, signal }),
			),
			request('sh.tangled.repo.countPulls', (signal) =>
				this.#rpc.call(ShTangledRepoCountPulls, { params: { subject }, signal }),
			),
		])
		return { stars: stars.count, issues: issues.count, pulls: pulls.count }
	}

	repositoryArchiveUrl(
		repo: ShTangledRepoArchive.$params['repo'],
		format: RepositoryArchiveFormat = 'tar.gz',
		ref = 'HEAD',
		prefix?: string,
	): string {
		return this.#repositoryQueryUrl('sh.tangled.repo.archive', { repo, ref, format, prefix })
	}

	async getRepositoryArchive(repo: string, options: RepositoryArchiveOptions = {}): Promise<RepositoryDownload> {
		const params = { repo, ref: options.ref ?? 'HEAD', format: options.format ?? 'tar.gz', prefix: options.prefix }
		if (!is(ShTangledRepoArchive.mainSchema.params, params)) {
			throw new BobbinError('invalid-request', 'The archive request is invalid')
		}

		const headers: Record<string, string> = {}
		if (options.range) headers.range = options.range

		try {
			const response = await this.#fetch(this.repositoryArchiveUrl(repo, params.format, params.ref, params.prefix), {
				headers,
				signal: options.signal,
				cache: options.cache === 'reload' ? 'reload' : 'default',
				credentials: 'omit',
				mode: 'cors',
				referrerPolicy: 'no-referrer',
			})
			if (!response.ok && response.status !== 304) throw await responseError(response)
			return downloadMetadata(response)
		} catch (error) {
			throw errorFromException(error)
		}
	}

	async artifactDownloadUrl(uri: string, options: RequestOptions = {}): Promise<string> {
		const record = await this.getArtifact(uri, options)
		const author = parseRecordUri(uri).authority
		const identity = await this.resolveIdentity(
			author as ComBadExampleIdentityResolveMiniDoc.$params['identifier'],
			options,
		)
		const blob = record.value.artifact
		const cid = '$type' in blob ? blob.ref.$link : blob.cid
		return publicBlobUrl(identity.pds, author, cid)
	}

	async getArtifactDownload(
		uri: string,
		options: RequestOptions & { range?: string } = {},
	): Promise<RepositoryDownload> {
		const url = await this.artifactDownloadUrl(uri, options)
		const headers: Record<string, string> = {}
		if (options.range) headers.range = options.range
		try {
			const response = await this.#fetch(url, {
				headers,
				signal: options.signal,
				cache: options.cache === 'reload' ? 'reload' : 'default',
				credentials: 'omit',
				mode: 'cors',
				referrerPolicy: 'no-referrer',
			})
			if (!response.ok && response.status !== 304) throw await responseError(response)
			return downloadMetadata(response)
		} catch (error) {
			throw errorFromException(error)
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
		assertScopeIdentifier(knot, 'knot identifier')
		return this.#cached('sh.tangled.owner', { knot }, options, STALE_TIMES.diagnostics, (signal) =>
			this.#rpc.call(bobbinKnotOwnerSchema, { params: { knot }, signal }),
		)
	}

	/** Queries a knot's public version through Bobbin's documented parameter overlay. */
	getKnotVersion(knot: string, options: RequestOptions = {}) {
		assertScopeIdentifier(knot, 'knot identifier')
		return this.#cached('sh.tangled.knot.version', { knot }, options, STALE_TIMES.diagnostics, (signal) =>
			this.#rpc.call(bobbinKnotVersionSchema, { params: { knot }, signal }),
		)
	}

	/** Lists a knot's public keys through Bobbin's documented parameter overlay. */
	listKnotKeys(knot: string, params: { cursor?: string; limit?: number } = {}, options: RequestOptions = {}) {
		assertScopeIdentifier(knot, 'knot identifier')
		const parameters = { knot, ...params }
		return this.#cached('sh.tangled.knot.listKeys', parameters, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(bobbinKnotListKeysSchema, { params: parameters, signal }),
		)
	}

	async listKnots(
		subject: ShTangledKnotListKnots.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledKnot.Main>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.knot.listKnots', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledKnotListKnots, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledKnot.mainSchema, 'knot')),
			cursor: data.cursor,
		}
	}

	listKnotMembers(subject: string, options: ListReposOptions = {}) {
		assertScopeIdentifier(subject, 'knot identifier')
		const params = pickListParams(subject, options)
		return this.#cached('sh.tangled.knot.listMembers', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledKnotListMembers, { params, signal }),
		)
	}

	async listSpindles(
		subject: ShTangledSpindleListSpindles.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledSpindle.Main>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.spindle.listSpindles', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledSpindleListSpindles, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledSpindle.mainSchema, 'spindle')),
			cursor: data.cursor,
		}
	}

	async listSpindleMembers(subject: string, options: ListReposOptions = {}) {
		assertScopeIdentifier(subject, 'spindle identifier')
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.spindle.listMembers', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledSpindleListMembers, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledSpindleMember.mainSchema, 'spindle member')),
			cursor: data.cursor,
		}
	}

	async listPublicKeys(
		subject: ShTangledPublicKeyListKeys.$params['subject'],
		options: ListReposOptions = {},
	): Promise<CursorPage<ValidatedRecordView<ShTangledPublicKey.Main>>> {
		const params = pickListParams(subject, options)
		const data = await this.#cached('sh.tangled.publicKey.listKeys', params, options, STALE_TIMES.list, (signal) =>
			this.#rpc.call(ShTangledPublicKeyListKeys, { params, signal }),
		)
		return {
			items: data.items.map((item) => validateRecordView(item, ShTangledPublicKey.mainSchema, 'public key')),
			cursor: data.cursor,
		}
	}

	async #getPublicRecord<const TSchema extends BaseSchema>(
		uri: string,
		collection: string,
		schema: TSchema,
		context: string,
		options: RequestOptions,
	): Promise<ValidatedRecordView<InferInput<TSchema>>> {
		const record = parseRecordUri(uri)
		if (record.collection !== collection) throw new BobbinError('invalid-request', `The ${context} link is invalid`)
		const identity = await this.resolveIdentity(
			record.authority as ComBadExampleIdentityResolveMiniDoc.$params['identifier'],
			options,
		)
		const pds = normalizePublicPds(identity.pds)
		const params = { repo: record.authority, collection, rkey: record.rkey }
		const data = await this.#cached(
			`pds:${pds}:com.atproto.repo.getRecord`,
			params,
			options,
			STALE_TIMES.record,
			(signal) =>
				new Client({ handler: simpleFetchHandler({ service: pds, fetch: this.#fetch }) }).call(
					ComAtprotoRepoGetRecord,
					{ params: params as ComAtprotoRepoGetRecord.$params, signal },
				),
		)
		return validateRecordView(data, schema, context)
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
				createRequestKey(`${this.service}:${nsid}`, parameters),
				(signal) => this.#request(() => request(signal)),
				{ force: options.cache === 'reload', signal: options.signal, staleTimeMs },
			)
		} catch (error) {
			throw errorFromException(error)
		}
	}

	async #actorRecords<const TSchema extends BaseSchema>(
		kind: ActorActivityKind,
		parameters: Record<string, unknown>,
		options: RequestOptions,
		schema: TSchema | undefined,
		request: (
			signal: AbortSignal,
		) => Promise<XrpcResponse<{ items: readonly { uri?: string; cid?: string; value?: unknown }[]; cursor?: string }>>,
	): Promise<CursorPage<ActorActivityItem>> {
		const data = await this.#cached(`actor:${kind}`, parameters, options, STALE_TIMES.list, request)
		return {
			items: data.items.map((item) => ({
				uri: item.uri,
				cid: item.cid,
				value:
					schema && item.value !== undefined
						? (validateEmbeddedRecord(schema, item.value, `${kind} activity`) as Record<string, unknown>)
						: (item as Record<string, unknown>),
			})),
			cursor: data.cursor,
		}
	}

	#count<TResponse extends XrpcResponse<CountSummary>>(
		nsid: string,
		subject: string,
		options: RequestOptions,
		request: (signal: AbortSignal) => Promise<TResponse>,
	): Promise<SuccessData<TResponse>> {
		return this.#cached(nsid, { subject }, options, STALE_TIMES.list, request)
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

	async #getRepositoryPatch(url: string, options: RequestOptions): Promise<RepositoryPatch> {
		try {
			const response = await this.#fetch(url, {
				headers: { accept: 'text/x-diff, text/plain;q=0.9, application/octet-stream;q=0.5' },
				signal: options.signal,
				cache: options.cache === 'reload' ? 'reload' : 'default',
				credentials: 'omit',
				mode: 'cors',
				referrerPolicy: 'no-referrer',
			})
			if (!response.ok) throw await responseError(response)

			const metadata = downloadMetadata(response)
			if (metadata.contentLength !== undefined && metadata.contentLength > MAX_RENDERED_PATCH_BYTES) {
				await response.body?.cancel()
				return {
					kind: 'too-large',
					bytes: metadata.contentLength,
					contentType: metadata.contentType,
					filename: metadata.filename,
				}
			}

			const reader = response.body?.getReader()
			if (!reader) return { kind: 'patch', bytes: 0, text: '', contentType: metadata.contentType }
			const decoder = new TextDecoder()
			let bytes = 0
			let text = ''
			for (;;) {
				const { done, value } = await reader.read()
				if (done) break
				bytes += value.byteLength
				if (bytes > MAX_RENDERED_PATCH_BYTES) {
					await reader.cancel()
					return { kind: 'too-large', bytes, contentType: metadata.contentType, filename: metadata.filename }
				}
				text += decoder.decode(value, { stream: true })
			}
			text += decoder.decode()
			if (metadata.contentType?.toLowerCase().includes('json')) text = normalizeRepositoryPatch(text)
			return { kind: 'patch', bytes, text, contentType: metadata.contentType, filename: metadata.filename }
		} catch (error) {
			throw errorFromException(error)
		}
	}

	#repositoryQueryUrl(nsid: string, params: Record<string, string | undefined>): string {
		const url = new URL(`/xrpc/${nsid}`, this.service)
		for (const [name, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(name, value)
		return url.href
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
	const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
	if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
		throw new TypeError('Data source addresses must use HTTPS')
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new TypeError('Data source addresses cannot contain credentials, a query, or a page fragment')
	}

	return url.toString().replace(/\/$/, '')
}

function normalizePublicPds(service: string): string {
	const url = new URL(service)
	if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
		throw new BobbinError('malformed-response', 'The public record host returned by identity resolution is invalid')
	}
	return url.toString().replace(/\/$/, '')
}

function parseRecordUri(uri: string): { authority: string; collection: string; rkey: string } {
	const match = /^at:\/\/([^/\s]+)\/([a-z][a-z0-9.-]+)\/([a-zA-Z0-9._~:%-]+)$/.exec(uri)
	if (!match || !is(v.didString(), match[1]) || !is(v.nsidString(), match[2]) || !is(v.recordKeyString(), match[3])) {
		throw new BobbinError('invalid-request', 'The public record link is invalid')
	}
	return { authority: match[1], collection: match[2], rkey: match[3] }
}

function assertScopeIdentifier(subject: string, name: string): void {
	if (!subject || subject.length > 2048 || /[\u0000-\u001f\u007f]/.test(subject)) {
		throw new BobbinError('invalid-request', `The ${name} is invalid`)
	}
}

function publicBlobUrl(pds: string, did: string, cid: string): string {
	const url = new URL('/xrpc/com.atproto.sync.getBlob', normalizePublicPds(pds))
	url.searchParams.set('did', did)
	url.searchParams.set('cid', cid)
	return url.href
}

function validateRecordView<const TSchema extends BaseSchema>(
	view: { uri: string; cid?: string; value: unknown },
	schema: TSchema,
	context: string,
): ValidatedRecordView<InferInput<TSchema>> {
	return { uri: view.uri, cid: view.cid, value: validateEmbeddedRecord(schema, view.value, context) }
}

function validateCommentView(view: { uri: string; cid?: string; value: unknown }): ValidatedRecordView<TangledComment> {
	const value = optionalRecord(view.value)
	switch (value?.$type) {
		case 'sh.tangled.feed.comment':
			return validateRecordView(view, ShTangledFeedComment.mainSchema, 'comment')
		case 'sh.tangled.repo.issue.comment':
			return validateRecordView(view, ShTangledRepoIssueComment.mainSchema, 'legacy issue comment')
		case 'sh.tangled.repo.pull.comment':
			return validateRecordView(view, ShTangledRepoPullComment.mainSchema, 'legacy pull comment')
		default:
			throw new BobbinError('malformed-response', 'Bobbin returned an unsupported comment record')
	}
}

function pickListParams<TSubject extends string>(
	subject: TSubject,
	options: ListReposOptions,
	extra: Record<string, string | undefined> = {},
) {
	return { subject, cursor: options.cursor, limit: options.limit, order: options.order, ...extra }
}

/** Removes blank placeholders emitted by older profile writers before strict schema validation. */
function normalizeProfilePlaceholders(value: unknown): unknown {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
	const profile = { ...(value as Record<string, unknown>) }
	for (const field of ['links', 'stats'] as const) {
		const items = profile[field]
		if (Array.isArray(items)) {
			profile[field] = items.filter((item) => typeof item !== 'string' || item.trim().length > 0)
		}
	}
	return profile
}

async function parseJsonBlob(blob: Blob, context: string): Promise<unknown> {
	try {
		const text = await readBlobText(blob)
		return JSON.parse(text) as unknown
	} catch (error) {
		throw new BobbinError('malformed-response', `Bobbin returned invalid ${context}`, { cause: error })
	}
}

function readBlobText(blob: Blob): Promise<string> {
	if (typeof blob.text === 'function') return blob.text()
	if (typeof FileReader === 'undefined') return new Response(blob).text()
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.addEventListener('load', () => resolve(String(reader.result ?? '')), { once: true })
		reader.addEventListener('error', () => reject(reader.error), { once: true })
		reader.readAsText(blob)
	})
}

function parseBranches(value: unknown): RepositoryBranch[] {
	const root = responseRecord(value, 'branches')
	const items = root.branches ?? []
	if (!Array.isArray(items)) throw malformed('branches')
	return items.map((item) => {
		const branch = responseRecord(item, 'branch')
		const reference = optionalRecord(branch.reference)
		const commit = optionalRecord(branch.commit)
		const author = parseSignature(branch.author ?? commit?.Author ?? commit?.author)
		return {
			name: requiredString(branch.name ?? reference?.name, 'branch name'),
			hash: requiredString(branch.hash ?? reference?.hash, 'branch hash'),
			isDefault: branch.isDefault === true || branch.is_default === true,
			message: optionalString(branch.message ?? commit?.Message ?? commit?.message),
			author,
			when: optionalString(branch.when) ?? author?.when,
		}
	})
}

function parseTags(value: unknown): RepositoryTag[] {
	const root = responseRecord(value, 'tags')
	const items = root.tags ?? []
	if (!Array.isArray(items)) throw malformed('tags')
	return items.map((item) => {
		const tag = responseRecord(item, 'tag')
		const details = optionalRecord(tag.tag)
		return {
			name: requiredString(tag.name ?? details?.Name ?? details?.name, 'tag name'),
			hash: requiredString(tag.hash, 'tag hash'),
			message: optionalString(tag.message ?? details?.Message ?? details?.message)?.trim(),
			tagger: parseSignature(details?.Tagger ?? details?.tagger ?? tag.tagger),
		}
	})
}

function parseRepositoryLog(value: unknown, expectedRef: string, page: number, limit: number): RepositoryLogPage {
	const root = responseRecord(value, 'commit history')
	const items = root.commits ?? []
	if (!Array.isArray(items)) throw malformed('commit history')
	const commits = items.map((item) => {
		const commit = responseRecord(item, 'commit')
		const hash = optionalString(commit.this) ?? hashString(commit.hash)
		if (!hash) throw malformed('commit hash')
		const parents = Array.isArray(commit.parent_hashes)
			? commit.parent_hashes.flatMap((parent) => (hashString(parent) ? [hashString(parent)!] : []))
			: optionalString(commit.parent)
				? [commit.parent as string]
				: []
		return {
			hash,
			message: optionalString(commit.message)?.trim() ?? '',
			author: parseSignature(commit.author ?? commit.Author),
			committer: parseSignature(commit.committer ?? commit.Committer),
			parents,
			tree: optionalString(commit.tree),
		}
	})
	const actualPage = positiveInteger(root.page) ?? page
	const pageSize = positiveInteger(root.per_page) ?? limit
	const total = positiveInteger(root.total)
	const cursor = total !== undefined && actualPage * pageSize < total ? String(actualPage + 1) : undefined
	return { items: commits, cursor, ref: optionalString(root.ref) ?? expectedRef, total }
}

function parseSignature(value: unknown): RepositorySignature | undefined {
	const signature = optionalRecord(value)
	if (!signature) return undefined
	const name = optionalString(signature.name ?? signature.Name)
	if (!name) return undefined
	return {
		name,
		email: optionalString(signature.email ?? signature.Email),
		when: optionalString(signature.when ?? signature.When),
	}
}

function hashString(value: unknown): string | undefined {
	if (typeof value === 'string' && /^[a-f\d]{40}$/i.test(value)) return value
	if (
		Array.isArray(value) &&
		value.length === 20 &&
		value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
	) {
		return value.map((byte) => (byte as number).toString(16).padStart(2, '0')).join('')
	}
	return undefined
}

function clampPageSize(value: number | undefined): number {
	return Math.min(99, Math.max(1, value ?? 20))
}

function parseOffsetCursor(value: string | undefined): number {
	const cursor = Number.parseInt(value ?? '0', 10)
	return Number.isInteger(cursor) && cursor >= 0 ? cursor : 0
}

function responseRecord(value: unknown, context: string): Record<string, unknown> {
	const record = optionalRecord(value)
	if (!record) throw malformed(context)
	return record
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined
}

function requiredString(value: unknown, context: string): string {
	const text = optionalString(value)
	if (!text) throw malformed(context)
	return text
}

function optionalString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}

function positiveInteger(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

function malformed(context: string): BobbinError {
	return new BobbinError('malformed-response', `Bobbin returned invalid ${context}`)
}

async function responseError(response: Response): Promise<BobbinError> {
	const data: { error: string; message?: string } = { error: response.statusText || 'Request failed' }
	try {
		const value = (await response.json()) as { error?: unknown; message?: unknown }
		if (typeof value.error === 'string') data.error = value.error
		if (typeof value.message === 'string') data.message = value.message
	} catch {
		// Non-JSON upstream errors still retain their HTTP status and status text.
	}
	return errorFromResponse({ status: response.status, headers: response.headers, data })
}

function downloadMetadata(response: Response): RepositoryDownload {
	const lengthHeader = response.headers.get('content-length')
	const length = lengthHeader === null ? Number.NaN : Number(lengthHeader)
	return {
		body: response.body,
		status: response.status,
		contentLength: Number.isSafeInteger(length) && length >= 0 ? length : undefined,
		contentRange: response.headers.get('content-range') ?? undefined,
		contentType: response.headers.get('content-type') ?? undefined,
		cacheControl: response.headers.get('cache-control') ?? undefined,
		etag: response.headers.get('etag') ?? undefined,
		lastModified: response.headers.get('last-modified') ?? undefined,
		filename: contentDispositionFilename(response.headers.get('content-disposition')),
	}
}

function contentDispositionFilename(value: string | null): string | undefined {
	if (!value) return undefined
	const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(value)?.[1]
	if (encoded) {
		try {
			return decodeURIComponent(encoded.trim())
		} catch {
			return encoded.trim()
		}
	}
	return /filename\s*=\s*"([^"]+)"/i.exec(value)?.[1] ?? /filename\s*=\s*([^;]+)/i.exec(value)?.[1]?.trim()
}

/** Converts Bobbin's structured Git response into a standard unified patch. */
export function normalizeRepositoryPatch(text: string): string {
	let value: unknown
	try {
		value = JSON.parse(text) as unknown
	} catch (error) {
		throw new BobbinError('malformed-response', 'Bobbin returned an invalid patch', { cause: error })
	}

	const root = responseRecord(value, 'patch')
	const diff = optionalRecord(root.diff)
	const directFiles = diff?.diff
	const formatPatches = root.format_patch
	const files = Array.isArray(directFiles)
		? directFiles
		: Array.isArray(formatPatches)
			? formatPatches.flatMap((patch) => {
					const record = optionalRecord(patch)
					return Array.isArray(record?.Files) ? record.Files : []
				})
			: []

	if (files.length === 0) return ''
	return files.map(structuredFilePatch).join('')
}

function structuredFilePatch(value: unknown): string {
	const file = responseRecord(value, 'patch file')
	const names = optionalRecord(file.name)
	const oldName = requiredString(file.OldName ?? names?.old, 'old patch filename')
	const newName = requiredString(file.NewName ?? names?.new, 'new patch filename')
	const isNew = file.IsNew === true || file.is_new === true
	const isDelete = file.IsDelete === true || file.is_delete === true
	const fragments = file.TextFragments ?? file.text_fragments
	if (!Array.isArray(fragments)) throw malformed('patch fragments')

	let patch = `diff --git a/${oldName} b/${newName}\n--- ${isNew ? '/dev/null' : `a/${oldName}`}\n+++ ${isDelete ? '/dev/null' : `b/${newName}`}\n`
	if (fragments.length === 0 && (file.IsBinary === true || file.is_binary === true)) {
		return `${patch}Binary files a/${oldName} and b/${newName} differ\n`
	}

	for (const fragmentValue of fragments) {
		const fragment = responseRecord(fragmentValue, 'patch fragment')
		const oldPosition = requiredInteger(fragment.OldPosition, 'old patch position')
		const oldLines = requiredInteger(fragment.OldLines, 'old patch line count')
		const newPosition = requiredInteger(fragment.NewPosition, 'new patch position')
		const newLines = requiredInteger(fragment.NewLines, 'new patch line count')
		const comment = optionalString(fragment.Comment)
		patch += `@@ -${oldPosition},${oldLines} +${newPosition},${newLines} @@${comment ? ` ${comment}` : ''}\n`
		if (!Array.isArray(fragment.Lines)) throw malformed('patch lines')
		for (const lineValue of fragment.Lines) {
			const line = responseRecord(lineValue, 'patch line')
			const operation = requiredInteger(line.Op, 'patch operation')
			if (operation !== 0 && operation !== 1 && operation !== 2) throw malformed('patch operation')
			const contents = requiredStringAllowEmpty(line.Line, 'patch line')
			patch += `${operation === 1 ? '-' : operation === 2 ? '+' : ' '}${contents}`
			if (!contents.endsWith('\n')) patch += '\n\\ No newline at end of file\n'
		}
	}
	return patch
}

function requiredInteger(value: unknown, context: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw malformed(context)
	return value
}

function requiredStringAllowEmpty(value: unknown, context: string): string {
	if (typeof value !== 'string') throw malformed(context)
	return value
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
