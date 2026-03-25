<template>
  <template v-if="error">
    <div class="error-state">
      <div class="error-icon-wrap">
        <ion-icon :icon="alertCircleOutline" class="error-icon" />
      </div>
      <h3 class="error-title">Something went wrong</h3>
      <p class="error-message">{{ error.message }}</p>
      <ion-button class="retry-btn" fill="outline" size="small" @click="retry">
        <ion-icon slot="start" :icon="refreshOutline" />
        Try again
      </ion-button>
    </div>
  </template>
  <template v-else>
    <slot />
  </template>
</template>

<script setup lang="ts">
  import { ref, onErrorCaptured } from "vue";
  import { IonIcon, IonButton } from "@ionic/vue";
  import { alertCircleOutline, refreshOutline } from "ionicons/icons";

  const error = ref<Error | null>(null);

  onErrorCaptured((err) => {
    error.value = err instanceof Error ? err : new Error(String(err));
    return false;
  });

  function retry() {
    error.value = null;
  }
</script>

<style scoped>
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 32px;
    text-align: center;
    gap: 10px;
  }

  .error-icon-wrap {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--t-red-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }

  .error-icon {
    font-size: 28px;
    color: var(--t-red);
  }

  .error-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--t-text-primary);
    margin: 0;
  }

  .error-message {
    font-size: 13px;
    color: var(--t-text-secondary);
    margin: 0;
    line-height: 1.5;
    max-width: 260px;
    font-family: var(--t-mono);
  }

  .retry-btn {
    --color: var(--t-red);
    --border-color: var(--t-red);
    margin-top: 6px;
  }
</style>
