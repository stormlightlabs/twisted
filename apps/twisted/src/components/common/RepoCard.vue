<template>
  <ion-card class="repo-card" button @click="emit('click')">
    <ion-card-content class="card-body">
      <div class="repo-header">
        <button class="repo-owner" type="button" @click.stop="emit('ownerClick')">{{ repo.ownerHandle }}/</button>
        <span class="repo-name">{{ repo.name }}</span>
        <div v-if="repo.stars != null" class="stars">
          <ion-icon :icon="starOutline" class="star-icon" />
          <span class="star-count">{{ formatCount(repo.stars) }}</span>
        </div>
      </div>

      <p v-if="repo.description" class="repo-description">{{ repo.description }}</p>

      <div class="repo-meta">
        <span v-if="repo.primaryLanguage" class="lang-badge">
          <span class="lang-dot" :style="{ background: langColor(repo.primaryLanguage) }" />
          {{ repo.primaryLanguage }}
        </span>
        <span v-if="repo.updatedAt" class="meta-dot">·</span>
        <span v-if="repo.updatedAt" class="updated-at">{{ relativeTime(repo.updatedAt) }}</span>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent, IonIcon } from "@ionic/vue";
import { starOutline } from "ionicons/icons";
import type { RepoSummary } from "@/domain/models/repo";

defineProps<{ repo: RepoSummary }>();
const emit = defineEmits<{ click: []; ownerClick: [] }>();

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f7df1e",
  Go: "#00add8",
  Python: "#3572A5",
  Rust: "#dea584",
  Nix: "#7ebae4",
  Ruby: "#cc342d",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Shell: "#89e051",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
};

function langColor(lang: string): string {
  return LANG_COLORS[lang] ?? "var(--t-text-muted)";
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}
</script>

<style scoped>
.repo-card {
  --background: var(--t-surface);
  margin: 6px 16px;
  border-radius: var(--t-radius-md);
  border: 1px solid var(--t-border);
  box-shadow: none;
}

.card-body {
  padding: 14px 16px;
}

.repo-header {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 6px;
}

.repo-owner {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0;
  margin: 0;
  cursor: pointer;
  font-family: var(--t-mono);
  font-size: 13px;
  color: var(--t-text-secondary);
  line-height: 1.4;
}

.repo-name {
  font-family: var(--t-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--t-accent);
  line-height: 1.4;
  flex: 1;
}

.stars {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  padding-left: 8px;
  flex-shrink: 0;
}

.star-icon {
  font-size: 12px;
  color: var(--t-amber);
}

.star-count {
  font-family: var(--t-mono);
  font-size: 12px;
  color: var(--t-text-secondary);
}

.repo-description {
  font-size: 13px;
  color: var(--t-text-secondary);
  margin: 0 0 10px;
  line-height: 1.5;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.repo-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lang-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--t-text-secondary);
}

.lang-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.meta-dot {
  color: var(--t-text-muted);
  font-size: 12px;
}

.updated-at {
  font-size: 12px;
  color: var(--t-text-muted);
}
</style>
