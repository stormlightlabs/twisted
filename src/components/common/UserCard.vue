<template>
  <ion-card class="user-card" button @click="emit('click')">
    <ion-card-content class="card-body">
      <div class="user-row">
        <ion-avatar class="avatar">
          <div class="avatar-fallback" :style="{ background: avatarColor(user.handle) }">
            {{ initials(user.handle) }}
          </div>
        </ion-avatar>

        <div class="user-info">
          <div class="user-handle">{{ user.handle }}</div>
          <div v-if="user.displayName" class="user-display-name">{{ user.displayName }}</div>
          <p v-if="user.bio" class="user-bio">{{ user.bio }}</p>
        </div>
      </div>

      <div v-if="user.followerCount != null || user.followingCount != null" class="user-stats">
        <span v-if="user.followerCount != null" class="stat">
          <strong>{{ formatCount(user.followerCount) }}</strong> followers
        </span>
        <span v-if="user.followingCount != null" class="stat">
          <strong>{{ formatCount(user.followingCount) }}</strong> following
        </span>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent, IonAvatar } from "@ionic/vue";
import type { UserSummary } from "@/domain/models/user";

defineProps<{ user: UserSummary }>();
const emit = defineEmits<{ click: [] }>();

const PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#fb923c", "#60a5fa"];

function avatarColor(handle: string): string {
  let hash = 0;
  for (const ch of handle) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initials(handle: string): string {
  const base = handle.split(".")[0];
  return base.slice(0, 2).toUpperCase();
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
</script>

<style scoped>
.user-card {
  --background: var(--t-surface);
  margin: 6px 16px;
  border-radius: var(--t-radius-md);
  border: 1px solid var(--t-border);
  box-shadow: none;
}

.card-body {
  padding: 14px 16px;
}

.user-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.avatar {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: var(--t-radius-sm);
  overflow: hidden;
}

.avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--t-mono);
  font-size: 13px;
  font-weight: 700;
  color: #0d1117;
  border-radius: var(--t-radius-sm);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-handle {
  font-family: var(--t-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--t-accent);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-display-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--t-text-primary);
  margin-top: 1px;
  line-height: 1.3;
}

.user-bio {
  font-size: 12px;
  color: var(--t-text-secondary);
  margin: 4px 0 0;
  line-height: 1.4;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.user-stats {
  display: flex;
  gap: 14px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--t-border);
}

.stat {
  font-size: 12px;
  color: var(--t-text-muted);
}

.stat strong {
  font-weight: 600;
  color: var(--t-text-secondary);
}
</style>
