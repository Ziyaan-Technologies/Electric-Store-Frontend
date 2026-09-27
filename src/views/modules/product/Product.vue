<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import DashboardStatCard from '@/components/shared/DashboardStatCard.vue';
import ListToolbar from '@/components/shared/ListToolbar.vue';
import TableBottom from '@/components/shared/TableBottom.vue';
import DeleteDialog from '@/components/shared/DeleteDialog.vue';
import AddStockDialog from './AddStockDialog.vue';
import ItemHistoryDialog from './ItemHistoryDialog.vue';
import ActiveIcon from '@/components/shared/ActiveIcon.vue';
import { useListPage } from '@/composables/useListPage';
import { useAlerts } from '@/composables/useAlerts';
import { useLookups } from '@/composables/useLookups';
import { can } from '@/utils/permissions';
import { formatMoney, formatNumber } from '@/utils/api';
import type { Header } from '@/models/type-interfaces';

const router = useRouter();
const alerts = useAlerts();
const lookups = useLookups();
const stockOpen = ref(false);
const historyOpen = ref(false);
const chosen = ref<any>(null);

function openStock(item: any) {
  chosen.value = item;
  stockOpen.value = true;
}

function openHistory(item: any) {
  chosen.value = item;
  historyOpen.value = true;
}

function onStockSaved(product: any) {
  alerts.success(`Stock added to ${product.name}`);
  list.refresh();
}
const categoryId = ref<number | null>(null);
const brandId = ref<number | null>(null);
const status = ref<string | null>(null);

const list = useListPage('products', {
  storeScoped: true,
  filters: () => ({
    category_id: categoryId.value || undefined,
    brand_id: brandId.value || undefined,
    status: status.value || undefined,
  }),
  onError: (error) => alerts.fail(error),
});

const headers = ref<Header[]>([
  { title: 'ID', align: 'start', key: 'id' },
  { title: 'NO.', align: 'start', key: 'number' },
  { title: 'PRODUCT', align: 'start', key: 'name' },
  { title: 'CATEGORY', align: 'start', key: 'category' },
  { title: 'SIZES / RATINGS', align: 'start', key: 'variants' },
  { title: 'PRICE', align: 'start', key: 'price' },
  { title: 'IN STOCK', align: 'start', key: 'stock_total' },
  { title: 'ACTIVE', align: 'start', key: 'is_active' },
  { title: 'ACTIONS', key: 'actions', sortable: false },
]);

const deleteOpen = ref(false);
const selected = ref<any>(null);

