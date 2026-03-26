<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home" href="/tabs/home">
          <ion-icon :icon="homeOutline" />
          <ion-label>Home</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="explore" href="/tabs/explore">
          <ion-icon :icon="searchOutline" />
          <ion-label>Explore</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="activity" href="/tabs/activity">
          <ion-icon :icon="pulseOutline" />
          <ion-label>Activity</ion-label>
        </ion-tab-button>
        <ion-tab-button :tab="profileTab.tab" :href="profileTab.href">
          <ion-icon :icon="profileTab.icon" />
          <ion-label>{{ profileTab.label }}</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="settings" href="/tabs/settings">
          <ion-icon :icon="settingsOutline" />
          <ion-label>Settings</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
  import { IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, IonIcon, IonLabel } from "@ionic/vue";
  import {
    homeOutline,
    searchOutline,
    pulseOutline,
    personOutline,
    settingsOutline,
    bookmarkOutline,
  } from "ionicons/icons";
  import { computed } from "vue";
  import { useDevAuthFeatures } from "@/core/auth/dev-access.ts";

  const { isDevAuthEnabled } = useDevAuthFeatures();

  const profileTab = computed(() => {
    if (isDevAuthEnabled.value) {
      return { tab: "profile", href: "/tabs/profile", label: "Profile", icon: personOutline };
    }

    return { tab: "bookmarks", href: "/tabs/bookmarks", label: "Bookmarks", icon: bookmarkOutline };
  });
</script>
