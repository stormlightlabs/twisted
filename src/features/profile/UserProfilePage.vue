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
      <!-- Loading -->
      <template v-if="isLoading">
        <SkeletonLoader variant="profile" />
        <SkeletonLoader v-for="n in 3" :key="n" variant="card" />
      </template>

      <!-- Error -->
      <EmptyState
        v-else-if="isError"
        :icon="alertCircleOutline"
        title="Could not load profile"
        :message="errorMessage" />

      <!-- Content -->
      <template v-else>
        <!-- Profile header -->
        <div class="profile-header">
          <ion-avatar class="avatar">
            <img
              v-if="profile"
              :src="`https://avatar.tangled.sh/${identity.data.value?.did}`"
              :alt="handle"
              @error="avatarError = true" />
            <div v-if="!profile || avatarError" class="avatar-fallback" :style="{ background: avatarColor(handle) }">
              {{ initials(handle) }}
            </div>
          </ion-avatar>

          <div class="profile-info">
            <div class="profile-handle mono">{{ handle }}</div>
            <div v-if="profile?.displayName" class="profile-name">{{ profile.displayName }}</div>
          </div>
        </div>

        <div v-if="profile?.bio" class="profile-bio">{{ profile.bio }}</div>

        <!-- Meta: location, pronouns -->
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

        <!-- Links -->
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

        <!-- Pinned repos -->
        <template v-if="pinnedRepos.length">
          <h3 class="section-label">Pinned</h3>
          <RepoCard v-for="repo in pinnedRepos" :key="repo.atUri" :repo="repo" @click="navigateToRepo(repo)" />
        </template>

        <!-- All repos -->
        <h3 class="section-label">Repositories</h3>
        <template v-if="reposQuery.isPending.value">
          <SkeletonLoader v-for="n in 3" :key="n" variant="card" />
        </template>
        <template v-else-if="repos.length">
          <RepoCard v-for="repo in repos" :key="repo.atUri" :repo="repo" @click="navigateToRepo(repo)" />
        </template>
        <EmptyState
          v-else
          :icon="codeSlashOutline"
          title="No repositories"
          message="This user hasn't created any repositories yet." />
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
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
} from "@ionic/vue";
import { alertCircleOutline, locationOutline, personOutline, linkOutline, codeSlashOutline } from "ionicons/icons";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import RepoCard from "@/components/common/RepoCard.vue";
import { useIdentity, useActorProfile, useUserRepos } from "@/services/tangled/queries.js";
import type { RepoSummary } from "@/domain/models/repo.js";

const route = useRoute();
const router = useRouter();
const handle = route.params.handle as string;

const avatarError = ref(false);

const identity = useIdentity(handle);
const did = computed(() => identity.data.value?.did ?? "");
const pds = computed(() => identity.data.value?.pds ?? "");
const hasIdentity = computed(() => !!identity.data.value);

const profileQuery = useActorProfile(pds, did, handle, undefined, { enabled: hasIdentity });
const reposQuery = useUserRepos(pds, did, handle, { enabled: hasIdentity });

const profile = computed(() => profileQuery.data.value);
const repos = computed(() => reposQuery.data.value ?? []);

const pinnedUris = computed(() => (profile.value as { pinnedRepos?: string[] } | undefined)?.pinnedRepos ?? []);
const pinnedRepos = computed(() => repos.value.filter((r) => pinnedUris.value.includes(r.atUri)));

const isLoading = computed(() => identity.isPending.value || profileQuery.isPending.value);
const isError = computed(() => identity.isError.value || profileQuery.isError.value);
const errorMessage = computed(() => {
  const err = identity.error.value ?? profileQuery.error.value;
  return err instanceof Error ? err.message : "An unexpected error occurred.";
});

function navigateToRepo(repo: RepoSummary) {
  const tabPrefix = route.path.startsWith("/tabs/explore")
    ? "/tabs/explore"
    : route.path.startsWith("/tabs/activity")
      ? "/tabs/activity"
      : "/tabs/home";
  router.push(`${tabPrefix}/repo/${repo.ownerHandle}/${repo.name}`);
}

function displayLink(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
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
</style>
