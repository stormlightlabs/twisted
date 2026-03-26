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
        <ion-buttons slot="end">
          <ion-button :disabled="!repo" @click="toggleRepoSave">
            <ion-icon slot="icon-only" :icon="repoSaved ? bookmark : bookmarkOutline" />
          </ion-button>
        </ion-buttons>
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
          :markdown-context="markdownContext"
          :readme-path="readmePath"
          :is-readme-saved="readmeSaved"
          @toggle-readme-save="toggleReadmeSave" />
        <RepoFiles v-else-if="segment === 'files'" :owner="owner" :repo="repoName" :branch="defaultBranch" />
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
    IonButton,
    IonButtons,
    IonBackButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    toastController,
  } from "@ionic/vue";
  import { alertCircleOutline, bookmark, bookmarkOutline } from "ionicons/icons";
  import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
  import EmptyState from "@/components/common/EmptyState.vue";
  import RepoOverview from "./RepoOverview.vue";
  import RepoFiles from "./RepoFiles.vue";
  import RepoIssues from "./RepoIssues.vue";
  import RepoPRs from "./RepoPRs.vue";
  import {
    useRepoRecord,
    useDefaultBranch,
    useRepoReadme,
    useRepoLanguages,
    useRepoLog,
    useRepoIssues,
    useRepoPRs,
  } from "@/services/tangled/queries.ts";
  import { useRepoStarCount } from "@/services/constellation/queries.ts";
  import type { RepoDetail } from "@/domain/models/repo.ts";
  import type { RepoAssetContext } from "@/services/tangled/repo-assets.ts";
  import {
    buildFileBookmarkId,
    buildRepoBookmarkId,
    createSavedFileInput,
    hasBookmark,
    removeBookmark,
    removeRepoBookmark,
    saveFileBookmark,
    saveRepoBookmark,
  } from "@/core/bookmarks/service.ts";

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

  const recordQuery = useRepoRecord(owner, repoName, { enabled: computed(() => !!owner.value && !!repoName.value) });
  const hasRecord = computed(() => !!recordQuery.data.value);

  const branchQuery = useDefaultBranch(owner, repoName, { enabled: hasRecord });
  const defaultBranch = computed(() => branchQuery.data.value?.name ?? "");
  const hasBranch = computed(() => !!branchQuery.data.value?.name);
  const readmeQuery = useRepoReadme(owner, repoName, defaultBranch, { enabled: hasBranch });
  const markdownContext = computed<RepoAssetContext | undefined>(() => {
    if (!owner.value || !repoName.value || !defaultBranch.value || !readmeQuery.data.value?.path) return undefined;

    return {
      owner: owner.value,
      repo: repoName.value,
      branch: defaultBranch.value,
      sourcePath: readmeQuery.data.value.path,
    };
  });

  const languagesQuery = useRepoLanguages(owner, repoName, undefined, { enabled: hasBranch });
  const logQuery = useRepoLog(owner, repoName, defaultBranch, { limit: 20, enabled: hasBranch });

  const repo = computed((): RepoDetail | undefined => {
    const rec = recordQuery.data.value;
    if (!rec) return undefined;
    return {
      ...rec,
      stars: starCountQuery.data.value ?? rec.stars,
      defaultBranch: defaultBranch.value || undefined,
      languages: languagesQuery.data.value,
      readme: readmeQuery.data.value?.content,
    };
  });

  const repoAtUri = computed(() => recordQuery.data.value?.atUri ?? "");
  const hasAtUri = computed(() => !!repoAtUri.value);
  const readmePath = computed(() => readmeQuery.data.value?.path ?? "");

  const starCountQuery = useRepoStarCount(repoAtUri, { enabled: hasAtUri });

  const issuesQuery = useRepoIssues(owner, repoName, { enabled: hasAtUri });
  const prsQuery = useRepoPRs(owner, repoName, { enabled: hasAtUri });

  const commits = computed(() => logQuery.data.value ?? []);
  const issues = computed(() => issuesQuery.data.value ?? []);
  const prs = computed(() => prsQuery.data.value ?? []);

  const tabPrefix = computed(() => {
    if (route.path.startsWith("/tabs/explore")) return "/tabs/explore";
    if (route.path.startsWith("/tabs/activity")) return "/tabs/activity";
    return "/tabs/home";
  });

  const isLoading = computed(() => recordQuery.isPending.value);
  const isError = computed(() => recordQuery.isError.value);
  const errorMessage = computed(() => {
    const err = recordQuery.error.value;
    return err instanceof Error ? err.message : "An unexpected error occurred.";
  });
  const repoBookmarkId = computed(() => (repo.value ? buildRepoBookmarkId(repo.value.atUri) : ""));
  const repoSaved = computed(() => !!repoBookmarkId.value && hasBookmark(repoBookmarkId.value));
  const readmeBookmarkId = computed(() => {
    if (!owner.value || !repoName.value || !defaultBranch.value || !readmePath.value) return "";
    return buildFileBookmarkId(owner.value, repoName.value, defaultBranch.value, readmePath.value);
  });
  const readmeSaved = computed(() => !!readmeBookmarkId.value && hasBookmark(readmeBookmarkId.value));

  function openIssue(issue: { rkey: string }) {
    router.push(`${tabPrefix.value}/repo/${owner.value}/${repoName.value}/issues/${issue.rkey}?tab=issues`);
  }

  function openPullRequest(pr: { rkey: string }) {
    router.push(`${tabPrefix.value}/repo/${owner.value}/${repoName.value}/pulls/${pr.rkey}?tab=prs`);
  }

  async function toggleRepoSave() {
    if (!repo.value || !repoBookmarkId.value) return;
    if (repoSaved.value) {
      await removeRepoBookmark(repoBookmarkId.value);
      await presentToast("Removed from bookmarks.");
      return;
    }
    await saveRepoBookmark(repo.value);
    await presentToast("Repo saved.");
  }

  async function toggleReadmeSave() {
    if (!repo.value || !defaultBranch.value || !readmePath.value || !repo.value.readme) return;
    if (readmeSaved.value) {
      await removeBookmark(readmeBookmarkId.value);
      await presentToast("README removed.");
      return;
    }
    await saveFileBookmark(
      createSavedFileInput(
        owner.value,
        repoName.value,
        defaultBranch.value,
        readmePath.value,
        { path: readmePath.value, content: repo.value.readme, encoding: "utf-8", isBinary: false },
        "readme",
      ),
    );
    await presentToast("README saved.");
  }

  async function presentToast(message: string) {
    const toast = await toastController.create({ message, duration: 1800, color: "success" });
    await toast.present();
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
