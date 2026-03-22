<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/home" />
        </ion-buttons>
        <ion-title>{{ owner }}/{{ repo }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
} from '@ionic/vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const owner = route.params.owner as string;
const repo = route.params.repo as string;
</script>
