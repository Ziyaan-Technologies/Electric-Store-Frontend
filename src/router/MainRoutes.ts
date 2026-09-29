const MainRoutes = {
    path: '/main',
    meta: {
        requiresAuth: true
    },
    redirect: '/main',
    component: () => import('@/layouts/full/FullLayout.vue'),
    children: [
        {
            path: '/',
            redirect: '/dashboard'
        },
        {
            name: 'UpdateProfile',
            path: '/profile/update-details',
            component: () => import('@/views/profile/Profile.vue')
        },
        {
            name: 'UpdatePassword',
            path: '/auth/update-password',
            component: () => import('@/views/profile/BoxedUpdatePassword.vue')
        },
        {
            name: 'Shops',
            path: '/shops',
            component: () => import('@/views/modules/shop/Shops.vue'),
            meta: {
                requiresAuth: true,
                action: ['shops_view'],
                subject: 'Shops'
            }
        },
        {
            name: 'Dashboard',
            path: '/dashboard',
            component: () => import('@/views/dashboard/Dashboard.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['home_view'],
                subject: 'Home'
            }
        },
        {
            name: 'Pos',
            path: '/pos',
            component: () => import('@/views/modules/pos/Pos.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['pos_sell'],
                subject: 'POS'
            }
        },
        {
            name: 'Expenses',
            path: '/expenses',
            component: () => import('@/views/modules/expense/Expenses.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['expenses_view'],
                subject: 'Expenses'
            }
        },
        {
            name: 'Debtors',
            path: '/debtors',
            component: () => import('@/views/modules/debtor/Debtors.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['debtors_view'],
                subject: 'Debtors'
            }
        },
        {
            name: 'DebtorDetail',
            path: '/debtors/:id',
            component: () => import('@/views/modules/debtor/DebtorDetail.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['debtors_view'],
                subject: 'Debtors'
            }
        },
        {
            name: 'Creditors',
            path: '/creditors',
            component: () => import('@/views/modules/creditor/Creditors.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['creditors_view'],
                subject: 'Creditors'
            }
        },
        {
            name: 'CreditorDetail',
            path: '/creditors/:id',
            component: () => import('@/views/modules/creditor/CreditorDetail.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['creditors_view'],
                subject: 'Creditors'
            }
        },
        {
            name: 'Bills',
            path: '/bills',
            component: () => import('@/views/modules/sales/Bills.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['sales_view'],
                subject: 'Sales'
            }
        },
        {
            name: 'BillDetail',
            path: '/bills/:id',
            component: () => import('@/views/modules/sales/BillDetail.vue'),
            meta: {
                title: 'Bill Detail',
                requiresAuth: true,
                requiresStore: true,
                action: ['sales_view'],
                subject: 'Sales'
            }
        },
        {
            name: 'Quotations',
            path: '/quotations',
            component: () => import('@/views/modules/quotation/Quotations.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['quotations_view'],
                subject: 'Quotation'
            }
        },
        {
            name: 'QuotationDetail',
            path: '/quotations/:id',
            component: () => import('@/views/modules/quotation/QuotationDetail.vue'),
            meta: {
                title: 'Quotation Detail',
                requiresAuth: true,
                requiresStore: true,
                action: ['quotations_view'],
                subject: 'Quotation'
            }
        },
        {
            name: 'PendingCosts',
            path: '/pending-costs',
            component: () => import('@/views/modules/pending-cost/PendingCosts.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['pending_costs_view'],
                subject: 'Pending Cost'
            }
        },
        {
            name: 'Counters',
            path: '/counters',
            component: () => import('@/views/modules/counter/Counters.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['counters_view'],
                subject: 'Counter'
            }
        },
        {
            name: 'CashFlow',
            path: '/counters/:id/cash-flow',
            component: () => import('@/views/modules/counter/CashFlow.vue'),
            meta: {
                title: 'Cash Flow',
                requiresAuth: true,
                requiresStore: true,
                action: ['counters_cash_flow'],
                subject: 'Counter'
            }
        },
        {
            name: 'Products',
            path: '/products',
            component: () => import('@/views/modules/product/Product.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['products_view'],
                subject: 'Product'
            }
        },
        {
            name: 'ProductCreate',
            path: '/products/create',
            component: () => import('@/views/modules/product/ProductForm.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['products_create'],
                subject: 'Product'
            }
        },
        {
            name: 'ProductEdit',
            path: '/products/:id/edit',
            component: () => import('@/views/modules/product/ProductForm.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['products_edit'],
                subject: 'Product'
            }
        },
        {
            name: 'Categories',
            path: '/categories',
            component: () => import('@/views/modules/category/Category.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['categories_view'],
                subject: 'Category'
            }
        },
        {
            name: 'Brands',
            path: '/brands',
            component: () => import('@/views/modules/brand/Brand.vue'),
            meta: {
                requiresAuth: true,
                requiresStore: true,
                action: ['brands_view'],
                subject: 'Brand'
            }
        },
        {
            name: 'Users',
            path: '/users',
            component: () => import('@/views/modules/user/Users.vue'),
            meta: {
                requiresAuth: true,
                action: ['users_view'],
                subject: 'Users'
            }
        },
        {
            name: 'Roles',
            path: '/roles',
            component: () => import('@/views/modules/role/Roles.vue'),
            meta: {
                requiresAuth: true,
                action: ['roles_view'],
                subject: 'Roles'
            }
        },
    ]
};

export default MainRoutes;
