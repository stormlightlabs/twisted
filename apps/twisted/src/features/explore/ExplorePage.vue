<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Explore</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Explore</ion-title>
        </ion-toolbar>
      </ion-header>

      <section class="search-card">
        <ion-input
          id="search-input"
          v-model="draftQuery"
          class="search-input"
          autocomplete="off"
          autocapitalize="off"
          :spellcheck="false"
          clear-input
          placeholder="Search repos and people…"
          @keydown.enter="runSearch" />

        <ion-segment v-model="resultType" class="search-segment">
          <ion-segment-button value="all">All</ion-segment-button>
          <ion-segment-button value="repo">Repos</ion-segment-button>
          <ion-segment-button value="profile">People</ion-segment-button>
        </ion-segment>

        <p v-if="!hasTwisterApi" class="hint-copy">
          Set <code>VITE_TWISTER_API_BASE_URL</code> to enable global search.
        </p>
      </section>

      <!-- Recent search history (shown when no active search) -->
      <section v-if="showHistory" class="history-section">
        <div class="history-header">
          <span class="section-label">Recent</span>
          <button class="clear-btn" type="button" @click="clearHistory">Clear all</button>
        </div>
        <div class="history-list">
          <div v-for="entry in searchHistory" :key="entry.query" class="history-chip">
            <button class="chip-label" type="button" @click="applyHistoryEntry(entry.query)">
              <ion-icon :icon="timeOutline" class="chip-icon" />
              {{ entry.query }}
            </button>
            <button class="chip-remove" type="button" @click="removeHistoryEntry(entry.query)" aria-label="Remove">
              <ion-icon :icon="closeOutline" />
            </button>
          </div>
        </div>
      </section>

      <section class="results-section">
        <EmptyState
          v-if="!hasTwisterApi"
          :icon="searchOutline"
          title="Index API not configured"
          message="Explore can search globally once the Twister API base URL is configured." />

        <EmptyState
          v-else-if="!hasAttemptedSearch"
          :icon="searchOutline"
          title="Search repos and people"
          message="Start typing to search the project index. Results are filtered by type using the segments above." />

        <template v-else-if="isLoading">
          <SkeletonLoader v-for="n in 3" :key="`repo-${n}`" variant="card" />
          <SkeletonLoader v-for="n in 2" :key="`user-${n}`" variant="list-item" />
        </template>

        <EmptyState
          v-else-if="isError"
          :icon="alertCircleOutline"
          title="Search failed"
          :message="errorMessage"
          action-label="Try Again"
          @action="runSearch" />

        <template v-else-if="hasResults">
          <div class="results-header">
            <div>
              <p class="results-label">Results for</p>
              <h2 class="results-title">{{ submittedQuery }}</h2>
            </div>
            <p class="results-meta">{{ totalLabel }}</p>
          </div>

          <template v-if="repos.length">
            <h3 class="section-label">Repos</h3>
            <RepoCard
              v-for="repo in repos"
              :key="repo.atUri"
              :repo="repo"
              @click="navigateToRepo(repo)"
              @owner-click="navigateToUser(repo.ownerHandle)" />
          </template>

          <template v-if="profiles.length">
            <h3 class="section-label">People</h3>
            <UserCard
              v-for="user in profiles"
              :key="user.did || user.handle"
              :user="user"
              @click="navigateToUser(user.handle)" />
          </template>
        </template>

        <EmptyState
          v-else
          :icon="searchOutline"
          title="No results"
          message="Try a different query. Use Home to jump directly to a known handle." />
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
  import { computed, ref, watch, onUnmounted } from "vue";
  import { useRouter } from "vue-router";
  import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonInput,
    IonSegment,
    IonSegmentButton,
    IonIcon,
  } from "@ionic/vue";
  import { alertCircleOutline, searchOutline, timeOutline, closeOutline } from "ionicons/icons";
  import EmptyState from "@/components/common/EmptyState.vue";
  import RepoCard from "@/components/common/RepoCard.vue";
  import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
  import UserCard from "@/components/common/UserCard.vue";
  import { hasTwisterApi } from "@/core/config/project.js";
  import {
    getSearchHistory,
    addToSearchHistory,
    removeFromSearchHistory,
    clearSearchHistory,
  } from "@/core/search-history/index.js";
  import { trackRepoVisit, trackProfileVisit } from "@/core/browse-history/index.js";
  import type { SearchHistoryEntry } from "@/core/search-history/index.js";
  import type { RepoSummary } from "@/domain/models/repo.js";
  import { useProjectSearch } from "@/services/project-api/queries.js";

  const router = useRouter();

  const draftQuery = ref("");
  const submittedQuery = ref("");
  const hasAttemptedSearch = ref(false);
  const resultType = ref<"all" | "repo" | "profile">("all");
  const searchHistory = ref<SearchHistoryEntry[]>(getSearchHistory());

  const showHistory = computed(
    () => searchHistory.value.length > 0 && !draftQuery.value.trim() && !hasAttemptedSearch.value,
  );

  const searchQuery = useProjectSearch(submittedQuery, {
    type: resultType,
    enabled: computed(() => hasTwisterApi && hasAttemptedSearch.value && submittedQuery.value.length > 0),
  });

  const repos = computed(() => searchQuery.data.value?.repos ?? []);
  const profiles = computed(() => searchQuery.data.value?.profiles ?? []);
  const hasResults = computed(() => repos.value.length > 0 || profiles.value.length > 0);
  const isLoading = computed(() => searchQuery.isPending.value);
  const isError = computed(() => searchQuery.isError.value);
  const errorMessage = computed(() => {
    const err = searchQuery.error.value;
    return err instanceof Error ? err.message : "An unexpected error occurred while searching the project index.";
  });
  const totalLabel = computed(() => {
    const total = searchQuery.data.value?.total ?? repos.value.length + profiles.value.length;
    return `${total} result${total === 1 ? "" : "s"}`;
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  watch(draftQuery, (val) => {
    if (debounceTimer) clearTimeout(debounceTimer);

    const trimmed = val.trim();
    if (!trimmed) {
      return;
    }

    if (!hasTwisterApi) return;

    debounceTimer = setTimeout(() => {
      submittedQuery.value = trimmed;
      hasAttemptedSearch.value = true;
      addToSearchHistory(trimmed);
      searchHistory.value = getSearchHistory();
    }, 400);
  });

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  function runSearch() {
    if (!hasTwisterApi) return;
    const trimmed = draftQuery.value.trim();
    if (!trimmed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    submittedQuery.value = trimmed;
    hasAttemptedSearch.value = true;
    addToSearchHistory(trimmed);
    searchHistory.value = getSearchHistory();
  }

  function applyHistoryEntry(query: string) {
    draftQuery.value = query;
    submittedQuery.value = query;
    hasAttemptedSearch.value = true;
  }

  function removeHistoryEntry(query: string) {
    removeFromSearchHistory(query);
    searchHistory.value = getSearchHistory();
  }

  function clearHistory() {
    clearSearchHistory();
    searchHistory.value = [];
  }

  function navigateToRepo(repo: RepoSummary) {
    trackRepoVisit({
      ownerHandle: repo.ownerHandle,
      name: repo.name,
      description: repo.description,
      primaryLanguage: repo.primaryLanguage,
      stars: repo.stars,
    });
    router.push(`/tabs/explore/repo/${repo.ownerHandle}/${repo.name}`);
  }

  function navigateToUser(handle: string) {
    trackProfileVisit({ handle });
    router.push(`/tabs/explore/user/${handle}`);
  }
</script>

<style scoped>
  .search-card {
    margin: 16px 16px 0;
    padding: 14px 14px 12px;
    border: 1px solid var(--t-border);
    border-radius: var(--t-radius-lg);
    background: linear-gradient(180deg, var(--t-surface-raised), var(--t-surface));
  }

  .search-input {
    --background: rgba(255, 255, 255, 0.04);
    --border-radius: var(--t-radius-md);
    --color: var(--t-text-primary);
    --padding-start: 14px;
    --padding-end: 14px;
    margin-bottom: 10px;
    border: 1px solid var(--t-border);
    border-radius: var(--t-radius-md);
    font-family: var(--t-mono);
  }

  .search-segment {
    margin-bottom: 4px;
  }

  .hint-copy {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--t-text-muted);
  }

  .history-section {
    padding: 14px 16px 4px;
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
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

  .history-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .history-chip {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1px solid var(--t-border);
    border-radius: 999px;
    background: var(--t-surface);
    overflow: hidden;
  }

  .chip-label {
    display: flex;
    align-items: center;
    gap: 6px;
    appearance: none;
    background: transparent;
    border: 0;
    padding: 5px 10px 5px 10px;
    cursor: pointer;
    font-size: 13px;
    color: var(--t-text-primary);
    font-family: var(--t-mono);
  }

  .chip-icon {
    font-size: 13px;
    color: var(--t-text-muted);
    flex-shrink: 0;
  }

  .chip-remove {
    appearance: none;
    background: transparent;
    border: 0;
    border-left: 1px solid var(--t-border);
    padding: 5px 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--t-text-muted);
    display: flex;
    align-items: center;
  }

  .results-section {
    padding: 14px 0 24px;
  }

  .results-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin: 0 16px 12px;
  }

  .results-label {
    margin: 0 0 2px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t-accent);
  }

  .results-title {
    margin: 0;
    font-size: 18px;
    line-height: 1.2;
    color: var(--t-text-primary);
  }

  .results-meta {
    margin: 0;
    font-size: 12px;
    color: var(--t-text-muted);
    white-space: nowrap;
  }

  .section-label {
    display: block;
    margin: 0 16px 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t-text-muted);
  }
</style>
