<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/home" />
        </ion-buttons>
        <ion-title class="repo-title">
          <span class="owner">{{ owner }}/</span>{{ repoName }}
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
      <template v-if="loading">
        <SkeletonLoader variant="profile" />
        <SkeletonLoader v-for="n in 3" :key="n" variant="card" />
      </template>

      <!-- Not found -->
      <EmptyState
        v-else-if="!repo"
        :icon="alertCircleOutline"
        title="Repo not found"
        message="This repository doesn't exist or hasn't been loaded yet."
      />

      <!-- Content -->
      <template v-else>
        <RepoOverview  v-if="segment === 'overview'" :repo="repo" />
        <RepoFiles     v-else-if="segment === 'files'"   :files="files" />
        <RepoIssues    v-else-if="segment === 'issues'"  :issues="issues" />
        <RepoPRs       v-else-if="segment === 'prs'"     :prs="prs" />
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonBackButton, IonSegment, IonSegmentButton,
} from '@ionic/vue';
import { alertCircleOutline } from 'ionicons/icons';
import SkeletonLoader from '@/components/common/SkeletonLoader.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import RepoOverview from './RepoOverview.vue';
import RepoFiles from './RepoFiles.vue';
import RepoIssues from './RepoIssues.vue';
import RepoPRs from './RepoPRs.vue';
import { getMockRepoDetail, getMockRepoFiles } from '@/mocks/repos';
import { getMockIssues } from '@/mocks/issues';
import { getMockPullRequests } from '@/mocks/pull-requests';
import type { RepoDetail, RepoFile } from '@/domain/models/repo';
import type { IssueSummary } from '@/domain/models/issue';
import type { PullRequestSummary } from '@/domain/models/pull-request';

const route = useRoute();
const owner = route.params.owner as string;
const repoName = route.params.repo as string;

const segment = ref<'overview' | 'files' | 'issues' | 'prs'>('overview');
const loading = ref(true);
const repo = ref<RepoDetail | null>(null);
const files = ref<RepoFile[]>([]);
const issues = ref<IssueSummary[]>([]);
const prs = ref<PullRequestSummary[]>([]);

onMounted(() => {
  setTimeout(() => {
    repo.value = getMockRepoDetail(owner, repoName) ?? null;
    files.value = getMockRepoFiles();
    issues.value = getMockIssues();
    prs.value = getMockPullRequests();
    loading.value = false;
  }, 400);
});
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