function priceRange(variants: any[]) {
  if (!variants?.length) return '-';
  const prices = variants.map((variant) => variant.sale_price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatNumber(max, 2)}`;
}

function lowCount(variants: any[]) {
  return variants.filter((variant) => variant.stock <= variant.reorder_level).length;
}

function openDelete(item: any) {
  selected.value = item;
  deleteOpen.value = true;
}

async function remove() {
  try {
    const response = await axios.delete(`products/${selected.value.id}`);
    alerts.success(response.data?.deactivated ? response.data.message : 'Product has been deleted!');
    list.refresh();
  } catch (error) {
    alerts.fail(error);
  }
}

onMounted(async () => {
  try {
    await Promise.all([lookups.loadCategories(), lookups.loadBrands()]);
  } catch (error) {
    alerts.fail(error);
  }
});
</script>

<template>
  <v-row>
    <v-col cols="12" sm="6" lg="3">
      <DashboardStatCard title="Products" :value="list.kpis.value.totalProducts ?? 0" icon="mdi-package-variant-closed" comparison-label="In this shop" />
    </v-col>
    <v-col cols="12" sm="6" lg="3">
      <DashboardStatCard title="Active" :value="list.kpis.value.activeProducts ?? 0" icon="mdi-check-circle-outline" comparison-label="Shown on the sell screen" />
    </v-col>
    <v-col cols="12" sm="6" lg="3">
      <DashboardStatCard title="Inactive" :value="list.kpis.value.inactiveProducts ?? 0" icon="mdi-pause-circle-outline" comparison-label="Hidden from selling" />
    </v-col>
    <v-col cols="12" sm="6" lg="3">
      <DashboardStatCard title="Running Low" :value="list.kpis.value.lowStock ?? 0" icon="mdi-alert-outline" comparison-label="Sizes at or below reorder level" :show-info-icon="(list.kpis.value.lowStock ?? 0) > 0" />
    </v-col>

    <v-col cols="12">
      <UiParentCard>
        <ListToolbar :total="list.totalItems.value" label="Total Products" search-placeholder="Search number, name, size, barcode..."
          add-label="Add New Product" :can-add="can('products_create', 'Product')" @search="list.onSearch" @add="router.push('/products/create')">
          <template #filters>
            <div>
              <v-autocomplete v-model="categoryId" :items="lookups.categories.value" item-title="name" item-value="id" placeholder="All categories" clearable hide-details @update:model-value="list.reload()" />
            </div>
            <div>
              <v-autocomplete v-model="brandId" :items="lookups.brands.value" item-title="name" item-value="id" placeholder="All brands" clearable hide-details @update:model-value="list.reload()" />
            </div>
            <div>
              <v-select v-model="status" :items="['Active', 'Inactive']" placeholder="All statuses" clearable hide-details @update:model-value="list.reload()" />
            </div>
          </template>
        </ListToolbar>

        <v-data-table :loading="list.loading.value" :items-per-page="list.itemsPerPage.value" :headers="headers" :items="list.items.value"
          item-value="id" hide-default-footer class="border rounded-md">
          <template v-slot:loading><v-skeleton-loader type="table-row@10"></v-skeleton-loader></template>
          <template v-slot:top>
            <v-alert v-model="alerts.showAlert.value" :text="alerts.alertText.value" type="success" density="compact" class="mb-4 single-line-alert" closable>
              <template v-slot:prepend><v-icon class="text-24">mdi-checkbox-marked-circle-outline</v-icon></template>
            </v-alert>
            <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
          </template>
          <template v-slot:item.number="{ item }">
            <span v-if="item.number" class="font-weight-bold">{{ item.number }}</span>
            <span v-else class="text-lightText">-</span>
          </template>
          <template v-slot:item.name="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar size="40" rounded="md" class="border bg-white">
                <v-img v-if="item.image_url" :src="item.image_url" contain />
                <v-icon v-else size="18" color="primary">mdi-package-variant</v-icon>
              </v-avatar>
              <div class="ml-3">
                <div class="text-subtitle-2">{{ item.name }}</div>
                <div class="text-caption text-lightText">{{ item.brand?.name || 'No brand' }}</div>
              </div>
            </div>
          </template>
          <template v-slot:item.category="{ item }">{{ item.category?.name }}</template>
          <template v-slot:item.variants="{ item }">
            <div v-for="variant in item.variants.slice(0, 3)" :key="variant.id" class="text-caption">{{ variant.name }}</div>
            <div v-if="item.variants.length > 3" class="text-caption text-lightText">+{{ item.variants.length - 3 }} more</div>
          </template>
          <template v-slot:item.price="{ item }">{{ priceRange(item.variants) }}</template>
          <template v-slot:item.stock_total="{ item }">
            <div>{{ formatNumber(item.stock_total, 3) }}</div>
            <div v-if="lowCount(item.variants)" class="text-caption text-error">{{ lowCount(item.variants) }} size{{ lowCount(item.variants) === 1 ? '' : 's' }} low</div>
          </template>
          <template v-slot:item.is_active="{ item }"><ActiveIcon :active="item.is_active" /></template>
          <template v-slot:item.actions="{ item }">
            <div class="d-flex align-center">
              <v-btn v-if="$can('products_stock', 'Product')" icon="mdi-package-down" color="#E7F8EE" size="small" class="me-2 text-success" title="Add stock" @click="openStock(item)"></v-btn>
              <v-btn icon="mdi-history" color="#EFF0F1" size="small" class="me-2" title="Item history" @click="openHistory(item)"></v-btn>
              <v-btn v-if="$can('products_edit', 'Product')" icon="mdi-pencil-outline" color="#EFF0F1" size="small" class="me-2" @click="router.push(`/products/${item.id}/edit`)"></v-btn>
              <v-btn v-if="$can('products_delete', 'Product')" icon="mdi-delete-outline" color="#FFEFEF" size="small" class="text-error" @click="openDelete(item)"></v-btn>
            </div>
          </template>
          <template v-slot:no-data>
            <p class="px-2 py-2">No products found</p>
            <v-btn color="primary" @click="list.fetchData()">Refresh</v-btn>
          </template>
          <template v-slot:bottom>
            <TableBottom v-model:page="list.currentPage.value" :page-count="list.pageCount.value" v-model:per-page="list.itemsPerPageInput.value" :total="list.totalItems.value" />
          </template>
        </v-data-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <DeleteDialog v-model="deleteOpen" message="Are you sure you want to delete this product?"
    hint="Products on old bills or quotations are made inactive instead of deleted." @confirm="remove" />

  <AddStockDialog v-model="stockOpen" :product="chosen" @saved="onStockSaved" />
  <ItemHistoryDialog v-model="historyOpen" :product="chosen" />
</template>
