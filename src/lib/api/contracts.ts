import { ShTangledKnotListKeys, ShTangledKnotVersion, ShTangledOwner, ShTangledRepoBlob } from '@atcute/tangled'
import * as v from '@atcute/lexicons/validations'

/** The hosted Bobbin instance used unless a user configures another service. */
export const DEFAULT_BOBBIN_SERVICE = 'https://api.tangled.org'

/** Bobbin's Hydrant ingestion status, which is not yet published by atcute. */
export type BobbinCoverage = { ready: boolean; eventsProcessed: number; lastCursor: number }

/** The local coverage query schema retained until atcute publishes the lexicon. */
export const bobbinCoverageSchema = v.query('sh.tangled.bobbin.getCoverage', {
	params: null,
	output: {
		type: 'lex',
		schema: v.object({ ready: v.boolean(), eventsProcessed: v.integer(), lastCursor: v.integer() }),
	},
})

/** Bobbin's overlay for the knot owner query. */
export const bobbinKnotOwnerSchema = v.query('sh.tangled.owner', {
	params: v.object({ knot: v.string() }),
	output: ShTangledOwner.mainSchema.output,
})

/** Bobbin's overlay for the knot version query. */
export const bobbinKnotVersionSchema = v.query('sh.tangled.knot.version', {
	params: v.object({ knot: v.string() }),
	output: ShTangledKnotVersion.mainSchema.output,
})

/** Bobbin's overlay for the paginated public knot-key query. */
export const bobbinKnotListKeysSchema = v.query('sh.tangled.knot.listKeys', {
	params: v.object({ ...ShTangledKnotListKeys.mainSchema.params.shape, knot: v.string() }),
	output: ShTangledKnotListKeys.mainSchema.output,
})

/** Bobbin resolves a repository record AT-URI before proxying this query to its knot. */
export const bobbinRepoBlobSchema = v.query('sh.tangled.repo.blob', {
	params: v.object({ ...ShTangledRepoBlob.mainSchema.params.shape, repo: v.string() }),
	output: ShTangledRepoBlob.mainSchema.output,
})
