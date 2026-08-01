import {
	ShTangledActorProfile,
	ShTangledFeedComment,
	ShTangledFeedReaction,
	ShTangledFeedStar,
	ShTangledGitRefUpdate,
	ShTangledGraphFollow,
	ShTangledGraphVouch,
	ShTangledKnot,
	ShTangledKnotMember,
	ShTangledLabelDefinition,
	ShTangledLabelOp,
	ShTangledPipeline,
	ShTangledPipelineStatus,
	ShTangledPublicKey,
	ShTangledRepo,
	ShTangledRepoArtifact,
	ShTangledRepoCollaborator,
	ShTangledRepoIssue,
	ShTangledRepoIssueComment,
	ShTangledRepoIssueState,
	ShTangledRepoPull,
	ShTangledRepoPullComment,
	ShTangledRepoPullStatus,
	ShTangledSpindle,
	ShTangledSpindleMember,
	ShTangledString,
} from '@atcute/tangled'

/** Every Tangled record collection that can appear in mixed search results. */
export const searchableRecordSchemas = {
	'sh.tangled.actor.profile': ShTangledActorProfile.mainSchema,
	'sh.tangled.feed.comment': ShTangledFeedComment.mainSchema,
	'sh.tangled.feed.reaction': ShTangledFeedReaction.mainSchema,
	'sh.tangled.feed.star': ShTangledFeedStar.mainSchema,
	'sh.tangled.git.refUpdate': ShTangledGitRefUpdate.mainSchema,
	'sh.tangled.graph.follow': ShTangledGraphFollow.mainSchema,
	'sh.tangled.graph.vouch': ShTangledGraphVouch.mainSchema,
	'sh.tangled.knot': ShTangledKnot.mainSchema,
	'sh.tangled.knot.member': ShTangledKnotMember.mainSchema,
	'sh.tangled.label.definition': ShTangledLabelDefinition.mainSchema,
	'sh.tangled.label.op': ShTangledLabelOp.mainSchema,
	'sh.tangled.pipeline': ShTangledPipeline.mainSchema,
	'sh.tangled.pipeline.status': ShTangledPipelineStatus.mainSchema,
	'sh.tangled.publicKey': ShTangledPublicKey.mainSchema,
	'sh.tangled.repo': ShTangledRepo.mainSchema,
	'sh.tangled.repo.artifact': ShTangledRepoArtifact.mainSchema,
	'sh.tangled.repo.collaborator': ShTangledRepoCollaborator.mainSchema,
	'sh.tangled.repo.issue': ShTangledRepoIssue.mainSchema,
	'sh.tangled.repo.issue.comment': ShTangledRepoIssueComment.mainSchema,
	'sh.tangled.repo.issue.state': ShTangledRepoIssueState.mainSchema,
	'sh.tangled.repo.pull': ShTangledRepoPull.mainSchema,
	'sh.tangled.repo.pull.comment': ShTangledRepoPullComment.mainSchema,
	'sh.tangled.repo.pull.status': ShTangledRepoPullStatus.mainSchema,
	'sh.tangled.spindle': ShTangledSpindle.mainSchema,
	'sh.tangled.spindle.member': ShTangledSpindleMember.mainSchema,
	'sh.tangled.string': ShTangledString.mainSchema,
} as const

const collectionNames: Record<string, string> = {
	'sh.tangled.actor.profile': 'Profile',
	'sh.tangled.feed.comment': 'Comment',
	'sh.tangled.feed.reaction': 'Reaction',
	'sh.tangled.feed.star': 'Star',
	'sh.tangled.git.refUpdate': 'Repository update',
	'sh.tangled.graph.follow': 'Follow',
	'sh.tangled.graph.vouch': 'Vouch',
	'sh.tangled.knot': 'Knot',
	'sh.tangled.knot.member': 'Knot member',
	'sh.tangled.label.definition': 'Label',
	'sh.tangled.label.op': 'Label change',
	'sh.tangled.pipeline': 'Pipeline',
	'sh.tangled.pipeline.status': 'Pipeline status',
	'sh.tangled.publicKey': 'Public key',
	'sh.tangled.repo': 'Repository',
	'sh.tangled.repo.artifact': 'Artifact',
	'sh.tangled.repo.collaborator': 'Collaborator',
	'sh.tangled.repo.issue': 'Issue',
	'sh.tangled.repo.issue.comment': 'Issue comment',
	'sh.tangled.repo.issue.state': 'Issue state',
	'sh.tangled.repo.pull': 'Pull request',
	'sh.tangled.repo.pull.comment': 'Pull request comment',
	'sh.tangled.repo.pull.status': 'Pull request status',
	'sh.tangled.spindle': 'Spindle',
	'sh.tangled.spindle.member': 'Spindle member',
	'sh.tangled.string': 'String',
}

export function collectionName(nsid: string): string {
	return collectionNames[nsid] ?? nsid
}

export function recordTitle(value: Record<string, unknown>, fallback: string): string {
	for (const field of ['name', 'title', 'preferredHandle']) {
		if (typeof value[field] === 'string' && value[field].trim()) return value[field]
	}
	return fallback
}

export function recordExcerpt(value: Record<string, unknown>): string | undefined {
	for (const field of ['description', 'body', 'text', 'message']) {
		if (typeof value[field] === 'string' && value[field].trim()) return value[field]
	}
	return undefined
}
