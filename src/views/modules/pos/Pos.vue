<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import PrintDialog from '@/components/shared/PrintDialog.vue';
import CategoryDialog from './CategoryDialog.vue';
import QuickItemDialog from './QuickItemDialog.vue';
import BillDiscountDialog from './BillDiscountDialog.vue';
import PaymentDialog from './PaymentDialog.vue';
import QuotationDialog from './QuotationDialog.vue';
import CashMoveDialog from '@/views/modules/counter/CashMoveDialog.vue';
import CloseCounterDialog from '@/views/modules/counter/CloseCounterDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { usePendingStore } from '@/stores/pending';
import { useAlerts } from '@/composables/useAlerts';
import { can } from '@/utils/permissions';
import { apiError, formatDate, formatDateTime, formatMoney, formatNumber } from '@/utils/api';
import { activeDiscounts, calculateBill, discountLabel, nextDiscountCode, type BillDiscount, type BillLine, type DiscountType } from '@/utils/bill';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const pending = usePendingStore();
const alerts = useAlerts();

const loading = ref(true);
const session = ref<any>(null);
const elsewhere = ref<any>(null);
const counters = ref<any[]>([]);
const openCounterId = ref<number | null>(null);
const openingCash = ref<number | string>('');
const openingCounter = ref(false);

const catalog = ref<{ brands: any[]; categories: any[]; products: any[] }>({ brands: [], categories: [], products: [] });
const brandId = ref<number | null>(null);
const search = ref('');
const brandScroller = ref<HTMLElement | null>(null);

const lines = ref<BillLine[]>([]);
const discounts = ref<BillDiscount[]>([]);
const customerName = ref('');
const customerPhone = ref('');
const debtor = ref<any>(null);
const debtors = ref<any[]>([]);
const debtorSearch = ref('');
const loadingDebtors = ref(false);
const quotation = ref<any>(null);

const categoryDialog = ref(false);
const activeCategory = ref<any>(null);
const quickDialog = ref(false);
const discountDialog = ref(false);
const paymentDialog = ref(false);
const quotationDialog = ref(false);
const printDialog = ref(false);
const printDoc = ref<any>(null);
const printKind = ref<'bill' | 'quotation'>('bill');
const cashDialog = ref(false);
const cashType = ref<'In' | 'Out'>('In');
const closeDialog = ref(false);
const saving = ref(false);
const saveError = ref('');
const lineDiscount = ref<{ type: DiscountType; value: number | string }>({ type: 'percent', value: '' });
let lineSeq = 0;

const bill = computed(() => calculateBill(lines.value, discounts.value));

const inCart = computed(() => lines.value.reduce((map: Record<number, number>, line) => {
  if (line.variant_id) map[line.variant_id] = (map[line.variant_id] || 0) + Number(line.quantity || 0);
  return map;
}, {}));

const categoriesShown = computed(() => (brandId.value === null
  ? catalog.value.categories
  : catalog.value.categories.filter((category) => category.brand_ids.includes(brandId.value))));

const searchResults = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return [];
  return catalog.value.products
    .filter((product) => brandId.value === null || product.brand_id === brandId.value)
    .flatMap((product) => product.variants
      .filter((variant: any) => `${product.name} ${product.brand?.name || ''} ${variant.name} ${variant.sku} ${variant.barcode}`.toLowerCase().includes(term))
      .map((variant: any) => ({ product, variant })))
    .slice(0, 60);
});

const uncovered = computed(() => lines.value
  .map((line, index) => ({ line, index }))
  .filter(({ line }) => !line.bill_discount_code)
  .map(({ line, index }) => ({ name: `${line.product_name} ${line.variant_name || ''}`.trim(), total: bill.value.lines[index]?.total || 0 })));

const pieces = computed(() => lines.value.reduce((sum, line) => sum + Number(line.quantity || 0), 0));

function productCount(category: any) {
  return catalog.value.products.filter((product) => product.category_id === category.id && (brandId.value === null || product.brand_id === brandId.value)).length;
}

function stockLeft(line: BillLine) {
  if (!line.variant_id) return Infinity;
  const variant = catalog.value.products.flatMap((product) => product.variants).find((row: any) => row.id === line.variant_id);
  return variant ? variant.stock : Number(line.stock || 0);
}

async function findDebtors(term: string) {
  if (!can('pos_debtor_sale', 'POS')) return;
  loadingDebtors.value = true;
  try {
    debtors.value = (await axios.get('debtors/list', { params: { search: term || undefined } })).data;
  } catch (error) {
    debtors.value = [];
  } finally {
    loadingDebtors.value = false;
  }
}

function pickDebtor(value: any) {
  debtor.value = value || null;
  if (value && !customerPhone.value) {
    customerPhone.value = value.phone || '';
  }
}

async function loadCatalog() {
  catalog.value = (await axios.get('pos/catalog', { params: { clientstore_id: authStore.clientstoreId } })).data;
}

