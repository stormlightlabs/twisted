import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

import TabsPage from '@/views/TabsPage.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/tabs/home',
  },
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      {
        path: '',
        redirect: '/tabs/home',
      },
      {
        path: 'home',
        children: [
          {
            path: '',
            component: () => import('@/features/home/HomePage.vue'),
          },
          {
            path: 'repo/:owner/:repo',
            component: () => import('@/features/repo/RepoDetailPage.vue'),
          },
        ],
      },
      {
        path: 'explore',
        children: [
          {
            path: '',
            component: () => import('@/features/explore/ExplorePage.vue'),
          },
          {
            path: 'repo/:owner/:repo',
            component: () => import('@/features/repo/RepoDetailPage.vue'),
          },
        ],
      },
      {
        path: 'activity',
        children: [
          {
            path: '',
            component: () => import('@/features/activity/ActivityPage.vue'),
          },
          {
            path: 'repo/:owner/:repo',
            component: () => import('@/features/repo/RepoDetailPage.vue'),
          },
        ],
      },
      {
        path: 'profile',
        children: [
          {
            path: '',
            component: () => import('@/features/profile/ProfilePage.vue'),
          },
        ],
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
