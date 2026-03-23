<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Activity</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Activity</ion-title>
        </ion-toolbar>
      </ion-header>

      <EmptyState
        :icon="pulseOutline"
        title="Activity is in progress"
        message="The public activity feed is being rebuilt separately. This tab stays as a placeholder until that work is ready." />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from "@ionic/vue";
import { pulseOutline } from "ionicons/icons";
import EmptyState from "@/components/common/EmptyState.vue";
</script>