async function loadSession() {
  const data = (await axios.get('counter-sessions/current', { params: { clientstore_id: authStore.clientstoreId } })).data;
  elsewhere.value = data?.elsewhere ? data : null;
  session.value = data && !data.elsewhere ? data : null;
  if (!session.value && !elsewhere.value) {
    counters.value = (await axios.get('counters/list', { params: { clientstore_id: authStore.clientstoreId } })).data;
    const free = counters.value.find((counter) => counter.status !== 'Open' && canOpen(counter));
    openCounterId.value = free?.id || null;
    openingCash.value = free ? free.drawer_cash : '';
  }
}

async function loadQuotation(id: string) {
  try {
    const data = (await axios.get(`quotations/${id}`)).data;
    if (data.status !== 'Open') {
      alerts.fail(null, `Quotation ${data.quotation_number} is ${data.status.toLowerCase()} and cannot be billed.`);
      return;
    }
    quotation.value = data;
    customerName.value = data.customer_name || '';
    customerPhone.value = data.customer_phone || '';
    discounts.value = data.bill_discounts.map((discount: any) => ({ code: discount.code, type: discount.type, value: discount.value }));
    lines.value = data.items.map((item: any) => ({
      key: `q-${item.id}`,
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name: item.product_name,
      variant_name: item.variant_name,
      image_url: item.image_url,
      quantity: item.quantity,
      original_price: item.original_price,
      unit_price: item.unit_price,
      cost_price: item.cost_price,
      discount_type: item.discount_type,
      discount_value: item.discount_value,
      bill_discount_code: item.bill_discount_code,
      is_outside: item.is_outside,
    }));
  } catch (error) {
    alerts.fail(error);
  }
}

