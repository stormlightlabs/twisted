<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/home" />
        </ion-buttons>
        <ion-title class="repo-title">
          <span class="owner">{{ owner }}/</span>{{ repo?.name ?? repoName }}
        </ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="segment" class="detail-segment">
          <ion-segment-button value="overview">Overview</ion-segment-button>
          <ion-segment-button value="files">Files</ion-segment-button>
          <ion-segment-button value="issues">Issues</ion-segment-button>
          <ion-segment-button value="prs">PRs</ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- Loading skeleton -->
      <template v-if="isLoading">
        <SkeletonLoader variant="profile" />
        <SkeletonLoader v-for="n in 3" :key="n" variant="card" />
      </template>

      <!-- Error -->
      <EmptyState v-else-if="isError" :icon="alertCircleOutline" title="Could not load repo" :message="errorMessage" />

      <!-- Not found -->
      <EmptyState
        v-else-if="!repo"
        :icon="alertCircleOutline"
        title="Repo not found"
        message="This repository doesn't exist or hasn't been loaded yet." />

      <!-- Content -->
      <template v-else>
        <RepoOverview
          v-if="segment === 'overview'"
          :repo="repo"
          :commits="commits"
          :markdown-context="markdownContext" />
        <RepoFiles
          v-else-if="segment === 'files'"
          :knot-host="knotHost"
          :knot-repo="knotRepo"
          :branch="defaultBranch" />
        <RepoIssues
          v-else-if="segment === 'issues'"
          :issues="issues"
          :is-loading="issuesQuery.isPending.value"
          @select="openIssue" />
        <RepoPRs
          v-else-if="segment === 'prs'"
          :prs="prs"
          :is-loading="prsQuery.isPending.value"
          @select="openPullRequest" />
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonSegment,
  IonSegmentButton,
} from "@ionic/vue";
import { alertCircleOutline } from "ionicons/icons";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import RepoOverview from "./RepoOverview.vue";
import RepoFiles from "./RepoFiles.vue";
import RepoIssues from "./RepoIssues.vue";
import RepoPRs from "./RepoPRs.vue";
import {
  useIdentity,
  useRepoRecord,
  useDefaultBranch,
  useRepoBlob,
  useRepoLanguages,
  useRepoLog,
  useRepoIssues,
  useRepoPRs,
} from "@/services/tangled/queries.js";
import { useRepoStarCount } from "@/services/constellation/queries.js";
import type { RepoDetail } from "@/domain/models/repo.js";
import type { RepoAssetContext } from "@/services/tangled/repo-assets.js";

const route = useRoute();
const router = useRouter();
const owner = computed(() => String(route.params.owner ?? ""));
const repoName = computed(() => String(route.params.repo ?? ""));

type Segment = "overview" | "files" | "issues" | "prs";

function segmentFromQuery(value: unknown): Segment {
  return value === "files" || value === "issues" || value === "prs" ? value : "overview";
}

const segment = ref<Segment>("overview");

watch(
  () => route.query.tab,
  (value) => {
    segment.value = segmentFromQuery(value);
  },
  { immediate: true },
);

watch(segment, (value) => {
  const nextQuery = { ...route.query };
  if (value === "overview") {
    delete nextQuery.tab;
  } else {
    nextQuery.tab = value;
  }
  router.replace({ path: route.path, query: nextQuery });
});

const identity = useIdentity(owner, { enabled: computed(() => !!owner.value) });
const did = computed(() => identity.data.value?.did ?? "");
const pds = computed(() => identity.data.value?.pds ?? "");
const hasIdentity = computed(() => !!identity.data.value);

const recordQuery = useRepoRecord(pds, did, repoName, owner, { enabled: hasIdentity });
const knotHost = computed(() => recordQuery.data.value?.knot ?? "");
const knotRepo = computed(() => (did.value && repoName.value ? `${did.value}/${repoName.value}` : ""));
const hasRecord = computed(() => !!recordQuery.data.value?.knot && !!did.value);

const branchQuery = useDefaultBranch(knotHost, knotRepo, { enabled: hasRecord });
const defaultBranch = computed(() => branchQuery.data.value?.name ?? "");
const hasBranch = computed(() => !!branchQuery.data.value?.name);
const markdownContext = computed<RepoAssetContext | undefined>(() => {
  if (!knotHost.value || !knotRepo.value || !defaultBranch.value) return undefined;

  return {
    owner: owner.value,
    repo: repoName.value,
    branch: defaultBranch.value,
    knotHost: knotHost.value,
    knotRepo: knotRepo.value,
    sourcePath: "README.md",
  };
});

const languagesQuery = useRepoLanguages(knotHost, knotRepo, undefined, { enabled: hasBranch });
const readmeQuery = useRepoBlob(knotHost, knotRepo, defaultBranch, "README.md", { readme: true, enabled: hasBranch });
const logQuery = useRepoLog(knotHost, knotRepo, defaultBranch, { limit: 20, enabled: hasBranch });

const repo = computed((): RepoDetail | undefined => {
  const rec = recordQuery.data.value;
  if (!rec) return undefined;
  return {
    ...rec,
    stars: starCountQuery.data.value ?? rec.stars,
    defaultBranch: defaultBranch.value || undefined,
    languages: languagesQuery.data.value,
    readme: readmeQuery.data.value?.isBinary ? undefined : readmeQuery.data.value?.content,
  };
});

const repoAtUri = computed(() => recordQuery.data.value?.atUri ?? "");
const hasAtUri = computed(() => !!repoAtUri.value);

const starCountQuery = useRepoStarCount(repoAtUri, { enabled: hasAtUri });

const issuesQuery = useRepoIssues(pds, did, owner, repoAtUri, { enabled: hasAtUri });
const prsQuery = useRepoPRs(pds, did, owner, repoAtUri, { enabled: hasAtUri });

const commits = computed(() => logQuery.data.value ?? []);
const issues = computed(() => issuesQuery.data.value ?? []);
const prs = computed(() => prsQuery.data.value ?? []);

const tabPrefix = computed(() => {
  if (route.path.startsWith("/tabs/explore")) return "/tabs/explore";
  if (route.path.startsWith("/tabs/activity")) return "/tabs/activity";
  return "/tabs/home";
});

const isLoading = computed(() => identity.isPending.value || recordQuery.isPending.value);
const isError = computed(() => identity.isError.value || recordQuery.isError.value);
const errorMessage = computed(() => {
  const err = identity.error.value ?? recordQuery.error.value;
  return err instanceof Error ? err.message : "An unexpected error occurred.";
});

function openIssue(issue: { rkey: string }) {
  router.push(`${tabPrefix.value}/repo/${owner.value}/${repoName.value}/issues/${issue.rkey}?tab=issues`);
}

function openPullRequest(pr: { rkey: string }) {
  router.push(`${tabPrefix.value}/repo/${owner.value}/${repoName.value}/pulls/${pr.rkey}?tab=prs`);
}
</script>

<style scoped>
.repo-title {
  font-family: var(--t-mono);
  font-size: 14px;
}

.owner {
  color: var(--t-text-muted);
  font-weight: 400;
}

.detail-segment {
  padding: 0 12px 6px;
}
</style>
