<template>
	<ion-page>
		<page-header title="People" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="people-page page-frame page-frame--narrow">
				<p class="section-label">People on Tangled</p>
				<h1>Find a public profile</h1>
				<p>Enter someone’s handle to see what they share and the repositories they own.</p>
				<form role="search" @submit.prevent="openProfile">
					<label for="profile-search">Handle</label>
					<div>
						<input
							id="profile-search"
							v-model="actor"
							autocomplete="off"
							placeholder="desertthunder.dev"
							spellcheck="false" />
						<button type="submit">View profile</button>
					</div>
					<p v-if="error" role="alert">{{ error }}</p>
				</form>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const actor = ref('')
const error = ref('')

function openProfile(): void {
	const value = actor.value.trim().replace(/^@/, '')
	if (!value) {
		error.value = 'Enter a Tangled handle.'
		return
	}
	error.value = ''
	void router.push(links.profile(value))
}
</script>

<style scoped>
.people-page h1 {
	max-inline-size: 12ch;
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(2.75rem, 8vw, 5rem);
	letter-spacing: -0.055em;
	line-height: 1;
}
.people-page > p:not(.section-label) {
	max-inline-size: 38rem;
	color: var(--app-text-muted);
	font-size: var(--text-lg);
	line-height: 1.6;
}
.people-page form {
	display: grid;
	gap: var(--space-2);
	max-inline-size: 42rem;
	margin-block-start: var(--space-8);
}
.people-page label {
	font-size: var(--text-sm);
	font-weight: 700;
}
.people-page form > div {
	display: flex;
	gap: var(--space-3);
}
.people-page input {
	flex: 1;
	min-inline-size: 0;
	min-block-size: 3rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-text);
	background: var(--app-surface);
}
.people-page button {
	min-block-size: 44px;
	border: 0;
	border-radius: var(--radius-sm);
	padding-inline: var(--space-5);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 750;
	cursor: pointer;
}
.people-page form > p {
	margin: var(--space-2) 0 0;
	color: var(--app-danger);
}
@media (max-width: 470px) {
	.people-page form > div {
		flex-direction: column;
	}
}
</style>