async function load() {
  loading.value = true;
  alerts.clear();
  try {
    await Promise.all([loadCatalog(), loadSession()]);
    if (route.query.quotation) await loadQuotation(String(route.query.quotation));
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
}

function canOpen(counter: any) {
  const mine = authStore.client?.electric_counter_id;
  return !mine || mine === counter.id;
}

function chooseCounter(counter: any) {
  if (counter.status === 'Open' || !canOpen(counter)) return;
  openCounterId.value = counter.id;
  openingCash.value = counter.drawer_cash;
}

async function openCounter() {
  if (!openCounterId.value) return;
  openingCounter.value = true;
  try {
    session.value = (await axios.post('counter-sessions/open', { counter_id: openCounterId.value, opening_cash: Number(openingCash.value) || 0 })).data;
    alerts.success(`${session.value.counter.name} is open`);
    pending.refresh();
  } catch (error) {
    alerts.fail(error);
  } finally {
    openingCounter.value = false;
  }
}

function scrollBrands(direction: number) {
  brandScroller.value?.scrollBy({ left: direction * 260, behavior: 'smooth' });
}

function openCategory(category: any) {
  activeCategory.value = category;
  categoryDialog.value = true;
}

function addVariant(product: any, variant: any, quantity: number) {
  const left = variant.stock - (inCart.value[variant.id] || 0);
  const qty = Math.min(quantity, left);
  if (qty <= 0) {
    alerts.fail(null, `No more stock of ${product.name} ${variant.name}`);
    return;
  }
  if (qty < quantity) alerts.fail(null, `Only ${left} of ${product.name} ${variant.name} left, added ${qty}`);
  const existing = lines.value.find((line) => line.variant_id === variant.id && !line.bill_discount_code && line.unit_price === variant.sale_price && !Number(line.discount_value));
  if (existing) {
    existing.quantity = Number(existing.quantity) + qty;
    return;
  }
  lines.value.push({
    key: `l-${++lineSeq}`,
    product_id: product.id,
    variant_id: variant.id,
    product_name: product.name,
    variant_name: variant.name,
    image_url: product.image_url,
    quantity: qty,
    original_price: variant.sale_price,
    unit_price: variant.sale_price,
    cost_price: variant.cost_price,
    stock: variant.stock,
    discount_type: 'percent',
    discount_value: 0,
    bill_discount_code: null,
    is_outside: false,
  });
}

function addRows(rows: { product: any; variant: any; quantity: number }[]) {
  rows.forEach((row) => addVariant(row.product, row.variant, row.quantity));
  alerts.success(`${rows.length} size${rows.length === 1 ? '' : 's'} added to the bill`);
}

function addFromSearch(row: { product: any; variant: any }) {
  addVariant(row.product, row.variant, 1);
}

function onSearchEnter() {
  if (searchResults.value.length === 1) {
    addFromSearch(searchResults.value[0]);
    search.value = '';
  }
}

function addOutside(item: { product_name: string; quantity: number; unit_price: number }) {
  lines.value.push({
    key: `l-${++lineSeq}`,
    product_id: null,
    variant_id: null,
    product_name: item.product_name,
    variant_name: '',
    image_url: null,
    quantity: item.quantity,
    original_price: item.unit_price,
    unit_price: item.unit_price,
    cost_price: null,
    discount_type: 'percent',
    discount_value: 0,
    bill_discount_code: null,
    is_outside: true,
  });
}

function setQuantity(line: BillLine, value: any) {
  const number = Math.max(1, Math.floor(Number(value) || 1));
  const limit = stockLeft(line) - ((inCart.value[line.variant_id || 0] || 0) - Number(line.quantity));
  if (line.variant_id && number > limit) {
    alerts.fail(null, `Only ${limit} of ${line.product_name} ${line.variant_name} left`);
    line.quantity = Math.max(1, limit);
    return;
  }
  line.quantity = number;
}

function removeLine(index: number) {
  lines.value.splice(index, 1);
  discounts.value = activeDiscounts(lines.value, discounts.value);
}

function setPrice(line: BillLine, value: any) {
  const price = Math.max(0, Number(value) || 0);
  if (!line.is_outside && line.cost_price !== null && line.cost_price !== undefined && price < line.cost_price && !can('pos_below_cost', 'POS')) {
    alerts.fail(null, `${line.product_name} ${line.variant_name} cannot be sold below its cost of ${formatMoney(line.cost_price)}`);
    line.unit_price = line.original_price;
    return;
  }
  line.unit_price = price;
}

function openLineDiscount(line: BillLine) {
  lineDiscount.value = { type: line.discount_type, value: line.discount_value || '' };
}

function applyLineDiscount(line: BillLine) {
  const value = Math.max(0, Number(lineDiscount.value.value) || 0);
  line.discount_type = lineDiscount.value.type;
  line.discount_value = lineDiscount.value.type === 'percent' ? Math.min(value, 100) : value;
}

function applyBillDiscount(discount: { type: DiscountType; value: number }) {
  const code = nextDiscountCode(discounts.value);
  lines.value.forEach((line) => {
    if (!line.bill_discount_code) line.bill_discount_code = code;
  });
  discounts.value.push({ code, ...discount });
}

function removeBillDiscount(code: string) {
  lines.value.forEach((line) => {
    if (line.bill_discount_code === code) line.bill_discount_code = null;
  });
  discounts.value = discounts.value.filter((discount) => discount.code !== code);
}

function clearBill() {
  lines.value = [];
  discounts.value = [];
  customerName.value = '';
  customerPhone.value = '';
  debtor.value = null;
  quotation.value = null;
  if (route.query.quotation) router.replace('/pos');
}

function payload() {
  return {
    debtor_id: debtor.value?.id || null,
    customer_name: customerName.value,
    customer_phone: customerPhone.value,
    lines: lines.value.map(({ key, stock, ...line }) => line),
    bill_discounts: activeDiscounts(lines.value, discounts.value),
  };
}

function startBill() {
  if (!lines.value.length) return;
  saveError.value = '';
  paymentDialog.value = true;
}

async function confirmPayment(payment: { payment_method: string; amount_received: number; paid_amount: number }) {
  saving.value = true;
  saveError.value = '';
  try {
    const sale = (await axios.post('sales', { ...payload(), ...payment, session_id: session.value.id, quotation_id: quotation.value?.id })).data;
    paymentDialog.value = false;
    clearBill();
    printDoc.value = sale;
    printKind.value = 'bill';
    printDialog.value = true;
    alerts.success(`Bill ${sale.bill_number} saved`);
    await Promise.all([loadCatalog(), loadSession()]);
    pending.refresh();
  } catch (error) {
    saveError.value = apiError(error);
  } finally {
    saving.value = false;
  }
}

function startQuotation() {
  if (!lines.value.length) return;
  saveError.value = '';
  quotationDialog.value = true;
}

async function confirmQuotation(data: any) {
  saving.value = true;
  saveError.value = '';
  try {
    const saved = (await axios.post('quotations', { ...payload(), ...data, clientstore_id: authStore.clientstoreId })).data;
    quotationDialog.value = false;
    clearBill();
    printDoc.value = saved;
    printKind.value = 'quotation';
    printDialog.value = true;
    alerts.success(`Quotation ${saved.quotation_number} saved`);
  } catch (error) {
    saveError.value = apiError(error);
  } finally {
    saving.value = false;
  }
}

function openCash(type: 'In' | 'Out') {
  cashType.value = type;
  cashDialog.value = true;
}

function onCashSaved(updated: any) {
  session.value = updated;
  alerts.success(cashType.value === 'In' ? 'Cash added to the counter' : 'Cash taken out of the counter');
}

async function onClosed() {
  alerts.success('Counter closed');
  clearBill();
  await loadSession();
  pending.refresh();
}

watch(() => authStore.clientstoreId, () => {
  clearBill();
  brandId.value = null;
  load();
});

watch(() => route.query.quotation, (id) => {
  if (id && !loading.value) loadQuotation(String(id));
});

onMounted(async () => {
  await load();
  await nextTick();
});
</script>

<template>
  <v-alert v-model="alerts.showAlert.value" :text="alerts.alertText.value" type="success" density="compact" class="mb-3 single-line-alert" closable />
  <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-3 single-line-alert" closable />

  <v-skeleton-loader v-if="loading" type="card, table" class="border rounded-lg" />

  <UiParentCard v-else-if="elsewhere" title="Counter Open in Another Shop" icon="mdi-alert-outline">
    <div class="text-center py-8">
      <v-icon size="56" color="warning">mdi-counter</v-icon>
      <h4 class="text-h5 mt-3">You have {{ elsewhere.counter }} open in {{ elsewhere.shop }}</h4>
      <p class="text-lightText mt-1">Close that counter first, or switch to that shop to keep selling.</p>
    </div>
  </UiParentCard>

  <UiParentCard v-else-if="!session" title="Open a Counter" icon="mdi-counter">
    <p class="text-lightText mb-4">Pick your counter and count the cash in it before you start billing.</p>
    <v-row>
      <v-col v-for="counter in counters" :key="counter.id" cols="12" sm="6" lg="4">
        <button type="button" class="counter-choice" :class="{ 'counter-choice--active': openCounterId === counter.id, 'counter-choice--busy': counter.status === 'Open' || !canOpen(counter) }"
          @click="chooseCounter(counter)">
          <div class="d-flex align-center justify-space-between">
            <span class="counter-choice__name"><v-icon size="20" class="me-1">mdi-counter</v-icon>{{ counter.name }}</span>
            <v-chip v-if="!canOpen(counter)" size="small" variant="tonal">Not your counter</v-chip>
            <v-chip v-else size="small" :color="counter.status === 'Open' ? 'success' : undefined" variant="tonal">{{ counter.status === 'Open' ? 'In use' : authStore.client?.electric_counter_id ? 'Your counter' : 'Free' }}</v-chip>
          </div>
          <div class="text-caption text-lightText mt-2 text-start">
            <template v-if="counter.status === 'Open'">Opened by {{ counter.session.cashier?.full_name }} · {{ formatDateTime(counter.session.opened_at) }}</template>
            <template v-else-if="counter.last_session">Last closed {{ formatDateTime(counter.last_session.closed_at) }} with {{ formatMoney(counter.last_session.closing_cash) }}</template>
            <template v-else>Not used yet</template>
          </div>
        </button>
      </v-col>
      <v-col v-if="!counters.length" cols="12">
        <v-alert type="info" variant="tonal">This shop has no counters yet. Create one from Counters.</v-alert>
      </v-col>
    </v-row>
    <div v-if="can('counters_open_close', 'Counter')" class="d-flex align-end flex-wrap ga-3 mt-4">
      <div style="width: 240px">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Opening cash in counter</v-label>
        <v-text-field v-model="openingCash" type="number" min="0" hide-details :disabled="!openCounterId" />
      </div>
      <v-btn color="primary" variant="flat" size="large" prepend-icon="mdi-lock-open-variant-outline" :disabled="!openCounterId" :loading="openingCounter" @click="openCounter">Open Counter</v-btn>
    </div>
    <v-alert v-else type="warning" variant="tonal" class="mt-4">You do not have permission to open a counter.</v-alert>
  </UiParentCard>

  <template v-else>
    <div class="counter-bar">
      <div class="counter-bar__main">
        <v-avatar color="primary" size="38"><v-icon color="white">mdi-counter</v-icon></v-avatar>
        <div>
          <div class="font-weight-bold">{{ session.counter?.name }} <span class="text-caption text-lightText">· {{ session.session_number }}</span></div>
          <div class="text-caption text-lightText">{{ session.cashier?.full_name }} · open since {{ formatDateTime(session.opened_at) }}</div>
        </div>
      </div>
      <div class="counter-bar__stat">
        <span>Cash in counter</span>
        <strong>{{ formatMoney(session.totals.cash_now) }}</strong>
      </div>
      <div class="counter-bar__stat">
        <span>Bills</span>
        <strong>{{ session.totals.bills }} · {{ formatMoney(session.totals.sales_total) }}</strong>
      </div>
      <v-chip v-if="session.totals.pending_costs" color="error" variant="tonal" prepend-icon="mdi-clock-alert-outline" @click="closeDialog = true">
        {{ session.totals.pending_costs }} bought price{{ session.totals.pending_costs === 1 ? '' : 's' }} pending
      </v-chip>
      <v-spacer />
      <div class="d-flex flex-wrap ga-2">
        <v-btn v-if="can('counters_cash_in', 'Counter')" variant="outlined" color="success" prepend-icon="mdi-cash-plus" @click="openCash('In')">Cash In</v-btn>
        <v-btn v-if="can('counters_cash_out', 'Counter')" variant="outlined" color="error" prepend-icon="mdi-cash-minus" @click="openCash('Out')">Cash Out</v-btn>
        <v-btn v-if="can('counters_open_close', 'Counter')" variant="flat" color="secondary" prepend-icon="mdi-lock-outline" @click="closeDialog = true">Close Counter</v-btn>
      </div>
    </div>

    <div class="brand-strip">
      <v-btn icon="mdi-chevron-left" size="small" variant="text" color="primary" class="flex-shrink-0" @click="scrollBrands(-1)" />
      <div ref="brandScroller" class="brand-strip__list">
        <button type="button" class="brand-chip" :class="{ 'brand-chip--active': brandId === null }" @click="brandId = null">
          <span class="brand-chip__logo brand-chip__logo--all"><v-icon size="18">mdi-view-grid-outline</v-icon></span>
          <span>All Brands</span>
        </button>
        <button v-for="brand in catalog.brands" :key="brand.id" type="button" class="brand-chip" :class="{ 'brand-chip--active': brandId === brand.id }"
          @click="brandId = brand.id">
          <span class="brand-chip__logo">
            <img v-if="brand.image_url" :src="brand.image_url" :alt="brand.name" />
            <span v-else class="brand-chip__initial">{{ brand.name.charAt(0) }}</span>
          </span>
          <span>{{ brand.name }}</span>
        </button>
      </div>
      <v-btn icon="mdi-chevron-right" size="small" variant="text" color="primary" class="flex-shrink-0" @click="scrollBrands(1)" />
    </div>

    <v-row class="mt-1">
      <v-col cols="12" md="7" xl="8">
        <div class="pos-panel">
          <div class="pos-panel__search">
            <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" placeholder="Search model, size, SKU or scan barcode..." hide-details clearable
              @keydown.enter.prevent="onSearchEnter" />
          </div>

          <div v-if="search" class="search-results">
            <div class="text-caption text-lightText mb-2">{{ searchResults.length }} match{{ searchResults.length === 1 ? '' : 'es' }}{{ searchResults.length === 1 ? ' · press Enter to add' : '' }}</div>
            <div v-for="row in searchResults" :key="row.variant.id" class="search-row">
              <v-avatar size="44" rounded="lg" class="search-row__image"><v-img :src="row.product.image_url" contain /></v-avatar>
              <div class="flex-grow-1 overflow-hidden">
                <div class="font-weight-semibold text-truncate">{{ row.product.name }} · {{ row.variant.name }}</div>
                <div class="text-caption text-lightText">{{ row.product.brand?.name || 'No brand' }} · {{ row.variant.sku }} · {{ formatNumber(row.variant.stock - (inCart[row.variant.id] || 0), 3) }} in stock</div>
              </div>
              <span class="font-weight-bold me-2">{{ formatMoney(row.variant.sale_price) }}</span>
              <v-btn color="primary" variant="flat" size="small" prepend-icon="mdi-plus" :disabled="row.variant.stock - (inCart[row.variant.id] || 0) <= 0" @click="addFromSearch(row)">Add</v-btn>
            </div>
            <p v-if="!searchResults.length" class="text-center text-lightText py-8 mb-0">Nothing found for "{{ search }}"</p>
          </div>

          <div v-else class="category-grid">
            <button v-for="category in categoriesShown" :key="category.id" type="button" class="category-tile" @click="openCategory(category)">
              <div class="category-tile__image"><img :src="category.image_url" :alt="category.name" /></div>
              <div class="category-tile__name">{{ category.name }}</div>
              <div class="category-tile__count">{{ productCount(category) }} product{{ productCount(category) === 1 ? '' : 's' }}</div>
            </button>
            <p v-if="!categoriesShown.length" class="text-center text-lightText py-8 mb-0 w-100">No categories for this brand.</p>
          </div>
        </div>
      </v-col>

      <v-col cols="12" md="5" xl="4">
        <div class="bill-panel">
          <div class="bill-panel__head">
            <div class="bill-panel__debtor">
              <v-autocomplete v-if="can('pos_debtor_sale', 'POS')" :model-value="debtor" :items="debtors" :loading="loadingDebtors"
                item-title="name" item-value="id" return-object density="compact" hide-details clearable no-filter class="bold-field"
                placeholder="Khata customer" prepend-inner-icon="mdi-account-cash-outline" :menu-props="{ maxHeight: 320 }"
                v-model:search="debtorSearch" @update:search="findDebtors" @update:model-value="pickDebtor" @focus="findDebtors(debtorSearch)">
                <template v-slot:item="{ props: itemProps, item }">
                  <v-list-item v-bind="itemProps" :title="item.raw.name" :subtitle="item.raw.phone || ''">
                    <template v-slot:append>
                      <span class="text-caption font-weight-bold" :class="item.raw.balance > 0 ? 'text-error' : 'text-success'">{{ formatMoney(item.raw.balance) }}</span>
                    </template>
                  </v-list-item>
                </template>
                <template v-slot:no-data>
                  <p class="px-4 py-3 mb-0 text-lightText">{{ debtorSearch ? 'No debtor by that name' : 'Type a name to search' }}</p>
                </template>
              </v-autocomplete>
            </div>
            <v-chip v-if="quotation" color="primary" variant="tonal" size="small" prepend-icon="mdi-file-document-edit-outline">From {{ quotation.quotation_number }}</v-chip>
            <v-btn variant="text" color="error" size="small" prepend-icon="mdi-delete-sweep-outline" :disabled="!lines.length && !quotation" @click="clearBill">Clear</v-btn>
          </div>

          <div class="bill-panel__customer">
            <v-text-field v-model="customerName" density="compact" hide-details placeholder="Customer name" prepend-inner-icon="mdi-account-outline" class="bold-field" />
            <v-text-field v-model="customerPhone" density="compact" hide-details placeholder="Phone" prepend-inner-icon="mdi-phone-outline" class="bold-field" />
          </div>
          <div v-if="debtor" class="bill-panel__khata">
            <v-icon size="16" class="me-1">mdi-account-cash-outline</v-icon>
            On {{ debtor.name }}'s khata<template v-if="debtor.balance"> · owes {{ formatMoney(debtor.balance) }}</template>
          </div>

          <div class="bill-panel__lines">
            <div v-if="!lines.length" class="bill-empty">
              <v-icon size="44" color="grey300">mdi-cart-outline</v-icon>
              <div class="mt-2">Pick a category, set quantities and press <strong>Add to Bill</strong>.</div>
            </div>
            <div v-for="(line, index) in lines" :key="line.key" class="bill-line" :class="{ 'bill-line--outside': line.is_outside }">
              <div class="bill-line__top">
                <v-avatar size="40" rounded="lg" class="bill-line__image">
                  <v-img v-if="line.image_url" :src="line.image_url" contain />
                  <v-icon v-else color="warning">mdi-account-arrow-left-outline</v-icon>
                </v-avatar>
                <div class="flex-grow-1 overflow-hidden">
                  <div class="bill-line__name">{{ line.product_name }}</div>
                  <div class="text-caption text-lightText">{{ line.is_outside ? 'From another shopkeeper' : line.variant_name }}</div>
                  <div class="d-flex flex-wrap ga-1 mt-1">
                    <v-chip v-if="line.bill_discount_code" size="x-small" color="primary" variant="tonal">
                      {{ line.bill_discount_code }} · {{ discountLabel(discounts.find((discount) => discount.code === line.bill_discount_code)!) }}
                    </v-chip>
                    <v-chip v-if="line.is_outside" size="x-small" color="warning" variant="tonal">Bought price pending</v-chip>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-weight-bold">{{ formatMoney(bill.lines[index]?.total) }}</div>
                  <div v-if="bill.lines[index]?.total !== bill.lines[index]?.gross" class="text-caption text-lightText text-decoration-line-through">{{ formatMoney(bill.lines[index]?.gross) }}</div>
                </div>
                <v-btn icon="mdi-close" size="x-small" variant="text" color="error" @click="removeLine(index)" />
              </div>
              <div class="bill-line__controls">
                <div class="qty-control">
                  <v-btn icon="mdi-minus" size="x-small" variant="tonal" color="primary" :disabled="line.quantity <= 1" @click="setQuantity(line, Number(line.quantity) - 1)" />
                  <input class="qty-control__input" type="number" min="1" :value="line.quantity" @change="setQuantity(line, ($event.target as HTMLInputElement).value)" />
                  <v-btn icon="mdi-plus" size="x-small" variant="flat" color="primary" @click="setQuantity(line, Number(line.quantity) + 1)" />
                </div>
                <div class="price-field">
                  <span class="price-field__label">Price</span>
                  <input class="price-field__input" type="number" min="0" :value="line.unit_price" :disabled="!line.is_outside && !can('pos_price_edit', 'POS')"
                    @change="setPrice(line, ($event.target as HTMLInputElement).value)" />
                  <span v-if="line.unit_price !== line.original_price" class="price-field__was">was {{ formatNumber(line.original_price) }}</span>
                </div>
                <v-menu v-if="can('pos_item_discount', 'POS')" :close-on-content-click="false" location="bottom end" @update:model-value="(open: boolean) => open && openLineDiscount(line)">
                  <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" size="small" :variant="Number(line.discount_value) ? 'tonal' : 'text'" color="primary" class="text-none px-2">
                      <v-icon size="16" class="me-1">mdi-tag-outline</v-icon>{{ Number(line.discount_value) ? discountLabel({ type: line.discount_type, value: line.discount_value }) : 'Discount' }}
                    </v-btn>
                  </template>
                  <v-card class="pa-3" width="240">
                    <div class="text-subtitle-2 mb-2">Item discount</div>
                    <v-btn-toggle v-model="lineDiscount.type" mandatory color="primary" variant="outlined" divided density="compact" class="w-100 mb-2">
                      <v-btn value="percent" class="flex-grow-1">%</v-btn>
                      <v-btn value="amount" class="flex-grow-1">Rs</v-btn>
                    </v-btn-toggle>
                    <v-text-field v-model="lineDiscount.value" type="number" min="0" density="compact" hide-details autofocus placeholder="0" />
                    <div class="d-flex ga-2 mt-2">
                      <v-btn size="small" variant="text" color="error" @click="lineDiscount.value = ''; applyLineDiscount(line)">Remove</v-btn>
                      <v-spacer />
                      <v-btn size="small" color="primary" variant="flat" @click="applyLineDiscount(line)">Apply</v-btn>
                    </div>
                  </v-card>
                </v-menu>
              </div>
            </div>
          </div>

          <div class="bill-panel__tools">
            <v-btn v-if="can('pos_outside_item', 'POS')" variant="flat" color="warning" class="bill-tool-btn" prepend-icon="mdi-account-arrow-left-outline" @click="quickDialog = true">Item from another shop</v-btn>
            <v-btn v-if="can('pos_bill_discount', 'POS')" variant="flat" color="primary" class="bill-tool-btn" prepend-icon="mdi-sale-outline" :disabled="!uncovered.length" @click="discountDialog = true">Bill discount</v-btn>
          </div>

          <div class="bill-panel__totals">
            <div class="bill-total-row"><span>Subtotal</span><span>{{ formatMoney(bill.subtotal) }}</span></div>
            <div v-if="bill.item_discount" class="bill-total-row"><span>Item discounts</span><span>- {{ formatMoney(bill.item_discount) }}</span></div>
            <div v-for="discount in bill.discounts" :key="discount.code" class="bill-total-row">
              <span>
                <v-chip size="x-small" color="primary" variant="tonal" class="me-1">{{ discount.code }}</v-chip>
                {{ discountLabel(discount) }} on {{ discount.lines }} item{{ discount.lines === 1 ? '' : 's' }}
                <v-btn icon="mdi-close" size="x-small" variant="text" density="compact" color="error" @click="removeBillDiscount(discount.code)" />
              </span>
              <span>- {{ formatMoney(discount.amount) }}</span>
            </div>
            <div class="bill-total-row bill-total-row--grand"><span>Total</span><span>{{ formatMoney(bill.total) }}</span></div>
          </div>

          <div class="bill-panel__actions">
            <v-btn v-if="can('quotations_create', 'Quotation')" variant="outlined" color="primary" size="large" prepend-icon="mdi-file-document-edit-outline"
              :disabled="!lines.length || !!quotation" @click="startQuotation">Quotation</v-btn>
            <v-btn color="primary" variant="flat" size="large" prepend-icon="mdi-receipt-text-check-outline" :disabled="!lines.length" class="flex-grow-1" @click="startBill">
              Bill · {{ formatMoney(bill.total) }}
            </v-btn>
          </div>
        </div>
      </v-col>
    </v-row>
  </template>

  <CategoryDialog v-model="categoryDialog" :category="activeCategory" :brands="catalog.brands" :products="catalog.products" :brand-id="brandId" :in-cart="inCart" @add="addRows" />
  <QuickItemDialog v-model="quickDialog" @add="addOutside" />
  <BillDiscountDialog v-model="discountDialog" :lines="uncovered" @apply="applyBillDiscount" />
  <PaymentDialog v-model="paymentDialog" :total="bill.total" :debtor="debtor" :saving="saving" :error-text="saveError" @confirm="confirmPayment" @close-error="saveError = ''" />
  <QuotationDialog v-model="quotationDialog" :total="bill.total" :customer-name="customerName" :customer-phone="customerPhone" :saving="saving" :error-text="saveError"
    @confirm="confirmQuotation" @close-error="saveError = ''" />
  <PrintDialog v-model="printDialog" :doc="printDoc" :kind="printKind" :title="printKind === 'bill' ? 'Bill Saved' : 'Quotation Saved'">
    <template #actions>
      <span v-if="printKind === 'quotation' && printDoc" class="text-caption text-lightText">Valid until {{ formatDate(printDoc.valid_until) }}</span>
    </template>
  </PrintDialog>
  <CashMoveDialog v-if="session" v-model="cashDialog" :session-id="session.id" :type="cashType" :cash-now="session.totals.cash_now" @saved="onCashSaved" />
  <CloseCounterDialog v-if="session" v-model="closeDialog" :session-id="session.id" @closed="onClosed" @cost-saved="loadSession" />
</template>

<style scoped>
.counter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px 22px;
  padding: 12px 16px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 12px;
  background: #fff;
}

