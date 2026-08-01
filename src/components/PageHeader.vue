<template>
	<ion-header :translucent="true">
		<ion-toolbar>
			<ion-buttons slot="start">
				<ion-back-button v-if="back" :default-href="back" />
				<ion-menu-button v-else />
			</ion-buttons>
			<ion-title>{{ title }}</ion-title>
		</ion-toolbar>
	</ion-header>
</template>

<script setup lang="ts">
import { IonBackButton, IonButtons, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/vue'

defineProps<{ title: string; back?: string }>()
</script>
