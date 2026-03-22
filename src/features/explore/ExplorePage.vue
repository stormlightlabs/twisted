<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Explore</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar placeholder="Search repos and users…" :disabled="true" class="search-bar" />
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="tab" class="explore-segment">
          <ion-segment-button value="repos">Repos</ion-segment-button>
          <ion-segment-button value="users">Users</ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <template v-if="loading">
        <SkeletonLoader v-for="n in 4" :key="n" :variant="tab === 'repos' ? 'card' : 'list-item'" />
      </template>

      <template v-else-if="tab === 'repos'">
        <RepoCard v-for="repo in repos" :key="repo.atUri" :repo="repo" @click="navigateToRepo(repo)" />
      </template>

      <template v-else>
        <UserCard v-for="user in users" :key="user.did" :user="user" />
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
} from "@ionic/vue";
import RepoCard from "@/components/common/RepoCard.vue";
import UserCard from "@/components/common/UserCard.vue";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import { getMockRepos } from "@/mocks/repos";
import { getMockUsers } from "@/mocks/users";
import type { RepoSummary } from "@/domain/models/repo";

const router = useRouter();
const tab = ref<"repos" | "users">("repos");
const loading = ref(true);
const repos = getMockRepos();
const users = getMockUsers();

onMounted(() => {
  setTimeout(() => {
    loading.value = false;
  }, 400);
});

function navigateToRepo(repo: RepoSummary) {
  router.push(`/tabs/explore/repo/${repo.ownerHandle}/${repo.name}`);
}
</script>

<style scoped>
.search-bar {
  --background: var(--t-surface-raised);
}

.explore-segment {
  padding: 0 12px 6px;
}
</style>
