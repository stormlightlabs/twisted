<template>
	<div ref="root" class="date-picker">
		<label :for="id">{{ label }}</label>
		<button
			:id="id"
			:aria-expanded="open"
			:aria-controls="`${id}-calendar`"
			class="date-picker__trigger"
			type="button"
			@click="toggle">
			<span :class="{ 'date-picker__placeholder': !modelValue }">{{ displayValue }}</span>
			<ion-icon aria-hidden="true" :icon="calendarOutline" />
		</button>

		<div v-if="open" :id="`${id}-calendar`" class="date-picker__popover" role="dialog" :aria-label="`${label} date`">
			<div class="date-picker__month">
				<button type="button" aria-label="Previous month" @click="moveMonth(-1)">
					<ion-icon aria-hidden="true" :icon="chevronBack" />
				</button>
				<strong aria-live="polite">{{ monthLabel }}</strong>
				<button type="button" aria-label="Next month" @click="moveMonth(1)">
					<ion-icon aria-hidden="true" :icon="chevronForward" />
				</button>
			</div>
			<div class="date-picker__weekdays" aria-hidden="true">
				<span v-for="day in weekdays" :key="day">{{ day }}</span>
			</div>
			<div class="date-picker__days">
				<span v-for="blank in leadingBlanks" :key="`blank-${blank}`" />
				<button
					v-for="day in daysInMonth"
					:key="day"
					:aria-label="dayLabel(day)"
					:aria-pressed="dateValue(day) === modelValue"
					:class="{ 'is-today': dateValue(day) === today, 'is-selected': dateValue(day) === modelValue }"
					type="button"
					@click="select(day)">
					{{ day }}
				</button>
			</div>
			<div class="date-picker__actions">
				<button type="button" @click="selectToday">Today</button>
				<button v-if="modelValue" type="button" @click="clear">Clear</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { calendarOutline, chevronBack, chevronForward } from 'ionicons/icons'
import { computed, ref, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'

const props = defineProps<{ id: string; label: string; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const root = ref<HTMLElement>()
const open = ref(false)
const viewDate = ref(initialMonth(props.modelValue))
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const today = localDateValue(new Date())

const displayValue = computed(() => {
	if (!props.modelValue) return 'Choose date'
	const date = parseDate(props.modelValue)
	return date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) : props.modelValue
})
const monthLabel = computed(() =>
	new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(viewDate.value),
)
const leadingBlanks = computed(() => viewDate.value.getDay())
const daysInMonth = computed(() => new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + 1, 0).getDate())

watch(
	() => props.modelValue,
	(value) => {
		if (value) viewDate.value = initialMonth(value)
	},
)
onClickOutside(root, () => (open.value = false))

function toggle(): void {
	open.value = !open.value
	if (open.value) viewDate.value = initialMonth(props.modelValue)
}

function moveMonth(amount: number): void {
	viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + amount, 1)
}

function dateValue(day: number): string {
	return localDateValue(new Date(viewDate.value.getFullYear(), viewDate.value.getMonth(), day))
}

function dayLabel(day: number): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(
		new Date(viewDate.value.getFullYear(), viewDate.value.getMonth(), day),
	)
}

function select(day: number): void {
	emit('update:modelValue', dateValue(day))
	open.value = false
}

function selectToday(): void {
	emit('update:modelValue', today)
	open.value = false
}

function clear(): void {
	emit('update:modelValue', '')
	open.value = false
}

function initialMonth(value: string): Date {
	const date = parseDate(value) ?? new Date()
	return new Date(date.getFullYear(), date.getMonth(), 1)
}

function parseDate(value: string): Date | undefined {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
	const [year, month, day] = value.split('-').map(Number)
	const date = new Date(year!, month! - 1, day)
	return localDateValue(date) === value ? date : undefined
}

function localDateValue(date: Date): string {
	const year = String(date.getFullYear()).padStart(4, '0')
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}
</script>

<style scoped>
.date-picker {
	position: relative;
	display: grid;
	gap: var(--space-2);
}
.date-picker > label {
	font-size: var(--text-sm);
	font-weight: 700;
}
.date-picker__trigger {
	display: flex;
	align-items: center;
	justify-content: space-between;
	inline-size: 100%;
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-3);
	color: var(--app-text);
	background: var(--app-surface);
	text-align: start;
	cursor: pointer;
}
.date-picker__placeholder {
	color: var(--app-text-muted);
}
.date-picker__popover {
	position: absolute;
	z-index: 20;
	inset-block-start: calc(100% + var(--space-2));
	inset-inline-start: 0;
	inline-size: min(20rem, calc(100vw - 2rem));
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-3);
	color: var(--app-text);
	background: var(--app-surface-raised);
	box-shadow: 0 0.75rem 2rem color-mix(in srgb, var(--app-background) 65%, transparent);
}
.date-picker__month,
.date-picker__actions {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.date-picker__month button,
.date-picker__actions button,
.date-picker__days button {
	min-block-size: 40px;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	color: inherit;
	background: transparent;
	cursor: pointer;
}
.date-picker__month button {
	inline-size: 44px;
}
.date-picker__weekdays,
.date-picker__days {
	display: grid;
	grid-template-columns: repeat(7, minmax(0, 1fr));
	text-align: center;
}
.date-picker__weekdays {
	margin-block-start: var(--space-2);
	color: var(--app-text-muted);
	font-size: var(--text-xs);
	font-weight: 700;
}
.date-picker__days button:hover,
.date-picker__days button:focus-visible {
	border-color: var(--app-accent);
	background: var(--app-surface);
}
.date-picker__days button.is-today {
	border-color: var(--app-border-strong);
}
.date-picker__days button.is-selected {
	color: var(--app-accent-contrast);
	background: var(--app-accent);
}
.date-picker__actions {
	justify-content: flex-end;
	gap: var(--space-2);
	border-block-start: 1px solid var(--app-border);
	margin-block-start: var(--space-2);
	padding-block-start: var(--space-2);
}
.date-picker__actions button {
	padding-inline: var(--space-3);
	color: var(--app-accent);
	font-weight: 700;
}
@media (max-width: 600px) {
	.date-picker__popover {
		position: fixed;
		inset: auto 1rem calc(4.5rem + env(safe-area-inset-bottom)) 1rem;
		inline-size: auto;
	}
}
</style>
