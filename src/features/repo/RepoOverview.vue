<template>
  <div class="overview">
    <!-- Header stats -->
    <div class="stats-row">
      <div class="stat-item">
        <ion-icon :icon="starOutline" class="stat-icon amber" />
        <span class="stat-value">{{ repo.stars ?? 0 }}</span>
        <span class="stat-label">stars</span>
      </div>
      <div class="stat-item">
        <ion-icon :icon="gitBranchOutline" class="stat-icon accent" />
        <span class="stat-value">{{ repo.forks ?? 0 }}</span>
        <span class="stat-label">forks</span>
      </div>
      <div v-if="repo.defaultBranch" class="stat-item">
        <ion-icon :icon="codeOutline" class="stat-icon muted" />
        <span class="stat-value mono">{{ repo.defaultBranch }}</span>
      </div>
    </div>

    <!-- Description -->
    <p v-if="repo.description" class="repo-description">{{ repo.description }}</p>

    <!-- Topics -->
    <div v-if="repo.topics?.length" class="topics-row">
      <ion-chip v-for="topic in repo.topics" :key="topic" class="topic-chip">
        {{ topic }}
      </ion-chip>
    </div>

    <!-- Language breakdown -->
    <div v-if="repo.languages && Object.keys(repo.languages).length" class="section">
      <h3 class="section-label">Languages</h3>
      <div class="lang-list">
        <div v-for="[lang, pct] in langEntries" :key="lang" class="lang-row">
          <span class="lang-dot" :style="{ background: langColor(lang) }" />
          <span class="lang-name">{{ lang }}</span>
          <span class="lang-pct">{{ pct }}%</span>
        </div>
      </div>
    </div>

    <!-- README -->
    <div class="section">
      <h3 class="section-label">README</h3>
      <MarkdownRenderer v-if="repo.readme" :content="repo.readme" />
      <EmptyState v-else :icon="documentOutline" title="No README" message="This repo doesn't have a README yet." />
    </div>

    <!-- Recent Commits -->
    <div v-if="commits && commits.length > 0" class="section">
      <h3 class="section-label">Recent Commits</h3>
      <div class="commit-list">
        <div v-for="commit in commits.slice(0, 10)" :key="commit.hash" class="commit-row">
          <span class="commit-hash mono">{{ commit.shortHash ?? commit.hash.slice(0, 7) }}</span>
          <span class="commit-message">{{ commit.message }}</span>
          <span v-if="commit.when" class="commit-when">{{ relativeTime(commit.when) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from "vue";
  import { IonIcon, IonChip } from "@ionic/vue";
  import { starOutline, gitBranchOutline, codeOutline, documentOutline } from "ionicons/icons";
  import MarkdownRenderer from "@/components/repo/MarkdownRenderer.vue";
  import EmptyState from "@/components/common/EmptyState.vue";
  import type { RepoDetail } from "@/domain/models/repo.js";
  import type { CommitEntry } from "@/services/tangled/queries.js";

  const props = defineProps<{ repo: RepoDetail; commits?: CommitEntry[] }>();

  function relativeTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const days = Math.floor(h / 24);
    if (days > 0) return `${days}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return "just now";
  }

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
  };

  function langColor(lang: string): string {
    return LANG_COLORS[lang] ?? "var(--t-text-muted)";
  }

  const langEntries = computed(() => Object.entries(props.repo.languages ?? {}).sort(([, a], [, b]) => b - a));
</script>

<style scoped>
  .overview {
    padding-bottom: 32px;
  }

  .stats-row {
    display: flex;
    gap: 20px;
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--t-border);
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .stat-icon {
    font-size: 14px;
  }

  .stat-icon.amber {
    color: var(--t-amber);
  }
  .stat-icon.accent {
    color: var(--t-accent);
  }
  .stat-icon.muted {
    color: var(--t-text-muted);
  }

  .stat-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--t-text-primary);
  }

  .stat-value.mono {
    font-family: var(--t-mono);
    font-size: 12px;
  }

  .stat-label {
    font-size: 12px;
    color: var(--t-text-muted);
  }

  .repo-description {
    font-size: 14px;
    color: var(--t-text-secondary);
    margin: 14px 16px 0;
    line-height: 1.55;
  }

  .topics-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 12px 16px 0;
  }

  .topic-chip {
    --background: var(--t-accent-dim);
    --color: var(--t-accent);
    border: 1px solid var(--t-border-strong);
    font-size: 12px;
    height: 26px;
    margin: 0;
  }

  .section {
    margin-top: 20px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--t-text-muted);
    margin: 0 16px 10px;
  }

  .lang-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 16px;
  }

  .lang-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .lang-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .lang-name {
    font-size: 13px;
    color: var(--t-text-secondary);
    flex: 1;
  }

  .lang-pct {
    font-family: var(--t-mono);
    font-size: 12px;
    color: var(--t-text-muted);
  }

  .commit-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid var(--t-border);
    border-radius: var(--t-radius-md);
    margin: 0 16px;
    overflow: hidden;
  }

  .commit-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--t-border);
  }

  .commit-row:last-child {
    border-bottom: none;
  }

  .commit-hash {
    font-family: var(--t-mono);
    font-size: 11px;
    color: var(--t-accent);
    flex-shrink: 0;
    width: 52px;
  }

  .commit-message {
    font-size: 12px;
    color: var(--t-text-secondary);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .commit-when {
    font-size: 11px;
    color: var(--t-text-muted);
    flex-shrink: 0;
  }
</style>
