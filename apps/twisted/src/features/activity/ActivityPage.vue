<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Activity</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" size="small" @click="clearFeed" :disabled="items.length === 0">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Activity</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- Connection status -->
      <div class="status-bar" :class="statusClass">
        <ion-icon :icon="statusIcon" class="status-icon" />
        <span class="status-text">{{ statusText }}</span>
      </div>

      <!-- Filter segment -->
      <ion-segment v-model="activeFilter" class="filter-segment">
        <ion-segment-button value="all">All</ion-segment-button>
        <ion-segment-button value="repo_starred">Stars</ion-segment-button>
        <ion-segment-button value="user_followed">Follows</ion-segment-button>
        <ion-segment-button value="issue_opened">Issues</ion-segment-button>
        <ion-segment-button value="pr_opened">PRs</ion-segment-button>
      </ion-segment>

      <!-- Pull to refresh -->
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content pulling-text="Pull to refresh feed" refreshing-spinner="crescent" />
      </ion-refresher>

      <!-- Loading state while waiting for first event -->
      <template v-if="status === 'connecting' && filteredItems.length === 0">
        <SkeletonLoader v-for="n in 6" :key="n" variant="list-item" />
      </template>

      <!-- Empty: disconnected with no items -->
      <EmptyState
        v-else-if="status === 'disconnected' && filteredItems.length === 0"
        :icon="pulseOutline"
        title="Disconnected"
        message="Could not connect to the Jetstream feed. Pull to refresh to try again."
        action-label="Reconnect"
        @action="reconnect" />

      <!-- Empty: connected but filter has no matches -->
      <EmptyState
        v-else-if="status === 'connected' && filteredItems.length === 0"
        :icon="pulseOutline"
        title="Waiting for events…"
        message="Connected to the network. Events matching this filter will appear here." />

      <!-- Feed -->
      <div v-else class="feed">
        <ActivityCard
          v-for="item in filteredItems"
          :key="item.id"
          :item="displayItem(item)"
          @click="handleItemClick(item)"
          @actor-click="handleActorClick(item)" />
      </div>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
  import { computed, ref, onUnmounted, shallowRef } from "vue";
  import { useRouter } from "vue-router";
  import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonRefresher,
    IonRefresherContent,
    onIonViewWillEnter,
    onIonViewWillLeave,
  } from "@ionic/vue";
  import { pulseOutline, trashOutline, wifiOutline, cloudOfflineOutline, syncOutline } from "ionicons/icons";
  import ActivityCard from "@/components/common/ActivityCard.vue";
  import EmptyState from "@/components/common/EmptyState.vue";
  import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
  import { JetstreamClient } from "@/services/jetstream/client.js";
  import { resolveHandleFromDid } from "@/services/tangled/endpoints.js";
  import type { ActivityItem } from "@/domain/models/activity.js";

  type ConnectionStatus = "connecting" | "connected" | "disconnected";
  type FilterKind = "all" | ActivityItem["kind"];

  const MAX_ITEMS = 200;

  const router = useRouter();

  const items = shallowRef<ActivityItem[]>([]);
  const activeFilter = ref<FilterKind>("all");
  const status = ref<ConnectionStatus>("connecting");
  const handleCache = ref<Map<string, string>>(new Map());

  const filteredItems = computed(() => {
    if (activeFilter.value === "all") return items.value;
    return items.value.filter((item) => item.kind === activeFilter.value);
  });

  const statusClass = computed(() => ({
    "status-connecting": status.value === "connecting",
    "status-connected": status.value === "connected",
    "status-disconnected": status.value === "disconnected",
  }));

  const statusText = computed((): string => {
    switch (status.value) {
      case "connected":
        return `Live · ${items.value.length} event${items.value.length === 1 ? "" : "s"}`;
      case "disconnected":
        return "Disconnected · reconnecting…";
      default:
        return "Connecting to Jetstream…";
    }
  });

  const statusIcon = computed(() => {
    switch (status.value) {
      case "connected":
        return wifiOutline;
      case "disconnected":
        return cloudOfflineOutline;
      default:
        return syncOutline;
    }
  });

  /** Returns a copy of the item with resolved handle if available. */
  function displayItem(item: ActivityItem): ActivityItem {
    const resolved = handleCache.value.get(item.actorDid);
    if (!resolved || resolved === item.actorHandle) return item;
    return { ...item, actorHandle: resolved };
  }

  function resolveHandle(did: string): void {
    if (handleCache.value.has(did)) return;
    // Optimistically mark as in-progress by setting to DID to avoid re-entrancy
    handleCache.value.set(did, did);

    resolveHandleFromDid(did)
      .then((handle) => {
        const next = new Map(handleCache.value);
        next.set(did, handle);
        handleCache.value = next;
      })
      .catch(() => {
        // Leave the placeholder handle from the item
        handleCache.value.delete(did);
      });
  }

  const client = new JetstreamClient({
    onEvent(item) {
      const next = [item, ...items.value];
      if (next.length > MAX_ITEMS) next.length = MAX_ITEMS;
      items.value = next;
      resolveHandle(item.actorDid);
    },
    onConnected() {
      status.value = "connected";
    },
    onDisconnected() {
      if (status.value !== "connecting") {
        status.value = "disconnected";
      }
    },
    onError() {
      status.value = "disconnected";
    },
  });

  onIonViewWillEnter(() => {
    status.value = "connecting";
    client.connect();
  });

  onIonViewWillLeave(() => {
    client.disconnect();
    status.value = "connecting"; // Reset so next enter shows "connecting"
  });

  onUnmounted(() => {
    client.disconnect();
  });

  function clearFeed() {
    items.value = [];
  }

  function reconnect() {
    status.value = "connecting";
    client.resetCursor();
    client.disconnect();
    client.connect();
  }

  async function handleRefresh(event: CustomEvent) {
    clearFeed();
    client.resetCursor();
    client.disconnect();
    status.value = "connecting";
    client.connect();
    // Complete the refresher after a short delay
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    (event.target as HTMLIonRefresherElement).complete();
  }

  function handleActorClick(item: ActivityItem) {
    const handle = handleCache.value.get(item.actorDid);
    if (handle && handle !== item.actorDid) {
      router.push(`/tabs/activity/user/${handle}`);
    } else {
      // Resolve then navigate
      resolveHandleFromDid(item.actorDid)
        .then((h) => {
          const next = new Map(handleCache.value);
          next.set(item.actorDid, h);
          handleCache.value = next;
          router.push(`/tabs/activity/user/${h}`);
        })
        .catch(() => {
          // Cannot navigate without a handle
        });
    }
  }

  function handleItemClick(item: ActivityItem) {
    // Navigate to repo if we can determine owner handle and repo name
    if (item.targetName && item.targetOwnerDid) {
      const ownerHandle = handleCache.value.get(item.targetOwnerDid);
      if (ownerHandle && ownerHandle !== item.targetOwnerDid) {
        router.push(`/tabs/activity/repo/${ownerHandle}/${item.targetName}`);
      }
      // If handle not yet resolved, resolve it in background for future clicks
      else {
        resolveHandle(item.targetOwnerDid);
      }
    }
  }
</script>

<style scoped>
  /* Status bar */
  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 500;
    transition: background 0.2s;
  }

  .status-connecting {
    color: var(--t-text-muted);
    background: transparent;
  }

  .status-connected {
    color: #34d399;
  }

  .status-disconnected {
    color: #fb923c;
  }

  .status-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  /* Filter */
  .filter-segment {
    padding: 0 16px 8px;
  }

  /* Feed */
  .feed {
    padding-bottom: 24px;
  }

  /* New items pill */
  .new-items-pill {
    position: sticky;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    width: fit-content;
    background: var(--t-accent);
    color: #0d1117;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 999px;
    cursor: pointer;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    margin: 0 auto 8px;
    display: block;
    text-align: center;
  }
</style>
