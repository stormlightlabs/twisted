<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Explore</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Explore</ion-title>
        </ion-toolbar>
      </ion-header>

      <EmptyState
        :icon="searchOutline"
        title="Search is in progress"
        message="Global repo and user search is being built separately. For now, use Home to jump to a known handle and browse that account's repos." />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from "@ionic/vue";
import { searchOutline } from "ionicons/icons";
import EmptyState from "@/components/common/EmptyState.vue";
</script>
