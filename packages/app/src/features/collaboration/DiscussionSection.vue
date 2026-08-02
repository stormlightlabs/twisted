<template>
	<div class="discussion-grid">
		<section aria-labelledby="comments-heading">
			<header>
				<h2 id="comments-heading">Comments</h2>
				<span v-if="commentCount.data.value"
					>{{ commentCount.data.value.count }} from {{ commentCount.data.value.distinctAuthors }} people</span
				>
			</header>
			<request-state
				:empty="commentsRequest.phase.value === 'empty'"
				empty-message="No public comments are indexed for this record."
				:error="commentsRequest.error.value || commentCount.error.value || commentsMoreError"
				:has-content="comments.length > 0"
				:loading="commentsRequest.phase.value === 'loading'"
				noun="comments"
				@retry="commentsMoreError ? loadMoreComments() : commentsRequest.retry()" />
			<ol v-if="comments.length" class="discussion-list">
				<li v-for="comment in comments" :key="comment.uri">
					<div class="discussion-meta">
						<router-link :to="links.profile(recordAuthor(comment.uri))">{{ recordAuthor(comment.uri) }}</router-link>
						<time :datetime="comment.value.createdAt">{{ formatRecordDate(comment.value.createdAt) }}</time>
					</div>
					<markdown-content :repo="repo" :source="commentMarkdown(comment.value)" />
					<ul v-if="comment.value.mentions?.length || comment.value.references?.length" class="comment-links">
						<li v-for="mention in comment.value.mentions" :key="`mention:${mention}`">
							Mention: <router-link :to="links.profile(mention)">{{ mention }}</router-link>
						</li>
						<li v-for="reference in comment.value.references" :key="`reference:${reference}`">
							Reference: <router-link :to="links.search(reference)">{{ reference }}</router-link>
						</li>
					</ul>
				</li>
			</ol>
			<button v-if="commentsCursor" :disabled="commentsLoadingMore" type="button" @click="loadMoreComments">
				{{ commentsLoadingMore ? 'Loading…' : 'Load more comments' }}
			</button>
		</section>

		<section aria-labelledby="reactions-heading">
			<header>
				<h2 id="reactions-heading">Reactions</h2>
				<span v-if="reactionCount.data.value"
					>{{ reactionCount.data.value.count }} from {{ reactionCount.data.value.distinctAuthors }} people</span
				>
			</header>
			<request-state
				:empty="reactionsRequest.phase.value === 'empty'"
				empty-message="No public reactions are indexed for this record."
				:error="reactionsRequest.error.value || reactionCount.error.value || reactionsMoreError"
				:has-content="reactions.length > 0"
				:loading="reactionsRequest.phase.value === 'loading'"
				noun="reactions"
				@retry="reactionsMoreError ? loadMoreReactions() : reactionsRequest.retry()" />
			<ul v-if="reactionSummary.length" class="reaction-summary" aria-label="Reaction summary">
				<li v-for="reaction in reactionSummary" :key="reaction.value">
					<span aria-hidden="true">{{ reaction.value }}</span> {{ reaction.count }}
				</li>
			</ul>
			<ul v-if="reactions.length" class="actor-list">
				<li v-for="reaction in reactions" :key="reaction.uri">
					<span>{{ reaction.value.reaction }}</span>
					<router-link :to="links.profile(recordAuthor(reaction.uri))">{{ recordAuthor(reaction.uri) }}</router-link>
				</li>
			</ul>
			<button v-if="reactionsCursor" :disabled="reactionsLoadingMore" type="button" @click="loadMoreReactions">
				{{ reactionsLoadingMore ? 'Loading…' : 'Load more reactions' }}
			</button>
		</section>
	</div>
</template>

<script setup lang="ts">
import MarkdownContent from '@/components/MarkdownContent.vue'
import RequestState from '@/components/RequestState.vue'
import { commentMarkdown, formatRecordDate, recordAuthor } from './records'
import { errorFromException, useBobbinClientProvider } from '@/lib/api'
import type { BobbinError } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { computed, ref, shallowRef, toRef, watch } from 'vue'

