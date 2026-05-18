import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../pages/HomePage.vue'),
    },
    {
      path: '/movie/:id',
      component: () => import('../pages/MoviePage.vue'),
    },
    {
      path: '/tv/:id',
      component: () => import('../pages/TVPage.vue'),
    },
    {
      path: '/library',
      component: () => import('../pages/LibraryPage.vue'),
    },
    {
      path: '/settings',
      component: () => import('../pages/SettingsPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