.counter-bar__main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.counter-bar__stat {
  display: flex;
  flex-direction: column;
  padding-left: 18px;
  border-left: 1px solid rgb(var(--v-theme-borderColor));
}

.counter-bar__stat span {
  font-size: 12px;
  color: rgb(var(--v-theme-lightgray));
}

.counter-bar__stat strong {
  font-size: 17px;
  color: rgb(var(--v-theme-textPrimary));
}

.counter-choice {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 12px;
  background: #fff;
  text-align: start;
}

.counter-choice__name {
  font-size: 16px;
  font-weight: 600;
}

.counter-choice--active {
  border: 2px solid rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-lightprimary));
}

.counter-choice--busy {
  opacity: 0.6;
  cursor: not-allowed;
}

.pos-panel {
  padding: 14px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 12px;
  background: #fff;
}

.brand-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  margin: 12px 0 0;
  padding: 8px 10px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 12px;
}

.brand-strip__list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  flex-grow: 1;
}

.brand-strip__list::-webkit-scrollbar {
  display: none;
}

.brand-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 5px 14px 5px 5px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 999px;
  background: #fff;
  font-size: 13.5px;
  font-weight: 600;
  color: rgb(var(--v-theme-textPrimary));
  white-space: nowrap;
}

.brand-chip:hover {
  border-color: rgb(var(--v-theme-primary));
}