const props = defineProps<{ subject: string; repo?: string }>()
type CommentItem = {
	readonly uri: string
	readonly value: {
		readonly body: string | { readonly text: string }
		readonly createdAt: string
		readonly mentions?: readonly string[]
		readonly references?: readonly string[]
	}
}
type ReactionItem = { readonly uri: string; readonly value: { readonly createdAt: string; readonly reaction: string } }
const getClient = useBobbinClientProvider()
const subject = toRef(props, 'subject')
const commentsRequest = useRouteRequest(
	subject,
	(value, signal, attempt) =>
		getClient().listComments(value as Parameters<ReturnType<typeof getClient>['listComments']>[0], {
			signal,
			cache: attempt.cache,
			limit: 20,
			order: 'asc',
		}),
	{ isEmpty: (page) => page.items.length === 0 },
)
const reactionsRequest = useRouteRequest(
	subject,
	(value, signal, attempt) =>
		getClient().listReactions(value as Parameters<ReturnType<typeof getClient>['listReactions']>[0], {
			signal,
			cache: attempt.cache,
			limit: 50,
			order: 'asc',
		}),
	{ isEmpty: (page) => page.items.length === 0 },
)
const commentCount = useRouteRequest(subject, (value, signal, attempt) =>
	getClient().countComments(value as Parameters<ReturnType<typeof getClient>['countComments']>[0], {
		signal,
		cache: attempt.cache,
	}),
)
const reactionCount = useRouteRequest(subject, (value, signal, attempt) =>
	getClient().countReactions(value as Parameters<ReturnType<typeof getClient>['countReactions']>[0], {
		signal,
		cache: attempt.cache,
	}),
)

const comments = shallowRef<CommentItem[]>([])
const commentsCursor = ref<string>()
const commentsLoadingMore = ref(false)
const commentsMoreError = ref<BobbinError>()
const reactions = shallowRef<ReactionItem[]>([])
const reactionsCursor = ref<string>()
const reactionsLoadingMore = ref(false)
const reactionsMoreError = ref<BobbinError>()

watch(commentsRequest.data, (page) => {
	comments.value = [...(page?.items ?? [])]
	commentsCursor.value = page?.cursor
	commentsMoreError.value = undefined
})
watch(reactionsRequest.data, (page) => {
	reactions.value = [...(page?.items ?? [])]
	reactionsCursor.value = page?.cursor
	reactionsMoreError.value = undefined
})

const reactionSummary = computed(() => {
	const counts = new Map<string, number>()
	for (const item of reactions.value) counts.set(item.value.reaction, (counts.get(item.value.reaction) ?? 0) + 1)
	return [...counts].map(([value, count]) => ({ value, count }))
})

async function loadMoreComments() {
	const cursor = commentsCursor.value
	if (!cursor || commentsLoadingMore.value) return
	commentsLoadingMore.value = true
	commentsMoreError.value = undefined
	try {
		const page = await getClient().listComments(
			props.subject as Parameters<ReturnType<typeof getClient>['listComments']>[0],
			{ cursor, limit: 20, order: 'asc' },
		)
		appendUnique(comments.value, page.items)
		commentsCursor.value = page.cursor
	} catch (error) {
		commentsMoreError.value = errorFromException(error)
	} finally {
		commentsLoadingMore.value = false
	}
}

async function loadMoreReactions() {
	const cursor = reactionsCursor.value
	if (!cursor || reactionsLoadingMore.value) return
	reactionsLoadingMore.value = true
	reactionsMoreError.value = undefined
	try {
		const page = await getClient().listReactions(
			props.subject as Parameters<ReturnType<typeof getClient>['listReactions']>[0],
			{ cursor, limit: 50, order: 'asc' },
		)
		appendUnique(reactions.value, page.items)
		reactionsCursor.value = page.cursor
	} catch (error) {
		reactionsMoreError.value = errorFromException(error)
	} finally {
		reactionsLoadingMore.value = false
	}
}

function appendUnique<T extends { uri: string }>(target: T[], items: readonly T[]) {
	const seen = new Set(target.map((item) => item.uri))
	target.push(...items.filter((item) => !seen.has(item.uri)))
}
</script>

<style scoped>
.discussion-grid,
.discussion-grid section {
	display: grid;
	gap: var(--space-5);
}
.discussion-grid section > header {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	justify-content: space-between;
	gap: var(--space-3);
}
.discussion-grid h2 {
	margin: 0;
}
.discussion-grid header span,
.discussion-meta {
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
.discussion-list,
.actor-list,
.reaction-summary,
.comment-links {
	margin: 0;
	padding: 0;
	list-style: none;
}
.discussion-list {
	display: grid;
	gap: var(--space-4);
}
.discussion-list > li {
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-5);
	background: var(--app-surface);
}
.discussion-meta,
.actor-list li,
.reaction-summary {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-3);
}
.discussion-meta {
	justify-content: space-between;
}
.comment-links {
	display: grid;
	gap: var(--space-2);
	margin-block-start: var(--space-3);
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
.reaction-summary li {
	border: 1px solid var(--app-border);
	border-radius: 999px;
	padding: var(--space-2) var(--space-3);
	background: var(--app-surface);
}
.actor-list {
	display: grid;
	gap: var(--space-2);
}
.discussion-grid button {
	justify-self: start;
	min-block-size: 44px;
	border: 1px solid var(--app-accent);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 700;
}
</style>
