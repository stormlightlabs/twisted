<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/profile" />
        </ion-buttons>
        <ion-title>Sign In</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="login-container">
        <div class="brand-icon">
          <ion-icon :icon="codeSlashOutline" />
        </div>

        <h2 class="login-title">Sign in to Tangled</h2>
        <p class="login-subtitle">Enter your AT Protocol handle to sign in with OAuth.</p>

        <form @submit.prevent="handleSignIn">
          <ion-item class="handle-input" lines="none">
            <ion-input
              v-model="handle"
              type="text"
              placeholder="username.bsky.social"
              :disabled="isLoading"
              autocomplete="username"
              enterkeyhint="go" />
          </ion-item>

          <ion-button class="login-btn" expand="block" type="submit" :disabled="!handle.trim() || isLoading">
            <ion-icon v-if="!isLoading" slot="start" :icon="logInOutline" />
            <ion-spinner v-else slot="start" name="crescent" />
            {{ isLoading ? "Signing in..." : "Continue with OAuth" }}
          </ion-button>
        </form>

        <p v-if="error" class="login-error">{{ error }}</p>

        <p class="login-hint">
          Don't have a handle?
          <a href="https://bsky.app" target="_blank" rel="noopener">Get one at bsky.app</a>
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
  import { ref } from "vue";
  import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonButtons,
    IonBackButton,
    IonItem,
    IonInput,
    IonSpinner,
    toastController,
  } from "@ionic/vue";
  import { codeSlashOutline, logInOutline } from "ionicons/icons";
  import { createAuthorizationUrl } from "@atcute/oauth-browser-client";
  import { useAuthStore } from "@/core/auth/store.js";
  import type { Handle } from "@atcute/lexicons/syntax";

  const authStore = useAuthStore();

  const handle = ref("");
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function handleSignIn() {
    const trimmedHandle = handle.value.trim() as Handle;
    if (!trimmedHandle) return;

    isLoading.value = true;
    error.value = null;
    authStore.state = "authenticating";

    try {
      const authUrl = await createAuthorizationUrl({
        target: { type: "account", identifier: trimmedHandle },
        scope: "atproto",
      });

      window.location.href = authUrl.toString();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to start sign in";
      authStore.state = "error";
      isLoading.value = false;

      const toast = await toastController.create({ message: error.value, duration: 3000, color: "danger" });
      await toast.present();
    }
  }
</script>

<style scoped>
  .login-container {
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

  .login-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--t-text-primary);
    margin: 0;
    line-height: 1.2;
  }

  .login-subtitle {
    font-size: 14px;
    color: var(--t-text-secondary);
    margin: 0;
    line-height: 1.55;
    max-width: 280px;
  }

  .handle-input {
    --background: var(--ion-color-light);
    --border-radius: var(--t-radius-md);
    --padding-start: 16px;
    --padding-end: 16px;
    width: 100%;
    max-width: 320px;
    margin-bottom: 8px;
  }

  .login-btn {
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

  .login-error {
    font-size: 13px;
    color: var(--ion-color-danger);
    margin: 8px 0 0;
    max-width: 280px;
  }

  .login-hint {
    font-size: 13px;
    color: var(--t-text-muted);
    margin: 4px 0 0;
  }

  .login-hint a {
    color: var(--t-accent);
    text-decoration: none;
  }
</style>
