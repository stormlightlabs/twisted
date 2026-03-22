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

      <!-- Trending Repos -->
      <div class="section">
        <h2 class="section-title">Trending</h2>
        <template v-if="loading">
          <SkeletonLoader v-for="n in 3" :key="n" variant="card" />
        </template>
        <template v-else>
          <RepoCard v-for="repo in trendingRepos" :key="repo.atUri" :repo="repo" @click="navigateToRepo(repo)" />
        </template>
      </div>

      <!-- Recent Activity -->
      <div class="section">
        <h2 class="section-title">Recent Activity</h2>
        <ion-list lines="inset">
          <template v-if="loading">
            <SkeletonLoader v-for="n in 5" :key="n" variant="list-item" />
          </template>
          <template v-else>
            <ActivityCard v-for="item in activity" :key="item.id" :item="item" />
          </template>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList } from "@ionic/vue";
import RepoCard from "@/components/common/RepoCard.vue";
import ActivityCard from "@/components/common/ActivityCard.vue";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import { getTrendingRepos } from "@/mocks/repos";
import { getMockActivity } from "@/mocks/activity";
import type { RepoSummary } from "@/domain/models/repo";

const router = useRouter();
const loading = ref(true);
const trendingRepos = ref(getTrendingRepos());
const activity = ref(getMockActivity().slice(0, 8));

onMounted(() => {
  setTimeout(() => {
    loading.value = false;
  }, 400);
});

function navigateToRepo(repo: RepoSummary) {
  router.push(`/tabs/home/repo/${repo.ownerHandle}/${repo.name}`);
}
</script>

<style scoped>
.section {
  margin-top: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t-text-muted);
  margin: 16px 16px 6px;
}

ion-list {
  background: transparent;
  padding: 0;
}
</style>
