<template>
	<ion-page>
		<ion-header :translucent="true">
			<ion-toolbar>
				<ion-title>Twisted</ion-title>
			</ion-toolbar>
		</ion-header>

		<ion-content :fullscreen="true">
			<ion-header collapse="condense">
				<ion-toolbar>
					<ion-title size="large">Twisted</ion-title>
				</ion-toolbar>
			</ion-header>

			<div class="welcome">
				<h1>Read Tangled from anywhere.</h1>
				<p>Twisted is a read-only browser for public Tangled repositories and activity.</p>
			</div>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
</script>

<style scoped>
.welcome {
	text-align: center;

	position: absolute;
	left: 0;
	right: 0;
	top: 50%;
	transform: translateY(-50%);
}

.welcome h1 {
	font-size: 20px;
	line-height: 26px;
}

.welcome p {
	font-size: 16px;
	line-height: 22px;

	color: #8c8c8c;

	margin: 0;
}
</style>
