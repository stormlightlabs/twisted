<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/bookmarks" />
        </ion-buttons>
        <ion-title>{{ bookmark?.title || "Saved Item" }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <EmptyState
        v-if="!bookmark"
        :icon="bookmarkOutline"
        title="Saved item not found"
        message="This bookmark may have been removed from local storage." />

      <template v-else>
        <div class="detail-meta">
          <div class="meta-title">{{ bookmark.title }}</div>
          <div class="meta-copy">{{ metaLine }}</div>
        </div>
        <StoredContentView :bookmark="bookmark" />
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
  import { computed, onMounted } from "vue";
  import { useRoute } from "vue-router";
  import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/vue";
  import { bookmarkOutline } from "ionicons/icons";
  import StoredContentView from "@/components/bookmarks/StoredContentView.vue";
  import EmptyState from "@/components/common/EmptyState.vue";
  import type { SavedFile, SavedString } from "@/domain/models/bookmark.ts";
  import { ensureBookmarksLoaded, useBookmarks } from "@/core/bookmarks/service.ts";

  const route = useRoute();
  const { bookmarks } = useBookmarks();

  onMounted(() => {
    void ensureBookmarksLoaded();
  });

  const bookmark = computed(() => {
    const id = decodeURIComponent(String(route.params.bookmarkId ?? ""));
    const item = bookmarks.value.find((entry) => entry.id === id);
    return item?.kind === "repo" ? undefined : (item as SavedFile | SavedString | undefined);
  });

  const metaLine = computed(() => {
    if (!bookmark.value) return "";
    if (bookmark.value.kind === "string") return `${bookmark.value.ownerHandle} · ${bookmark.value.filename}`;
    return `${bookmark.value.ownerHandle}/${bookmark.value.repoName} · ${bookmark.value.path}`;
  });
</script>

<style scoped>
  .detail-meta {
    padding: 16px;
    border-bottom: 1px solid var(--t-border);
  }

  .meta-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--t-text-primary);
  }

  .meta-copy {
    margin-top: 6px;
    font-size: 12px;
    color: var(--t-text-muted);
  }
</style>
