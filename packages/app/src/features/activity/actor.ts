import type { ActorActivityKind } from '@/lib/api'

export interface ActorActivityDefinition {
	description: string
	kind: ActorActivityKind
	label: string
}

export const actorActivityDefinitions: ActorActivityDefinition[] = [
	{ kind: 'comments', label: 'Comments', description: 'Conversations this person joined.' },
	{ kind: 'reactions', label: 'Reactions', description: 'Public reactions this person left.' },
	{ kind: 'stars', label: 'Stars', description: 'Repositories and posts this person starred.' },
	{ kind: 'follows', label: 'Follows', description: 'People this person follows.' },
	{ kind: 'vouches', label: 'Vouches', description: 'Public endorsements and cautions.' },
	{ kind: 'issues', label: 'Issues', description: 'Issues this person opened.' },
	{ kind: 'pulls', label: 'Pull requests', description: 'Changes this person proposed.' },
	{ kind: 'issue-states', label: 'Issue changes', description: 'Issue state changes this person made.' },
	{ kind: 'pull-statuses', label: 'Pull changes', description: 'Pull request status changes this person made.' },
	{ kind: 'ref-updates', label: 'Code updates', description: 'Branches and references this person updated.' },
	{ kind: 'collaborators', label: 'Collaborators', description: 'Repository access this person granted.' },
	{ kind: 'label-operations', label: 'Labels', description: 'Labels this person applied or removed.' },
	{ kind: 'pipelines', label: 'Pipelines', description: 'Automation runs this person started.' },
	{ kind: 'pipeline-statuses', label: 'Pipeline results', description: 'Automation results this person published.' },
	{ kind: 'artifacts', label: 'Artifacts', description: 'Build artifacts this person published.' },
	{ kind: 'knot-memberships', label: 'Knot memberships', description: 'Knot memberships created by this person.' },
	{
		kind: 'spindle-memberships',
		label: 'Spindle memberships',
		description: 'Spindle memberships created by this person.',
	},
]

export function actorActivityDefinition(kind: ActorActivityKind): ActorActivityDefinition {
	return actorActivityDefinitions.find((definition) => definition.kind === kind) ?? actorActivityDefinitions[0]
}
