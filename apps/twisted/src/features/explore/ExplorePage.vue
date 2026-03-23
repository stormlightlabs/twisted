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

      <section class="hero">
        <p class="eyebrow">Indexed Search</p>
        <h1 class="hero-title">Search the Tangled network through the project index.</h1>
        <p class="hero-copy">
          Explore uses the Twister index for global search. Open any result to continue browsing through Tangled's
          public repo and profile APIs.
        </p>
      </section>

      <section class="search-card">
        <label class="field-label" for="search-input">Search query</label>
        <ion-input
          id="search-input"
          v-model="draftQuery"
          class="search-input"
          autocomplete="off"
          autocapitalize="off"
          :spellcheck="false"
          clear-input
          placeholder="Search repos, profiles, issues, and strings"
          @keydown.enter="runSearch" />

        <ion-segment v-model="resultType" class="search-segment">
          <ion-segment-button value="all">All</ion-segment-button>
          <ion-segment-button value="repo">Repos</ion-segment-button>
          <ion-segment-button value="profile">People</ion-segment-button>
        </ion-segment>

        <div class="action-row">
          <ion-button class="primary-action" expand="block" @click="runSearch" :disabled="!canSearch">
            Search
          </ion-button>
          <ion-button fill="outline" expand="block" @click="clearSearch" :disabled="!hasAnyQuery">Clear</ion-button>
        </div>

        <p v-if="hasTwisterApi" class="hint-copy">
          Search results and follower counts come from the project index when available.
        </p>
        <p v-else class="hint-copy">
          Set <code>VITE_TWISTER_API_BASE_URL</code> to enable global search and index-backed graph summaries.
        </p>
      </section>

      <section class="results-section">
        <EmptyState
          v-if="!hasTwisterApi"
          :icon="searchOutline"
          title="Index API not configured"
          message="Explore can search globally once the Twister API base URL is configured for this app." />

        <EmptyState
          v-else-if="!hasAttemptedSearch"
          :icon="searchOutline"
          title="Search repos and people"
          message="Run a query against the project index, then open any result to continue browsing with Tangled's public APIs." />

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
              <p class="results-label">Indexed results</p>
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
          title="No indexed matches"
          message="Try a different query, or use Home to jump directly to a known handle." />
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
  IonSegment,
  IonSegmentButton,
} from "@ionic/vue";
import { alertCircleOutline, searchOutline } from "ionicons/icons";
import EmptyState from "@/components/common/EmptyState.vue";
import RepoCard from "@/components/common/RepoCard.vue";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import UserCard from "@/components/common/UserCard.vue";
import { hasTwisterApi } from "@/core/config/project.js";
import type { RepoSummary } from "@/domain/models/repo.js";
import { useProjectSearch } from "@/services/project-api/queries.js";

const router = useRouter();

const draftQuery = ref("");
const submittedQuery = ref("");
const hasAttemptedSearch = ref(false);
const resultType = ref<"all" | "repo" | "profile">("all");

const hasAnyQuery = computed(() => draftQuery.value.trim().length > 0 || submittedQuery.value.length > 0);
const canSearch = computed(() => hasTwisterApi && draftQuery.value.trim().length > 0);

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
  return `${total} indexed result${total === 1 ? "" : "s"}`;
});

function runSearch() {
  if (!canSearch.value) return;
  submittedQuery.value = draftQuery.value.trim();
  hasAttemptedSearch.value = true;
}

function clearSearch() {
  draftQuery.value = "";
  submittedQuery.value = "";
  hasAttemptedSearch.value = false;
}

function navigateToRepo(repo: RepoSummary) {
  router.push(`/tabs/explore/repo/${repo.ownerHandle}/${repo.name}`);
}

function navigateToUser(handle: string) {
  router.push(`/tabs/explore/user/${handle}`);
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
  max-width: 34rem;
}

.search-card {
  margin: 0 16px;
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

.search-input {
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

.search-segment {
  margin-bottom: 12px;
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

.results-section {
  padding: 18px 0 24px;
}

.results-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin: 0 16px 12px;
}

.results-label {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--t-accent);
}

.results-title {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
  color: var(--t-text-primary);
}

.results-meta {
  margin: 0;
  font-size: 12px;
  color: var(--t-text-muted);
}

.section-label {
  margin: 0 16px 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--t-text-muted);
}
</style>
