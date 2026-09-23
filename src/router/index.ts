import { createRouter, createWebHistory } from 'vue-router';
import MainRoutes from './MainRoutes';
import AuthRoutes from './AuthRoutes';
import { useAuthStore } from '@/stores/auth';
import { getAbilities } from '@/utils/getAbilities';

const landingPages = [
    { path: '/dashboard', action: 'home_view', subject: 'Home', store: true },
    { path: '/pos', action: 'pos_sell', subject: 'POS', store: true },
    { path: '/products', action: 'products_view', subject: 'Product', store: true },
    { path: '/shops', action: 'shops_view', subject: 'Shops', store: false },
];

async function landingPath() {
  const ability = await getAbilities();
  const auth = useAuthStore();
  return landingPages.find((page) => ability.can(page.action, page.subject) && (!page.store || auth.clientstoreId))?.path || '/profile/update-details';
}

export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/:pathMatch(.*)*',
            component: () => import('@/views/authentication/Error.vue')
        },
        MainRoutes,
        AuthRoutes
    ]
});

router.beforeEach(async (to, from, next) => {
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const publicPages = ['Login', 'Error', 'Unauthorized', 'Maintenance'];
  const authRequired = !publicPages.includes(to.name as string);
  const auth: any = useAuthStore();
  const isAuthenticated = !!auth.jwt;

  if (to.matched.some((record) => record.meta.requiresAuth)) {
    if (authRequired && !isAuthenticated) {
      auth.returnUrl = to.fullPath;
      return next('/auth/login');
    }

    if (to.matched.some((record) => record.meta.requiresStore) && !auth.clientstoreId) {
      return next('/shops');
    }

    const actions: string[] = Array.isArray(to.meta.action)
      ? to.meta.action as string[]
      : typeof to.meta.action === 'string'
        ? [to.meta.action]
        : [];

    const subject = typeof to.meta.subject === 'string' ? to.meta.subject : undefined;

    if (actions.length > 0 && subject) {
      const ability = await getAbilities();
      const hasPermission = actions.some((action: string) => ability.can(action, subject));
      if (!hasPermission) {
        const landing = await landingPath();
        return next(landing === to.path ? '/auth/unauthorized' : landing);
      }
    }

    return next();
  }

  if (isAuthenticated && to.name === 'Login') {
    return next('/');
  }
  return next();
});
