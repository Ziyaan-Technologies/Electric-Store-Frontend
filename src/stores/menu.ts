import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

export interface MenuItem {
  title: string;
  icon: string;
  to: string;
  action?: string;
  subject?: string;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const useMenuStore = defineStore('menu', () => {
  const authStore = useAuthStore();

  const groups = computed<MenuGroup[]>(() => {
    if (!authStore.client) {
      return [];
    }

    if (!authStore.clientstoreId) {
      return [
        {
          title: 'Business',
          items: [
            { title: 'My Shops', icon: 'mdi-storefront-outline', to: '/shops', action: 'shops_view', subject: 'Shops' },
            { title: 'Users', icon: 'mdi-account-key-outline', to: '/users', action: 'users_view', subject: 'Users' },
            { title: 'Roles', icon: 'mdi-shield-account-outline', to: '/roles', action: 'roles_view', subject: 'Roles' },
          ],
        },
      ];
    }

    return [
      {
        title: 'Sale',
        items: [
          { title: 'Dashboard', icon: 'mdi-view-dashboard-outline', to: '/dashboard', action: 'home_view', subject: 'Home' },
          { title: 'Sell', icon: 'mdi-cash-register', to: '/pos', action: 'pos_sell', subject: 'POS' },
          { title: 'Bills', icon: 'mdi-receipt-text-outline', to: '/bills', action: 'sales_view', subject: 'Sales' },
          { title: 'Quotations', icon: 'mdi-file-document-edit-outline', to: '/quotations', action: 'quotations_view', subject: 'Quotation' },
          { title: 'Pending Costs', icon: 'mdi-clock-alert-outline', to: '/pending-costs', action: 'pending_costs_view', subject: 'Pending Cost' },
          { title: 'Debtors', icon: 'mdi-account-cash-outline', to: '/debtors', action: 'debtors_view', subject: 'Debtors' },
          { title: 'Creditors', icon: 'mdi-account-arrow-left-outline', to: '/creditors', action: 'creditors_view', subject: 'Creditors' },
        ],
      },
      {
        title: 'Counters',
        items: [
          { title: 'Counters', icon: 'mdi-counter', to: '/counters', action: 'counters_view', subject: 'Counter' },
          { title: 'Expenses', icon: 'mdi-cash-minus', to: '/expenses', action: 'expenses_view', subject: 'Expenses' },
        ],
      },
      {
        title: 'Items',
        items: [
          { title: 'Products', icon: 'mdi-package-variant-closed', to: '/products', action: 'products_view', subject: 'Product' },
          { title: 'Categories', icon: 'mdi-shape-outline', to: '/categories', action: 'categories_view', subject: 'Category' },
          { title: 'Brands', icon: 'mdi-tag-multiple-outline', to: '/brands', action: 'brands_view', subject: 'Brand' },
        ],
      },
      {
        title: 'Setup',
        items: [
          { title: 'Users', icon: 'mdi-account-key-outline', to: '/users', action: 'users_view', subject: 'Users' },
          { title: 'Roles', icon: 'mdi-shield-account-outline', to: '/roles', action: 'roles_view', subject: 'Roles' },
          { title: 'My Shops', icon: 'mdi-storefront-outline', to: '/shops', action: 'shops_view', subject: 'Shops' },
        ],
      },
    ];
  });

  return { groups };
});
