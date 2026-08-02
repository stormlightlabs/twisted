<template>
	<aside class="freshness-notice" role="note">
		<strong>Roster freshness is not verified.</strong>
		<span
			>Bobbin shows indexed public records, but its coverage cannot prove that a knot’s current roster is
			complete.</span
		>
	</aside>
</template>

<style scoped>
.freshness-notice {
	display: grid;
	gap: var(--space-1);
	border-inline-start: 3px solid var(--app-warning);
	padding: var(--space-3) var(--space-4);
	color: var(--app-text-muted);
	line-height: 1.5;
}

strong {
	color: var(--app-text);
}
</style>
