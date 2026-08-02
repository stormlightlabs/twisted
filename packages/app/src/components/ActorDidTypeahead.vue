<template>
	<div ref="root" class="actor-typeahead">
		<label :for="id">{{ label }}</label>
		<div class="actor-typeahead__field">
			<input
				:id="id"
				v-model="query"
				:aria-activedescendant="activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined"
				:aria-controls="`${id}-suggestions`"
				:aria-expanded="showSuggestions"
				aria-autocomplete="list"
				autocapitalize="off"
				autocomplete="off"
				placeholder="Handle, name, or DID"
				role="combobox"
				spellcheck="false"
				@focus="focused = true"
				@keydown="onKeydown" />
			<span v-if="loading" aria-label="Loading suggestions" class="actor-typeahead__loading" />
		</div>
		<ul v-if="showSuggestions" :id="`${id}-suggestions`" class="actor-typeahead__menu" role="listbox">
			<li v-for="(actor, index) in actors" :id="`${id}-option-${index}`" :key="actor.did" role="option">
				<button :class="{ 'is-active': index === activeIndex }" type="button" @click="select(actor)">
					<span class="actor-typeahead__avatar" aria-hidden="true">{{ actorInitial(actor) }}</span>
					<span>
						<strong>{{ actor.displayName || `@${actor.handle}` }}</strong>
						<small>@{{ actor.handle }}</small>
						<code>{{ actor.did }}</code>
					</span>
				</button>
			</li>
		</ul>
		<small v-if="message" class="actor-typeahead__message">{{ message }}</small>
	</div>
</template>

<script setup lang="ts">
import type { ActorTypeaheadResult } from '@/lib/api'
import { useBobbinClientProvider } from '@/lib/api'
import { onClickOutside } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ id: string; label: string; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const getClient = useBobbinClientProvider()
const root = ref<HTMLElement>()
const query = ref(props.modelValue)
const actors = ref<ActorTypeaheadResult[]>([])
const activeIndex = ref(-1)
const focused = ref(false)
const loading = ref(false)
const failed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

const showSuggestions = computed(() => focused.value && actors.value.length > 0)
const message = computed(() => {
	if (failed.value) return 'Suggestions are unavailable. You can still enter a complete DID.'
	if (query.value.length >= 2 && !loading.value && actors.value.length === 0 && !isDid(query.value)) {
		return 'No actors found. Try a handle, display name, or complete DID.'
	}
	return ''
})

watch(
	() => props.modelValue,
	(value) => {
		if (value !== query.value) query.value = value
	},
)
watch(query, (value) => {
	emit('update:modelValue', value.trim())
	actors.value = []
	activeIndex.value = -1
	failed.value = false
	clearTimeout(timer)
	controller?.abort()
	if (value.trim().length < 2 || isDid(value)) {
		loading.value = false
		return
	}
	timer = setTimeout(() => void load(value), 225)
})
onClickOutside(root, () => (focused.value = false))
onBeforeUnmount(() => {
	clearTimeout(timer)
	controller?.abort()
})

async function load(value: string): Promise<void> {
	const request = new AbortController()
	controller = request
	loading.value = true
	try {
		actors.value = await getClient().searchActorsTypeahead(value, { signal: request.signal })
		activeIndex.value = actors.value.length ? 0 : -1
	} catch {
		/* Manual DID entry remains available when public suggestions fail. */
		if (!request.signal.aborted) failed.value = true
	} finally {
		if (controller === request) loading.value = false
	}
}

function select(actor: ActorTypeaheadResult): void {
	query.value = actor.did
	emit('update:modelValue', actor.did)
	actors.value = []
	focused.value = false
}

function onKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') {
		focused.value = false
		return
	}
	if (!actors.value.length || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return
	event.preventDefault()
	if (event.key === 'ArrowDown') activeIndex.value = (activeIndex.value + 1) % actors.value.length
	else if (event.key === 'ArrowUp')
		activeIndex.value = (activeIndex.value - 1 + actors.value.length) % actors.value.length
	else if (activeIndex.value >= 0) select(actors.value[activeIndex.value]!)
}

function isDid(value: string): boolean {
	return /^did:[a-z0-9]+:[^\s/]+$/i.test(value.trim())
}

function actorInitial(actor: ActorTypeaheadResult): string {
	return (actor.displayName || actor.handle).trim().charAt(0).toUpperCase() || '@'
}
</script>

<style scoped>
.actor-typeahead {
	position: relative;
	display: grid;
	gap: var(--space-2);
}
.actor-typeahead > label {
	font-size: var(--text-sm);
	font-weight: 700;
}
.actor-typeahead__field {
	position: relative;
}
.actor-typeahead input {
	inline-size: 100%;
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-3) 2.5rem;
	color: var(--app-text);
	background: var(--app-surface);
}
.actor-typeahead__loading {
	position: absolute;
	inset-block-start: calc(50% - 0.4rem);
	inset-inline-end: var(--space-3);
	inline-size: 0.8rem;
	block-size: 0.8rem;
	border: 2px solid var(--app-border);
	border-block-start-color: var(--app-accent);
	border-radius: 50%;
	animation: spin 0.7s linear infinite;
}
.actor-typeahead__menu {
	position: absolute;
	z-index: 20;
	inset-block-start: calc(100% - 1.25rem);
	inset-inline: 0;
	max-block-size: 18rem;
	margin: 0;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-1);
	background: var(--app-surface-raised);
	box-shadow: 0 0.75rem 2rem color-mix(in srgb, var(--app-background) 65%, transparent);
	list-style: none;
	overflow-y: auto;
}
.actor-typeahead__menu button {
	display: grid;
	grid-template-columns: 2.25rem 1fr;
	gap: var(--space-3);
	inline-size: 100%;
	min-block-size: 44px;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	padding: var(--space-2);
	color: var(--app-text);
	background: transparent;
	text-align: start;
	cursor: pointer;
}
.actor-typeahead__menu button:hover,
.actor-typeahead__menu button.is-active {
	border-color: var(--app-border);
	background: var(--app-surface);
}
.actor-typeahead__avatar {
	inline-size: 2.25rem;
	block-size: 2.25rem;
	border-radius: 50%;
}
.actor-typeahead__avatar {
	display: grid;
	place-items: center;
	background: var(--app-surface);
	color: var(--app-accent);
	font-weight: 800;
}
.actor-typeahead__menu button > span:last-child {
	display: grid;
	min-inline-size: 0;
}
.actor-typeahead__menu small,
.actor-typeahead__menu code,
.actor-typeahead__message {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
}
.actor-typeahead__menu code {
	overflow: hidden;
	text-overflow: ellipsis;
}
@keyframes spin {
	to {
		transform: rotate(1turn);
	}
}
</style>
