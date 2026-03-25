<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Home</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Home</ion-title>
        </ion-toolbar>
      </ion-header>

      <section class="lookup-card">
        <label class="field-label" for="handle-input">AT Protocol handle</label>
        <ion-input
          id="handle-input"
          v-model="draftHandle"
          class="handle-input"
          inputmode="email"
          autocomplete="off"
          autocapitalize="off"
          :spellcheck="false"
          clear-input
          placeholder="desertthunder.dev"
          @keydown.enter="openProfile" />

        <div class="action-row">
          <ion-button class="primary-action" expand="block" @click="openProfile" :disabled="!normalizedHandle">
            Open Profile
          </ion-button>
          <ion-button fill="outline" expand="block" @click="browseRepos" :disabled="!normalizedHandle || isBrowsing">
            Browse Repos
          </ion-button>
        </div>

        <p class="hint-copy">Home is the fastest way to jump to a known handle directly.</p>
      </section>

      <!-- Recently viewed repos & profiles -->
      <section v-if="hasRecentItems && !hasAttemptedBrowse" class="recent-section">
        <div class="recent-header">
          <span class="section-label">Recently Viewed</span>
          <button class="clear-btn" type="button" @click="clearRecent">Clear</button>
        </div>

        <template v-if="recentProfiles.length">
          <p class="recent-group-label">Profiles</p>
          <ion-item
            v-for="profile in recentProfiles"
            :key="profile.handle"
            button
            lines="none"
            class="recent-item"
            @click="openRecentProfile(profile.handle)">
            <div slot="start" class="recent-avatar" :style="{ background: avatarColor(profile.handle) }">
              {{ initials(profile.handle) }}
            </div>
            <ion-label>
              <div class="recent-handle">{{ profile.handle }}</div>
              <div v-if="profile.displayName" class="recent-name">{{ profile.displayName }}</div>
            </ion-label>
          </ion-item>
        </template>

        <template v-if="recentRepos.length">
          <p class="recent-group-label">Repos</p>
          <ion-item
            v-for="repo in recentRepos"
            :key="`${repo.ownerHandle}/${repo.name}`"
            button
            lines="none"
            class="recent-item"
            @click="openRecentRepo(repo)">
            <ion-label>
              <div class="recent-repo-title">
                <span class="recent-owner">{{ repo.ownerHandle }}</span
                ><span class="recent-sep">/</span><span class="recent-repo-name">{{ repo.name }}</span>
              </div>
              <div v-if="repo.description" class="recent-desc">{{ repo.description }}</div>
            </ion-label>
            <div v-if="repo.primaryLanguage" slot="end" class="lang-badge">{{ repo.primaryLanguage }}</div>
          </ion-item>
        </template>
      </section>

      <section v-if="hasAttemptedBrowse" class="results-section">
        <template v-if="isLoading">
          <SkeletonLoader variant="profile" />
          <SkeletonLoader v-for="n in 3" :key="n" variant="card" />
        </template>

        <EmptyState
          v-else-if="isError"
          :icon="alertCircleOutline"
          title="Could not resolve handle"
          :message="errorMessage"
          action-label="Try Again"
          @action="browseRepos" />

        <template v-else-if="hasResolvedIdentity">
          <div class="resolved-header">
            <div class="resolved-copy">
              <p class="resolved-label">Resolved account</p>
              <h2 class="resolved-title mono">{{ normalizedHandle }}</h2>
              <p class="resolved-meta">
                <span>{{ displayName }}</span>
                <span class="meta-separator">·</span>
                <span>{{ repoCountLabel }}</span>
              </p>
            </div>
            <ion-button fill="outline" size="small" @click="openResolvedProfile">View Profile</ion-button>
          </div>

          <template v-if="repos.length">
            <RepoCard
              v-for="repo in repos"
              :key="repo.atUri"
              :repo="repo"
              @click="navigateToRepo(repo)"
              @owner-click="openResolvedProfile" />
          </template>
          <EmptyState
            v-else
            :icon="folderOpenOutline"
            title="No public repos yet"
            message="This handle resolved successfully, but there are no public Tangled repositories yet." />
        </template>
      </section>

      <section v-else-if="!hasRecentItems" class="results-section">
        <EmptyState
          :icon="compassOutline"
          title="Browse by handle"
          message="Enter an AT Protocol handle above to view their profile and repos." />
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
  import { computed, ref } from "vue";
  import { useRouter } from "vue-router";
  import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonInput,
    IonButton,
    IonItem,
    IonLabel,
  } from "@ionic/vue";
  import { alertCircleOutline, compassOutline, folderOpenOutline } from "ionicons/icons";
  import RepoCard from "@/components/common/RepoCard.vue";
  import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
  import EmptyState from "@/components/common/EmptyState.vue";
  import { useIdentity, useUserRepos, useActorProfile } from "@/services/tangled/queries.js";
  import {
    trackRepoVisit,
    trackProfileVisit,
    getRecentRepos,
    getRecentProfiles,
    clearBrowseHistory,
  } from "@/core/browse-history/index.js";
  import type { RepoSummary } from "@/domain/models/repo.js";
  import type { RecentRepo, RecentProfile } from "@/core/browse-history/index.js";

  const router = useRouter();

  const draftHandle = ref("");
  const activeHandle = ref("");
  const hasAttemptedBrowse = ref(false);
  const recentRepos = ref<RecentRepo[]>(getRecentRepos());
  const recentProfiles = ref<RecentProfile[]>(getRecentProfiles());

  const normalizedHandle = computed(() => draftHandle.value.trim().toLowerCase());
  const hasHandle = computed(() => normalizedHandle.value.length > 0);
  const hasRecentItems = computed(() => recentRepos.value.length > 0 || recentProfiles.value.length > 0);

  const identity = useIdentity(activeHandle, { enabled: computed(() => !!activeHandle.value) });
  const did = computed(() => identity.data.value?.did ?? "");
  const pds = computed(() => identity.data.value?.pds ?? "");
  const hasResolvedIdentity = computed(() => !!identity.data.value);

  const profileQuery = useActorProfile(pds, did, activeHandle, undefined, { enabled: hasResolvedIdentity });
  const reposQuery = useUserRepos(pds, did, activeHandle, { enabled: hasResolvedIdentity });

  const repos = computed(() => reposQuery.data.value ?? []);
  const displayName = computed(() => profileQuery.data.value?.displayName ?? "Public Tangled account");
  const repoCountLabel = computed(() => `${repos.value.length} repo${repos.value.length === 1 ? "" : "s"}`);
  const isBrowsing = computed(
    () => hasAttemptedBrowse.value && activeHandle.value === normalizedHandle.value && isLoading.value,
  );
  const isLoading = computed(
    () =>
      hasAttemptedBrowse.value &&
      activeHandle.value.length > 0 &&
      (identity.isPending.value || (hasResolvedIdentity.value && reposQuery.isPending.value)),
  );
  const isError = computed(() => hasAttemptedBrowse.value && (identity.isError.value || reposQuery.isError.value));
  const errorMessage = computed(() => {
    const err = identity.error.value ?? reposQuery.error.value;
    return err instanceof Error ? err.message : "An unexpected error occurred while resolving this handle.";
  });

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

  function openProfile() {
    if (!hasHandle.value) return;
    trackProfileVisit({ handle: normalizedHandle.value });
    router.push(`/tabs/home/user/${normalizedHandle.value}`);
  }

  function browseRepos() {
    if (!hasHandle.value) return;
    hasAttemptedBrowse.value = true;
    activeHandle.value = normalizedHandle.value;
  }

  function openResolvedProfile() {
    if (!activeHandle.value) return;
    trackProfileVisit({
      handle: activeHandle.value,
      displayName: profileQuery.data.value?.displayName,
      bio: profileQuery.data.value?.bio,
    });
    router.push(`/tabs/home/user/${activeHandle.value}`);
  }

  function navigateToRepo(repo: RepoSummary) {
    trackRepoVisit({
      ownerHandle: repo.ownerHandle,
      name: repo.name,
      description: repo.description,
      primaryLanguage: repo.primaryLanguage,
      stars: repo.stars,
    });
    router.push(`/tabs/home/repo/${repo.ownerHandle}/${repo.name}`);
  }

  function openRecentProfile(handle: string) {
    trackProfileVisit({ handle });
    router.push(`/tabs/home/user/${handle}`);
  }

  function openRecentRepo(repo: RecentRepo) {
    trackRepoVisit(repo);
    recentRepos.value = getRecentRepos();
    router.push(`/tabs/home/repo/${repo.ownerHandle}/${repo.name}`);
  }

  function clearRecent() {
    clearBrowseHistory();
    recentRepos.value = [];
    recentProfiles.value = [];
  }
