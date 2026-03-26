<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Bookmarks</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Bookmarks</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-segment v-model="activeKind" class="kind-segment">
        <ion-segment-button value="repo">Repos</ion-segment-button>
        <ion-segment-button value="string">Strings</ion-segment-button>
        <ion-segment-button value="file">Files</ion-segment-button>
      </ion-segment>

      <EmptyState
        v-if="filteredItems.length === 0"
        :icon="bookmarkOutline"
        title="Nothing saved yet"
        message="Save repos, strings, files, or READMEs to keep them here for offline viewing." />

      <ion-list v-else lines="inset" class="bookmark-list">
        <ion-item v-for="item in filteredItems" :key="item.id" button @click="openItem(item)">
          <ion-label>
            <div class="item-title">{{ item.title }}</div>
            <div class="item-meta">{{ itemMeta(item) }}</div>
            <p class="item-copy">{{ itemCopy(item) }}</p>
          </ion-label>
          <ion-button slot="end" fill="clear" color="danger" @click.stop="removeItem(item.id)"> Remove </ion-button>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
  import { computed, ref } from "vue";
  import { useRouter } from "vue-router";
  import {
    IonButton,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
  } from "@ionic/vue";
  import { bookmarkOutline } from "ionicons/icons";
  import EmptyState from "@/components/common/EmptyState.vue";
  import type { BookmarkItem, BookmarkKind } from "@/domain/models/bookmark.ts";
  import { removeBookmark, useBookmarks } from "@/core/bookmarks/service.ts";

  const router = useRouter();
  const activeKind = ref<BookmarkKind>("repo");
  const { bookmarks } = useBookmarks();

  const filteredItems = computed(() => bookmarks.value.filter((item) => item.kind === activeKind.value));

  function itemMeta(item: BookmarkItem): string {
    if (item.kind === "repo") return `${item.ownerHandle}/${item.repoName}`;
    if (item.kind === "string") return `${item.ownerHandle} · ${relativeTime(item.savedAt)}`;
    return `${item.ownerHandle}/${item.repoName} · ${item.path}`;
  }

  function itemCopy(item: BookmarkItem): string {
    if (item.kind === "repo") return item.repo.description || "Saved repo metadata available offline.";
    if (item.kind === "string") return item.description || preview(item.contents);
    return `${item.sourceKind === "readme" ? "README" : "Saved file"} · ${relativeTime(item.savedAt)}`;
  }

  function openItem(item: BookmarkItem) {
    if (item.kind === "repo") {
      router.push(`/tabs/home/repo/${item.ownerHandle}/${item.repoName}`);
      return;
    }
    router.push(`/tabs/bookmarks/${encodeURIComponent(item.id)}`);
  }

  async function removeItem(id: string) {
    await removeBookmark(id);
  }

  function preview(text: string): string {
    return text.length > 96 ? `${text.slice(0, 96)}...` : text;
  }

  function relativeTime(iso: string): string {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
</script>

<style scoped>
  .kind-segment {
    padding: 12px 12px 8px;
  }

  .bookmark-list {
    background: transparent;
  }

  .item-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--t-text-primary);
  }

  .item-meta {
    margin-top: 4px;
    font-size: 12px;
    color: var(--t-text-muted);
  }

  .item-copy {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--t-text-secondary);
  }
</style>
