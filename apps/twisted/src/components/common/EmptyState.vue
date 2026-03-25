<template>
  <div class="empty-state">
    <div class="icon-wrap">
      <ion-icon :icon="icon" class="empty-icon" />
    </div>
    <h3 class="empty-title">{{ title }}</h3>
    <p v-if="message" class="empty-message">{{ message }}</p>
    <ion-button v-if="actionLabel" class="empty-action" fill="outline" size="small" @click="emit('action')">
      {{ actionLabel }}
    </ion-button>
  </div>
</template>

<script setup lang="ts">
  import { IonIcon, IonButton } from "@ionic/vue";

  defineProps<{ icon: string; title: string; message?: string; actionLabel?: string }>();

  const emit = defineEmits<{ action: [] }>();
</script>

<style scoped>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 32px;
    text-align: center;
    gap: 10px;
  }

  .icon-wrap {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--t-accent-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }

  .empty-icon {
    font-size: 28px;
    color: var(--t-accent);
  }

  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--t-text-primary);
    margin: 0;
    line-height: 1.3;
  }

  .empty-message {
    font-size: 13px;
    color: var(--t-text-secondary);
    margin: 0;
    line-height: 1.5;
    max-width: 260px;
  }

  .empty-action {
    --color: var(--t-accent);
    --border-color: var(--t-accent);
    margin-top: 6px;
  }
</style>