</script>

<style scoped>
  .lookup-card {
    margin: 16px 16px 0;
    padding: 18px 16px 16px;
    border: 1px solid var(--t-border);
    border-radius: var(--t-radius-lg);
    background: linear-gradient(180deg, var(--t-surface-raised), var(--t-surface));
  }

  .field-label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--t-text-primary);
  }

  .handle-input {
    --background: rgba(255, 255, 255, 0.04);
    --border-radius: var(--t-radius-md);
    --color: var(--t-text-primary);
    --padding-start: 14px;
    --padding-end: 14px;
    margin-bottom: 12px;
    border: 1px solid var(--t-border);
    border-radius: var(--t-radius-md);
    font-family: var(--t-mono);
  }

  .action-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .primary-action {
    --background: var(--t-accent);
    --background-activated: var(--t-accent);
    --color: #0d1117;
  }

  .hint-copy {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--t-text-muted);
  }

  .recent-section {
    padding: 16px 0 8px;
  }

  .recent-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    margin-bottom: 10px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t-text-muted);
  }

  .clear-btn {
    appearance: none;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    font-size: 12px;
    color: var(--t-text-muted);
  }

  .recent-group-label {
    margin: 8px 16px 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--t-text-muted);
  }

  .recent-item {
    --background: transparent;
    --padding-start: 16px;
    --padding-end: 16px;
    --inner-padding-end: 0;
    --min-height: 48px;
  }

  .recent-avatar {
    width: 32px;
    height: 32px;
    border-radius: var(--t-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--t-mono);
    font-size: 11px;
    font-weight: 700;
    color: #0d1117;
    margin-right: 12px;
    flex-shrink: 0;
  }

  .recent-handle {
    font-family: var(--t-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--t-accent);
  }

  .recent-name {
    font-size: 12px;
    color: var(--t-text-secondary);
    margin-top: 1px;
  }

  .recent-repo-title {
    font-family: var(--t-mono);
    font-size: 13px;
    font-weight: 500;
    color: var(--t-text-primary);
    line-height: 1.3;
  }

  .recent-owner {
    color: var(--t-text-secondary);
  }

  .recent-sep {
    color: var(--t-text-muted);
    margin: 0 1px;
  }

  .recent-repo-name {
    color: var(--t-accent);
  }

  .recent-desc {
    font-size: 12px;
    color: var(--t-text-muted);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lang-badge {
    font-family: var(--t-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--t-text-muted);
    padding: 2px 6px;
    border: 1px solid var(--t-border);
    border-radius: 999px;
  }

  /* Browse results */

  .results-section {
    padding: 18px 0 24px;
  }

  .resolved-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin: 0 16px 10px;
    padding: 16px;
    border: 1px solid var(--t-border);
    border-radius: var(--t-radius-md);
    background: var(--t-surface);
  }

  .resolved-copy {
    min-width: 0;
  }

  .resolved-label {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--t-text-muted);
  }

  .resolved-title {
    margin: 0;
    font-size: 15px;
    color: var(--t-text-primary);
    word-break: break-word;
  }

  .resolved-meta {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--t-text-secondary);
  }

  .meta-separator {
    margin: 0 6px;
    color: var(--t-text-muted);
  }

  .mono {
    font-family: var(--t-mono);
  }

  @media (max-width: 480px) {
    .action-row {
      grid-template-columns: 1fr;
    }

    .resolved-header {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
