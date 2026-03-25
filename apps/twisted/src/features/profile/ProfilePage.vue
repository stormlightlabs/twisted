<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title class="profile-title mono">{{ profile?.handle || "Profile" }}</ion-title>
        <ion-buttons v-if="authStore.isAuthenticated" slot="end">
          <ion-button @click="goToSettings">
            <ion-icon slot="icon-only" :icon="settingsOutline" />
          </ion-button>
          <ion-button @click="handleLogout">
            <ion-icon slot="icon-only" :icon="logOutOutline" color="danger" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <template v-if="authStore.state === 'restoring'">
        <SkeletonLoader variant="profile" />
        <SkeletonLoader v-for="n in 3" :key="n" variant="card" />
      </template>

      <template v-else-if="authStore.isAuthenticated">
        <div class="profile-header">
          <ion-avatar class="avatar">
            <img v-if="profile?.avatar" :src="profile.avatar" :alt="`${profile.handle} avatar`" class="avatar-image" />
            <div v-else class="avatar-fallback" :style="{ background: avatarColor(profile?.handle || '') }">
              {{ initials(profile?.handle || '') }}
            </div>
          </ion-avatar>

          <div class="profile-info">
            <div class="profile-handle mono">{{ profile?.handle || authStore.did }}</div>
            <div v-if="profile?.displayName" class="profile-name">{{ profile.displayName }}</div>
          </div>
        </div>

        <div v-if="profile?.bio" class="profile-bio">{{ profile.bio }}</div>

        <div v-if="(profile as any)?.location || (profile as any)?.pronouns" class="profile-meta">
          <span v-if="(profile as any).location" class="meta-item">
            <ion-icon :icon="locationOutline" class="meta-icon" />
            {{ (profile as any).location }}
          </span>
          <span v-if="(profile as any).pronouns" class="meta-item">
            <ion-icon :icon="personOutline" class="meta-icon" />
            {{ (profile as any).pronouns }}
          </span>
        </div>

        <div v-if="(profile as any)?.links?.length" class="profile-links">
          <a
            v-for="link in (profile as any).links"
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
            message="You haven't created any repositories yet." />
        </template>

        <UserStrings v-else-if="section === 'strings'" :strings="strings" :is-loading="stringsQuery.isPending.value" />

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
            message="You aren't following any profiles yet." />
        </template>

        <ion-list v-if="authStore.accounts.length > 1" class="account-list" lines="none">
          <ion-list-header>
            <ion-label>Switch Account</ion-label>
          </ion-list-header>
          <ion-item
            v-for="accountDid in authStore.accounts"
            :key="accountDid"
            button
            :disabled="accountDid === authStore.did"
            @click="switchToAccount(accountDid)">
            <ion-label>{{ accountDid }}</ion-label>
            <ion-icon v-if="accountDid === authStore.did" :icon="checkmarkOutline" slot="end" color="primary" />
          </ion-item>
        </ion-list>
      </template>

      <template v-else>
        <div class="signin-container">
          <div class="brand-icon">
            <ion-icon :icon="codeSlashOutline" />
          </div>

          <h2 class="signin-title">Sign in to Tangled</h2>
          <p class="signin-subtitle">
            Use your AT Protocol handle to sign in and access your starred repos, follow developers, and get a
            personalized activity feed.
          </p>

          <ion-button class="signin-btn" expand="block" @click="handleSignIn">
            <ion-icon slot="start" :icon="logInOutline" />
            Sign in with AT Protocol
          </ion-button>

          <p class="signin-hint">
            Don't have a handle?
            <a href="https://bsky.app" target="_blank" rel="noopener">Get one at bsky.app</a>
          </p>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
  import { ref, computed } from "vue";
  import { useRouter } from "vue-router";
  import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonButtons,
    IonAvatar,
    IonList,
    IonItem,
    IonLabel,
    IonListHeader,
    IonSegment,
    IonSegmentButton,
    alertController,
    toastController,
  } from "@ionic/vue";
  import {
    codeSlashOutline,
    logInOutline,
    logOutOutline,
    settingsOutline,
    personOutline,
    locationOutline,
    linkOutline,
    checkmarkOutline,
    peopleOutline,
  } from "ionicons/icons";
  import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
  import EmptyState from "@/components/common/EmptyState.vue";
  import RepoCard from "@/components/common/RepoCard.vue";
  import UserCard from "@/components/common/UserCard.vue";
  import RepoIssues from "@/features/repo/RepoIssues.vue";
  import RepoPRs from "@/features/repo/RepoPRs.vue";
  import UserStrings from "@/features/profile/UserStrings.vue";
  import { useAuthStore } from "@/core/auth/store.js";
  import {
    useActorProfile,
    useUserRepos,
    useUserStrings,
    useUserIssues,
    useUserPullRequests,
    useUserFollowing,
  } from "@/services/tangled/queries.js";
  import { useIndexedProfileSummary } from "@/services/project-api/queries.js";
  import type { IssueSummary } from "@/domain/models/issue.js";
  import type { PullRequestSummary } from "@/domain/models/pull-request.js";
  import type { RepoSummary } from "@/domain/models/repo.js";

  const router = useRouter();
  const authStore = useAuthStore();

  const identifier = computed(() => authStore.did ?? "");
  const isReady = computed(() => !!authStore.did);
  const section = ref<"repos" | "strings" | "issues" | "prs" | "following">("repos");

  const profileQuery = useActorProfile(identifier, undefined, { enabled: isReady });
  const reposQuery = useUserRepos(identifier, { enabled: isReady });
  const stringsQuery = useUserStrings(identifier, { enabled: isReady });
  const issuesQuery = useUserIssues(identifier, { enabled: isReady });
  const pullRequestsQuery = useUserPullRequests(identifier, { enabled: isReady });
  const followingQuery = useUserFollowing(identifier, { enabled: isReady });
  const indexedProfileSummaryQuery = useIndexedProfileSummary(identifier, { enabled: isReady });

  const profile = computed(() => profileQuery.data.value);
  const repos = computed(() => reposQuery.data.value ?? []);
  const strings = computed(() => stringsQuery.data.value ?? []);
  const issues = computed(() => issuesQuery.data.value ?? []);
  const pullRequests = computed(() => pullRequestsQuery.data.value ?? []);
  const following = computed(() => followingQuery.data.value ?? []);
  const indexedProfileSummary = computed(() => indexedProfileSummaryQuery.data.value);

  const pinnedUris = computed(() => (profile.value as { pinnedRepos?: string[] } | undefined)?.pinnedRepos ?? []);
  const pinnedRepos = computed(() => repos.value.filter((r) => pinnedUris.value.includes(r.atUri)));
  const otherRepos = computed(() => repos.value.filter((r) => !pinnedUris.value.includes(r.atUri)));

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

  function handleSignIn() {
    router.push("/login");
  }

  async function handleLogout() {
    const alert = await alertController.create({
      header: "Sign Out",
      message: "Are you sure you want to sign out?",
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Sign Out",
          role: "destructive",
          handler: async () => {
            await authStore.logout();
            const toast = await toastController.create({
              message: "Signed out successfully",
              duration: 2000,
              color: "success",
            });
            await toast.present();
          },
        },
      ],
    });
    await alert.present();
  }

  function goToSettings() {
    router.push("/tabs/settings");
  }

  async function switchToAccount(did: `did:${string}:${string}`) {
    if (did === authStore.did) return;

    const success = await authStore.switchAccount(did);
    if (!success) {
      const toast = await toastController.create({
        message: "Failed to switch account",
        duration: 2000,
        color: "danger",
      });
      await toast.present();
    }
  }

  function navigateToRepo(repo: RepoSummary) {
    router.push(`/tabs/home/repo/${repo.ownerHandle}/${repo.name}`);
  }

  function navigateToUser(handle: string) {
    router.push(`/tabs/home/user/${handle}`);
  }

  function navigateToIssue(issue: IssueSummary) {
    const repoName = repos.value.find((r) => r.atUri === issue.repoAtUri)?.name;
    if (!repoName) return;
    router.push(`/tabs/home/repo/${profile.value?.handle ?? identifier.value}/${repoName}/issues/${issue.rkey}`);
  }

  function navigateToPullRequest(pr: PullRequestSummary) {
    const repoName = repos.value.find((r) => r.atUri === pr.targetRepoAtUri)?.name;
    if (!repoName) return;
    router.push(`/tabs/home/repo/${profile.value?.handle ?? identifier.value}/${repoName}/pulls/${pr.rkey}`);
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

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--t-text-muted);
    margin: 16px 16px 8px;
  }

  .account-list {
    padding: 0 16px;
    margin-top: 24px;
  }

  .signin-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 70vh;
    padding: 32px 28px;
    text-align: center;
    gap: 14px;
  }

  .brand-icon {
    width: 72px;
    height: 72px;
    border-radius: var(--t-radius-lg);
    background: var(--t-accent-dim);
    border: 1px solid var(--t-border-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    color: var(--t-accent);
    margin-bottom: 4px;
  }

  .signin-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--t-text-primary);
    margin: 0;
    line-height: 1.2;
  }

  .signin-subtitle {
    font-size: 14px;
    color: var(--t-text-secondary);
    margin: 0;
    line-height: 1.55;
    max-width: 280px;
  }

  .signin-btn {
    --background: var(--t-accent);
    --background-activated: var(--t-accent);
    --color: #0d1117;
    --border-radius: var(--t-radius-md);
    width: 100%;
    max-width: 320px;
    font-weight: 600;
    font-size: 15px;
    margin-top: 6px;
  }

  .signin-hint {
    font-size: 13px;
    color: var(--t-text-muted);
    margin: 4px 0 0;
  }

  .signin-hint a {
    color: var(--t-accent);
    text-decoration: none;
  }
</style>
