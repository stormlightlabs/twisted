<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Settings</ion-title>
        </ion-toolbar>
      </ion-header>

      <section class="hero">
        <p class="eyebrow">Display & Storage</p>
        <h1 class="hero-title">Tune how Twisted looks and how much local data it keeps around.</h1>
        <p class="hero-copy">
          Theme changes apply immediately. Clearing the cache removes saved query data from this device and forces a
          fresh fetch the next time those screens load.
        </p>
      </section>

      <section class="settings-card">
        <div class="section-head">
          <div>
            <p class="section-label">Theme</p>
            <h2 class="section-title">Appearance</h2>
          </div>
          <div class="theme-chip">{{ resolvedThemeLabel }}</div>
        </div>

        <ion-segment :value="themePreference" class="theme-segment" @ionChange="handleThemeChange">
          <ion-segment-button value="system">
            <ion-label>System</ion-label>
          </ion-segment-button>
          <ion-segment-button value="light">
            <ion-label>Light</ion-label>
          </ion-segment-button>
          <ion-segment-button value="dark">
            <ion-label>Dark</ion-label>
          </ion-segment-button>
        </ion-segment>

        <p class="helper-copy">{{ themeHelperCopy }}</p>
      </section>

      <section class="settings-card danger-card">
        <div class="section-head">
          <div>
            <p class="section-label">Cache</p>
            <h2 class="section-title">Local data</h2>
          </div>
          <ion-icon class="danger-icon" :icon="trashOutline" />
        </div>

        <p class="helper-copy">
          This clears the persisted TanStack Query cache for Twisted on this device. Your account and app code stay
          untouched.
        </p>

        <ion-button
          class="danger-button"
          color="danger"
          expand="block"
          @click="showClearConfirm = true"
          :disabled="isClearing">
          {{ isClearing ? "Clearing cache..." : "Clear cache" }}
        </ion-button>
      </section>

      <ion-alert
        :is-open="showClearConfirm"
        header="Clear local cache?"
        message="Saved repo, profile, and activity query data will be removed from this device."
        :buttons="alertButtons"
        @didDismiss="showClearConfirm = false" />

      <ion-toast :is-open="isToastOpen" :message="toastMessage" :duration="2200" @didDismiss="isToastOpen = false" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
  import { computed, ref } from "vue";
  import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonButton,
    IonIcon,
    IonAlert,
    IonToast,
  } from "@ionic/vue";
  import { trashOutline } from "ionicons/icons";
  import { clearAppCache } from "@/core/query/cache.js";
  import { setThemePreference, useThemePreference } from "@/core/theme/preferences.js";
  import type { ThemePreference } from "@/core/theme/preferences.js";

  const { themePreference, resolvedTheme, isSystemTheme } = useThemePreference();

  const showClearConfirm = ref(false);
  const isClearing = ref(false);
  const isToastOpen = ref(false);
  const toastMessage = ref("");

  const resolvedThemeLabel = computed(() => `${resolvedTheme.value === "dark" ? "Dark" : "Light"} active`);
  const themeHelperCopy = computed(() => {
    if (isSystemTheme.value) {
      return `Following your device right now. Twisted is currently rendering in ${resolvedTheme.value} mode.`;
    }

    return `Twisted is locked to the ${resolvedTheme.value} theme until you switch it again.`;
  });

  const alertButtons = [
    { text: "Cancel", role: "cancel" },
    {
      text: "Clear",
      role: "destructive",
      handler: () => {
        void handleClearCache();
      },
    },
  ];

  function handleThemeChange(event: CustomEvent<{ value?: string | number }>) {
    const nextValue = event.detail.value;
    if (!isThemePreference(nextValue)) return;
    setThemePreference(nextValue);
  }

  async function handleClearCache() {
    showClearConfirm.value = false;
    if (isClearing.value) return;

    isClearing.value = true;

    try {
      await clearAppCache();
      toastMessage.value = "Cache cleared.";
    } catch (error) {
      toastMessage.value = error instanceof Error ? error.message : "Could not clear the cache.";
    } finally {
      isClearing.value = false;
      isToastOpen.value = true;
    }
  }

  function isThemePreference(value: unknown): value is ThemePreference {
    return value === "system" || value === "light" || value === "dark";
  }
</script>

<style scoped>
  .hero {
    padding: 24px 20px 12px;
  }

  .eyebrow {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t-accent);
  }

  .hero-title {
    margin: 0;
    font-size: 28px;
    line-height: 1.15;
    color: var(--t-text-primary);
  }

  .hero-copy {
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--t-text-secondary);
    max-width: 38rem;
  }

  .settings-card {
    margin: 0 16px 16px;
    padding: 18px 16px 16px;
    border: 1px solid var(--t-border);
    border-radius: var(--t-radius-lg);
    background:
      radial-gradient(circle at top right, var(--t-accent-dim), transparent 42%),
      linear-gradient(180deg, var(--t-surface-raised), var(--t-surface));
    box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
  }

  .danger-card {
    background:
      radial-gradient(circle at top right, var(--t-red-dim), transparent 42%),
      linear-gradient(180deg, var(--t-surface-raised), var(--t-surface));
  }

  .section-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .section-label {
    margin: 0 0 4px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t-text-muted);
  }

  .section-title {
    margin: 0;
    font-size: 20px;
    line-height: 1.2;
    color: var(--t-text-primary);
  }

  .theme-chip {
    padding: 8px 10px;
    border: 1px solid var(--t-border-strong);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--t-text-primary);
  }

  .theme-segment {
    margin-top: 18px;
    --background: transparent;
  }

  .helper-copy {
    margin: 14px 0 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--t-text-secondary);
  }

  .danger-icon {
    font-size: 22px;
    color: var(--t-red);
  }

  .danger-button {
    margin-top: 16px;
  }
</style>
