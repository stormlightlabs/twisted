<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/home" />
        </ion-buttons>
        <ion-title class="profile-title mono">{{ handle }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <template v-if="isLoading">
        <SkeletonLoader variant="profile" />
        <SkeletonLoader v-for="n in 3" :key="n" variant="card" />
      </template>

      <EmptyState
        v-else-if="isError"
        :icon="alertCircleOutline"
        title="Could not load profile"
        :message="errorMessage" />

      <template v-else>
        <div class="profile-header">
          <ion-avatar class="avatar">
            <img v-if="profile?.avatar" :src="profile.avatar" :alt="`${handle} avatar`" class="avatar-image" />
            <div v-else class="avatar-fallback" :style="{ background: avatarColor(handle) }">
              {{ initials(handle) }}
            </div>
          </ion-avatar>

          <div class="profile-info">
            <div class="profile-handle mono">{{ handle }}</div>
            <div v-if="profile?.displayName" class="profile-name">{{ profile.displayName }}</div>
          </div>
        </div>

        <div v-if="profile?.bio" class="profile-bio">{{ profile.bio }}</div>

        <div v-if="profile?.location || profile?.pronouns" class="profile-meta">
          <span v-if="profile.location" class="meta-item">
            <ion-icon :icon="locationOutline" class="meta-icon" />
            {{ profile.location }}
          </span>
          <span v-if="profile.pronouns" class="meta-item">
            <ion-icon :icon="personOutline" class="meta-icon" />
            {{ profile.pronouns }}
          </span>
        </div>

        <div v-if="profile?.links?.length" class="profile-links">
          <a
            v-for="link in profile.links"
            :key="link"
            :href="link"
            class="profile-link"
            target="_blank"
            rel="noopener noreferrer">
            <ion-icon :icon="linkOutline" class="link-icon" />
            {{ displayLink(link) }}
          </a>
        </div>

        <div class="stats-row">
          <div v-for="stat in stats" :key="stat.label" class="stat-pill">
            <span class="stat-value">{{ stat.value }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>

        <ion-segment v-model="section" class="profile-segment" scrollable>
          <ion-segment-button value="repos">Repos</ion-segment-button>
          <ion-segment-button value="strings">Strings</ion-segment-button>
          <ion-segment-button value="issues">Issues</ion-segment-button>
          <ion-segment-button value="prs">PRs</ion-segment-button>
          <ion-segment-button value="following">Following</ion-segment-button>
        </ion-segment>

        <template v-if="section === 'repos'">
          <template v-if="pinnedRepos.length">
            <h3 class="section-label">Pinned</h3>
            <RepoCard
              v-for="repo in pinnedRepos"
              :key="repo.atUri"
              :repo="repo"
              @click="navigateToRepo(repo)"
              @owner-click="navigateToUser(repo.ownerHandle)" />
          </template>

          <h3 class="section-label">Repositories</h3>
          <template v-if="reposQuery.isPending.value">
            <SkeletonLoader v-for="n in 3" :key="n" variant="card" />
          </template>
          <template v-else-if="otherRepos.length">
            <RepoCard
              v-for="repo in otherRepos"
              :key="repo.atUri"
              :repo="repo"
              @click="navigateToRepo(repo)"
              @owner-click="navigateToUser(repo.ownerHandle)" />
          </template>
          <EmptyState
            v-else-if="!pinnedRepos.length"
            :icon="codeSlashOutline"
            title="No repositories"
            message="This user hasn't created any repositories yet." />
        </template>

        <UserStrings
          v-else-if="section === 'strings'"
          :strings="strings"
          :owner-handle="handle"
          :is-loading="stringsQuery.isPending.value" />

        <RepoIssues
          v-else-if="section === 'issues'"
          :issues="issues"
          :is-loading="issuesQuery.isPending.value"
          @select="navigateToIssue" />

        <RepoPRs
          v-else-if="section === 'prs'"
          :prs="pullRequests"
          :is-loading="pullRequestsQuery.isPending.value"
          @select="navigateToPullRequest" />

        <template v-else>
          <template v-if="followingQuery.isPending.value">
            <SkeletonLoader v-for="n in 3" :key="n" variant="list-item" />
          </template>
          <template v-else-if="following.length">
            <UserCard
              v-for="user in following"
              :key="user.followAtUri"
              :user="user"
              @click="navigateToUser(user.handle)" />
          </template>
          <EmptyState
            v-else
            :icon="peopleOutline"
            title="Not following anyone"
            message="This user isn't following any profiles yet." />
        </template>
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
    IonAvatar,
    IonIcon,
    IonSegment,
    IonSegmentButton,
  } from "@ionic/vue";
  import {
    alertCircleOutline,
    locationOutline,
    personOutline,
    linkOutline,
    codeSlashOutline,
    peopleOutline,
  } from "ionicons/icons";
  import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
  import EmptyState from "@/components/common/EmptyState.vue";
  import RepoCard from "@/components/common/RepoCard.vue";
  import UserCard from "@/components/common/UserCard.vue";
  import RepoIssues from "@/features/repo/RepoIssues.vue";
  import RepoPRs from "@/features/repo/RepoPRs.vue";
  import UserStrings from "@/features/profile/UserStrings.vue";
  import {
    useIdentity,
    useActorProfile,
    useUserRepos,
    useUserStrings,
    useUserIssues,
    useUserPullRequests,
    useUserFollowing,
  } from "@/services/tangled/queries.ts";
  import { useIndexedProfileSummary } from "@/services/project-api/queries.ts";
  import type { IssueSummary } from "@/domain/models/issue.ts";
  import type { PullRequestSummary } from "@/domain/models/pull-request.ts";
  import type { RepoSummary } from "@/domain/models/repo.ts";

  const route = useRoute();
  const router = useRouter();
  const handle = computed(() => String(route.params.handle ?? ""));
  const section = ref<"repos" | "strings" | "issues" | "prs" | "following">("repos");

  const identity = useIdentity(handle);
  const did = computed(() => identity.data.value?.did ?? "");
  const hasIdentity = computed(() => !!identity.data.value);
  const tabPrefix = computed(() => {
    if (route.path.startsWith("/tabs/explore")) return "/tabs/explore";
    if (route.path.startsWith("/tabs/activity")) return "/tabs/activity";
    return "/tabs/home";
  });

  const profileQuery = useActorProfile(handle, undefined, { enabled: hasIdentity });
  const reposQuery = useUserRepos(handle, { enabled: hasIdentity });
  const stringsQuery = useUserStrings(handle, { enabled: hasIdentity });
  const issuesQuery = useUserIssues(handle, { enabled: hasIdentity });
  const pullRequestsQuery = useUserPullRequests(handle, { enabled: hasIdentity });
  const followingQuery = useUserFollowing(handle, { enabled: hasIdentity });
  const indexedProfileSummaryQuery = useIndexedProfileSummary(did, { enabled: hasIdentity });

  const profile = computed(() => profileQuery.data.value);
  const repos = computed(() => reposQuery.data.value ?? []);
  const strings = computed(() => stringsQuery.data.value ?? []);
  const issues = computed(() => issuesQuery.data.value ?? []);
  const pullRequests = computed(() => pullRequestsQuery.data.value ?? []);
  const following = computed(() => followingQuery.data.value ?? []);
  const indexedProfileSummary = computed(() => indexedProfileSummaryQuery.data.value);

  const pinnedUris = computed(() => (profile.value as { pinnedRepos?: string[] } | undefined)?.pinnedRepos ?? []);
  const pinnedRepos = computed(() => repos.value.filter((r) => pinnedUris.value.includes(r.atUri)));
  const otherRepos = computed(() => repos.value.filter((repo) => !pinnedUris.value.includes(repo.atUri)));
  const stats = computed(() => {
    const values = [
      { label: "repos", value: repos.value.length },
      { label: "strings", value: strings.value.length },
      { label: "issues", value: issues.value.length },
      { label: "prs", value: pullRequests.value.length },
    ];

    if (indexedProfileSummary.value?.followerCount != null) {
      values.splice(1, 0, { label: "followers", value: indexedProfileSummary.value.followerCount });
    }

    values.splice(indexedProfileSummary.value?.followerCount != null ? 2 : 1, 0, {
      label: "following",
      value: indexedProfileSummary.value?.followingCount ?? following.value.length,
    });

    return values;
  });

  const isLoading = computed(() => identity.isPending.value || profileQuery.isPending.value);
  const isError = computed(() => identity.isError.value || profileQuery.isError.value);
  const errorMessage = computed(() => {
    const err = identity.error.value ?? profileQuery.error.value;
    return err instanceof Error ? err.message : "An unexpected error occurred.";
  });

  watch(handle, () => {
    section.value = "repos";
  });

  function navigateToRepo(repo: RepoSummary) {
    router.push(`${tabPrefix.value}/repo/${repo.ownerHandle}/${repo.name}`);
  }

  function navigateToUser(profileHandle: string) {
    router.push(`${tabPrefix.value}/user/${profileHandle}`);
  }

  function navigateToIssue(issue: IssueSummary) {
    const repoName = repos.value.find((repo) => repo.atUri === issue.repoAtUri)?.name;
    if (!repoName) return;
    router.push(`${tabPrefix.value}/repo/${handle.value}/${repoName}/issues/${issue.rkey}`);
  }

  function navigateToPullRequest(pullRequest: PullRequestSummary) {
    const repoName = repos.value.find((repo) => repo.atUri === pullRequest.targetRepoAtUri)?.name;
    if (!repoName) return;
    router.push(`${tabPrefix.value}/repo/${handle.value}/${repoName}/pulls/${pullRequest.rkey}`);
  }

  function displayLink(url: string): string {
    return url.trim().replace(/^[a-z]+:\/\//i, "");
  }

  const PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#fb923c", "#60a5fa"];

  function avatarColor(h: string): string {
    let hash = 0;
    for (const ch of h) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }

  function initials(h: string): string {
    return h.split(".")[0].slice(0, 2).toUpperCase();
  }
</script>

<style scoped>
  .profile-title {
    font-family: var(--t-mono);
    font-size: 14px;
  }

  .mono {
    font-family: var(--t-mono);
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 16px 12px;
  }

  .avatar {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    border-radius: var(--t-radius-md);
    overflow: hidden;
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--t-mono);
    font-size: 18px;
    font-weight: 700;
    color: #0d1117;
  }

  .profile-info {
    flex: 1;
    min-width: 0;
  }

  .profile-handle {
    font-family: var(--t-mono);
    font-size: 15px;
    font-weight: 600;
    color: var(--t-accent);
    line-height: 1.3;
  }

  .profile-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--t-text-primary);
    margin-top: 2px;
  }

  .profile-bio {
    font-size: 14px;
    color: var(--t-text-secondary);
    line-height: 1.55;
    padding: 0 16px 12px;
  }

  .profile-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 0 16px 12px;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    color: var(--t-text-muted);
  }

  .meta-icon {
    font-size: 14px;
  }

  .profile-links {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 16px 14px;
  }

  .profile-link {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--t-accent);
    text-decoration: none;
  }

  .link-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--t-text-muted);
    margin: 16px 16px 8px;
  }

  .stats-row {
    display: flex;
    gap: 8px;
    padding: 0 16px 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .stats-row::-webkit-scrollbar {
    display: none;
  }

  .stat-pill {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 999px;
    border: 1px solid var(--t-border);
    background: var(--t-surface-raised);
    flex-shrink: 0;
  }

  .stat-value {
    font-family: var(--t-mono);
    font-size: 12px;
    font-weight: 700;
    color: var(--t-text-primary);
  }

  .stat-label {
    font-size: 12px;
    color: var(--t-text-muted);
    text-transform: lowercase;
  }

  .profile-segment {
    padding: 0 12px 8px;
  }
</style>
