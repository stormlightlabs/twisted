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

      <section class="hero">
        <p class="eyebrow">Known-handle browsing</p>
        <h1 class="hero-title">Jump straight to a Tangled profile or browse that handle's repos.</h1>
        <p class="hero-copy">
          Enter an AT Protocol handle, then open the profile directly or resolve the user's Personal Data Server and
          browse their public repositories here.
        </p>
      </section>

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

        <p class="hint-copy">Repo browsing is temporary here until search ships in a separate project.</p>
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
            message="This handle resolved successfully, but there are no public Tangled repositories to browse yet." />
        </template>
      </section>

      <section v-else class="results-section">
        <EmptyState
          :icon="compassOutline"
          title="Browse by handle"
          message="Use Home as the temporary public entry point while search and activity are still in progress." />
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonInput, IonButton } from "@ionic/vue";
import { alertCircleOutline, compassOutline, folderOpenOutline } from "ionicons/icons";
import RepoCard from "@/components/common/RepoCard.vue";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import { useIdentity, useUserRepos, useActorProfile } from "@/services/tangled/queries.js";
import type { RepoSummary } from "@/domain/models/repo.js";

const router = useRouter();

const draftHandle = ref("");
const activeHandle = ref("");
const hasAttemptedBrowse = ref(false);

const normalizedHandle = computed(() => draftHandle.value.trim().toLowerCase());
const hasHandle = computed(() => normalizedHandle.value.length > 0);

const identity = useIdentity(activeHandle, { enabled: computed(() => !!activeHandle.value) });
const did = computed(() => identity.data.value?.did ?? "");
const pds = computed(() => identity.data.value?.pds ?? "");
const hasResolvedIdentity = computed(() => !!identity.data.value);

const profileQuery = useActorProfile(pds, did, activeHandle, undefined, { enabled: hasResolvedIdentity });
const reposQuery = useUserRepos(pds, did, activeHandle, { enabled: hasResolvedIdentity });

const repos = computed(() => reposQuery.data.value ?? []);
const displayName = computed(() => profileQuery.data.value?.displayName ?? "Public Tangled account");
const repoCountLabel = computed(() => `${repos.value.length} repo${repos.value.length === 1 ? "" : "s"}`);
const isBrowsing = computed(() => hasAttemptedBrowse.value && activeHandle.value === normalizedHandle.value && isLoading.value);
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

function openProfile() {
  if (!hasHandle.value) return;
  router.push(`/tabs/home/user/${normalizedHandle.value}`);
}

function browseRepos() {
  if (!hasHandle.value) return;
  hasAttemptedBrowse.value = true;
  activeHandle.value = normalizedHandle.value;
}

function openResolvedProfile() {
  if (!activeHandle.value) return;
  router.push(`/tabs/home/user/${activeHandle.value}`);
}

function navigateToRepo(repo: RepoSummary) {
  router.push(`/tabs/home/repo/${repo.ownerHandle}/${repo.name}`);
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

.lookup-card {
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

@media (max-width: 480px) {
  .hero-title {
    font-size: 24px;
  }

  .action-row {
    grid-template-columns: 1fr;
  }

  .resolved-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
