<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Profile</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Profile</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="signin-container">
        <div class="brand-icon">
          <ion-icon :icon="codeSlashOutline" />
        </div>

        <h2 class="signin-title">Sign in to Tangled</h2>
        <p class="signin-subtitle">
          Use your AT Protocol handle to sign in and access your starred repos, follow developers, and get a
          personalized activity feed.
        </p>

        <ion-button class="signin-btn" expand="block" @click="handleSignIn">
          <ion-icon slot="start" :icon="logInOutline" />
          Sign in with AT Protocol
        </ion-button>

        <p class="signin-hint">
          Don't have a handle?
          <span class="signin-link">Get one at bsky.app</span>
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon } from "@ionic/vue";
import { codeSlashOutline, logInOutline } from "ionicons/icons";

function handleSignIn() {
  // TODO: AT Protocol OAuth flow
}
</script>

<style scoped>
.signin-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  padding: 32px 28px;
  text-align: center;
  gap: 14px;
}

.brand-icon {
  width: 72px;
  height: 72px;
  border-radius: var(--t-radius-lg);
  background: var(--t-accent-dim);
  border: 1px solid var(--t-border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  color: var(--t-accent);
  margin-bottom: 4px;
}

.signin-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--t-text-primary);
  margin: 0;
  line-height: 1.2;
}

.signin-subtitle {
  font-size: 14px;
  color: var(--t-text-secondary);
  margin: 0;
  line-height: 1.55;
  max-width: 280px;
}

.signin-btn {
  --background: var(--t-accent);
  --background-activated: var(--t-accent);
  --color: #0d1117;
  --border-radius: var(--t-radius-md);
  width: 100%;
  max-width: 320px;
  font-weight: 600;
  font-size: 15px;
  margin-top: 6px;
}

.signin-hint {
  font-size: 13px;
  color: var(--t-text-muted);
  margin: 4px 0 0;
}

.signin-link {
  color: var(--t-accent);
  cursor: pointer;
}
</style>
