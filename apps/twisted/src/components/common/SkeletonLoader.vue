<template>
  <!-- card variant -->
  <ion-card v-if="variant === 'card'" class="skeleton-card">
    <ion-card-content class="card-body">
      <div class="row space-between">
        <ion-skeleton-text animated class="skel skel-title" />
        <ion-skeleton-text animated class="skel skel-stars" />
      </div>
      <ion-skeleton-text animated class="skel skel-desc" />
      <ion-skeleton-text animated class="skel skel-desc-short" />
      <div class="row">
        <ion-skeleton-text animated class="skel skel-badge" />
        <ion-skeleton-text animated class="skel skel-time" />
      </div>
    </ion-card-content>
  </ion-card>

  <!-- list-item variant -->
  <ion-item v-else-if="variant === 'list-item'" class="skeleton-item" lines="none">
    <ion-skeleton-text animated slot="start" class="skel skel-avatar" />
    <ion-label>
      <ion-skeleton-text animated class="skel skel-item-title" />
      <ion-skeleton-text animated class="skel skel-item-sub" />
    </ion-label>
  </ion-item>

  <!-- profile variant -->
  <div v-else-if="variant === 'profile'" class="skeleton-profile">
    <ion-skeleton-text animated class="skel skel-profile-avatar" />
    <div class="profile-lines">
      <ion-skeleton-text animated class="skel skel-profile-handle" />
      <ion-skeleton-text animated class="skel skel-profile-name" />
      <ion-skeleton-text animated class="skel skel-profile-bio" />
      <ion-skeleton-text animated class="skel skel-profile-bio-short" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent, IonItem, IonLabel, IonSkeletonText } from "@ionic/vue";

defineProps<{ variant: "card" | "list-item" | "profile" }>();
</script>

<style scoped>
/* shared */
.skel {
  border-radius: 4px;
  line-height: 1;
}

/* card */
.skeleton-card {
  --background: var(--t-surface);
  margin: 6px 16px;
  border-radius: var(--t-radius-md);
  border: 1px solid var(--t-border);
  box-shadow: none;
}

.card-body {
  padding: 14px 16px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.space-between {
  justify-content: space-between;
  margin-bottom: 10px;
}

.skel-title {
  height: 13px;
  width: 55%;
}
.skel-stars {
  height: 12px;
  width: 40px;
  flex-shrink: 0;
}
.skel-desc {
  height: 12px;
  width: 90%;
  margin-bottom: 5px;
}
.skel-desc-short {
  height: 12px;
  width: 60%;
  margin-bottom: 12px;
}
.skel-badge {
  height: 10px;
  width: 80px;
}
.skel-time {
  height: 10px;
  width: 50px;
}

/* list-item */
.skeleton-item {
  --background: transparent;
  --padding-start: 16px;
  --inner-padding-end: 16px;
}

.skel-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 12px;
}
.skel-item-title {
  height: 13px;
  width: 50%;
  margin-bottom: 7px;
}
.skel-item-sub {
  height: 11px;
  width: 35%;
}

/* profile */
.skeleton-profile {
  display: flex;
  gap: 14px;
  padding: 16px;
}

.skel-profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--t-radius-sm);
  flex-shrink: 0;
}

.profile-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 4px;
}

.skel-profile-handle {
  height: 12px;
  width: 55%;
}
.skel-profile-name {
  height: 13px;
  width: 45%;
}
.skel-profile-bio {
  height: 11px;
  width: 90%;
}
.skel-profile-bio-short {
  height: 11px;
  width: 70%;
}
</style>