.brand-chip--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
  color: #fff;
}

.brand-chip__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 30px;
  border-radius: 999px;
  background: #fff;
  overflow: hidden;
}

.brand-chip__logo img {
  max-width: 40px;
  max-height: 24px;
  object-fit: contain;
}

.brand-chip__logo--all {
  width: 30px;
  color: rgb(var(--v-theme-primary));
}

.brand-chip__initial {
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1279px) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.category-tile {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 10px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 12px;
  background: #fff;
  text-align: start;
  transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
}

.category-tile:hover {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 8px 18px rgba(21, 101, 192, 0.12);
  transform: translateY(-1px);
}

.category-tile__image {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 110px;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.category-tile__image img {
  max-width: 100%;
  max-height: 104px;
  object-fit: contain;
}

.category-tile__name {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--v-theme-textPrimary));
}

.category-tile__count {
  font-size: 12px;
  color: rgb(var(--v-theme-lightgray));
}

.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.search-row__image,
.bill-line__image {
  border: 1px solid rgb(var(--v-theme-borderColor));
  background: #fff;
}

.bill-panel {
  position: sticky;
  top: 86px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 110px);
  min-height: 560px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.bill-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.bill-panel__title {
  font-size: 18px;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.bill-panel__debtor {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 260px;
}

.bill-panel__khata {
  display: flex;
  align-items: center;
  margin: 0 14px 10px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgb(var(--v-theme-lightwarning));
  color: rgb(var(--v-theme-warning));
  font-size: 12px;
  font-weight: 700;
}

.bill-panel__customer {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.bill-panel__lines {
  flex: 1 1 auto;
  min-height: 140px;
  overflow-y: auto;
  padding: 6px 10px;
  background: rgb(var(--v-theme-grey50));
}

.bill-empty {
  padding: 36px 12px;
  text-align: center;
  font-size: 13px;
  color: rgb(var(--v-theme-lightgray));
}

.bill-line {
  margin: 6px 0;
  padding: 8px 10px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 10px;
  background: #fff;
}

.bill-line--outside {
  border-color: rgba(var(--v-theme-warning), 0.6);
  background: rgb(var(--v-theme-lightwarning));
}

.bill-line__top {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.bill-line__name {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.3;
  color: rgb(var(--v-theme-textPrimary));
}

.bill-line__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  padding-left: 50px;
}

.qty-control {
  display: flex;
  align-items: center;
  gap: 5px;
}

.qty-control__input,
.price-field__input {
  height: 28px;
  border: 1px solid rgb(var(--v-theme-inputBorder));
  border-radius: 6px;
  text-align: center;
  font-weight: 600;
  outline: none;
  background: #fff;
}

.qty-control__input {
  width: 44px;
}

.qty-control__input:focus,
.price-field__input:focus {
  border-color: rgb(var(--v-theme-primary));
}

.price-field {
  display: flex;
  align-items: center;
  gap: 5px;
}

.price-field__label {
  font-size: 12px;
  color: rgb(var(--v-theme-lightgray));
}

.price-field__input {
  width: 84px;
}

.price-field__input:disabled {
  background: rgb(var(--v-theme-grey100));
  color: rgb(var(--v-theme-textSecondary));
}

.price-field__was {
  font-size: 11px;
  color: rgb(var(--v-theme-orange));
}

.bill-panel__tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid rgb(var(--v-theme-borderColor));
}

.bill-tool-btn {
  flex: 1 1 0;
  min-width: 150px;
  min-height: 42px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
}

.bill-panel__totals {
  padding: 8px 14px;
  border-top: 1px solid rgb(var(--v-theme-borderColor));
}

.bill-total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
  font-size: 13.5px;
}

.bill-total-row--grand {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed rgb(var(--v-theme-borderColor));
  font-size: 20px;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.bill-panel__actions {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid rgb(var(--v-theme-borderColor));
}
</style>
