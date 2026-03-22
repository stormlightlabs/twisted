import { createRouter, createWebHistory } from "@ionic/vue-router";
import type { RouteRecordRaw } from "vue-router";

import TabsPage from "@/views/TabsPage.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/tabs/home" },
  {
    path: "/tabs/",
    component: TabsPage,
    children: [
      { path: "", redirect: "/tabs/home" },
      { path: "home", component: () => import("@/features/home/HomePage.vue") },
      { path: "home/repo/:owner/:repo", component: () => import("@/features/repo/RepoDetailPage.vue") },
      {
        path: "home/repo/:owner/:repo/issues/:issueId",
        component: () => import("@/features/repo/IssueDetailPage.vue"),
      },
      {
        path: "home/repo/:owner/:repo/pulls/:pullId",
        component: () => import("@/features/repo/PullRequestDetailPage.vue"),
      },
      { path: "home/user/:handle", component: () => import("@/features/profile/UserProfilePage.vue") },
      { path: "explore", component: () => import("@/features/explore/ExplorePage.vue") },
      { path: "explore/repo/:owner/:repo", component: () => import("@/features/repo/RepoDetailPage.vue") },
      {
        path: "explore/repo/:owner/:repo/issues/:issueId",
        component: () => import("@/features/repo/IssueDetailPage.vue"),
      },
      {
        path: "explore/repo/:owner/:repo/pulls/:pullId",
        component: () => import("@/features/repo/PullRequestDetailPage.vue"),
      },
      { path: "explore/user/:handle", component: () => import("@/features/profile/UserProfilePage.vue") },
      { path: "activity", component: () => import("@/features/activity/ActivityPage.vue") },
      { path: "activity/repo/:owner/:repo", component: () => import("@/features/repo/RepoDetailPage.vue") },
      {
        path: "activity/repo/:owner/:repo/issues/:issueId",
        component: () => import("@/features/repo/IssueDetailPage.vue"),
      },
      {
        path: "activity/repo/:owner/:repo/pulls/:pullId",
        component: () => import("@/features/repo/PullRequestDetailPage.vue"),
      },
      { path: "activity/user/:handle", component: () => import("@/features/profile/UserProfilePage.vue") },
      { path: "profile", component: () => import("@/features/profile/ProfilePage.vue") },
    ],
  },
];

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes });

export default router;
