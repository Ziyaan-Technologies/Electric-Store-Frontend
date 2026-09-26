<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatMoney, formatNumber } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  category: any;
  brands: any[];
  products: any[];
  brandId: number | null;
  inCart: Record<number, number>;
  onlyProductId?: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'add', rows: { product: any; variant: any; quantity: number }[]): void;
}>();

const brandFilter = ref<number | null>(null);
const search = ref('');
const quantities = ref<Record<number, number>>({});

const categoryProducts = computed(() => (props.onlyProductId
  ? props.products.filter((product) => product.id === props.onlyProductId)
  : props.products.filter((product) => product.category_id === props.category?.id)));

const categoryBrands = computed(() => props.brands.filter((brand) => categoryProducts.value.some((product) => product.brand_id === brand.id)));

const hasUnbranded = computed(() => categoryProducts.value.some((product) => !product.brand_id));

const shown = computed(() => {
  const term = search.value.trim().toLowerCase();
  return categoryProducts.value
    .filter((product) => brandFilter.value === null || (brandFilter.value === 0 ? !product.brand_id : product.brand_id === brandFilter.value))
    .map((product) => ({
      ...product,
      variants: product.variants.filter((variant: any) => !term || `${product.name} ${product.number || ''} ${variant.name} ${variant.sku}`.toLowerCase().includes(term)),
    }))
    .filter((product) => product.variants.length);
});

const selected = computed(() => categoryProducts.value.flatMap((product) => product.variants
  .filter((variant: any) => (quantities.value[variant.id] || 0) > 0)
  .map((variant: any) => ({ product, variant, quantity: quantities.value[variant.id] }))));

const selectedTotal = computed(() => selected.value.reduce((sum, row) => sum + row.quantity * row.variant.sale_price, 0));
const selectedPieces = computed(() => selected.value.reduce((sum, row) => sum + row.quantity, 0));

function available(variant: any) {
  return Math.max(0, variant.stock - (props.inCart[variant.id] || 0));
}

function setQuantity(variant: any, value: any) {
  const number = Math.floor(Number(value) || 0);
  quantities.value[variant.id] = Math.min(Math.max(0, number), available(variant));
}

function step(variant: any, change: number) {
  setQuantity(variant, (quantities.value[variant.id] || 0) + change);
}

function add() {
  if (!selected.value.length) return;
  emit('add', selected.value);
  emit('update:modelValue', false);
}

watch(() => props.modelValue, (open) => {
  if (open) {
    brandFilter.value = props.brandId && categoryBrands.value.some((brand) => brand.id === props.brandId) ? props.brandId : null;
    search.value = '';
    quantities.value = {};
  }
});
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="980" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card v-if="category" class="ui-modal">
      <div class="ui-modal__header">
        <div class="d-flex align-center ga-3">
          <v-avatar size="40" rounded="lg" color="white">
            <v-img :src="category.image_url" contain />
          </v-avatar>
          <div>
            <span class="ui-modal__title">{{ onlyProductId ? categoryProducts[0]?.name || category.name : category.name }}</span>
            <div class="category-dialog__subtitle">
              <template v-if="onlyProductId">Pick the size and quantity, then add it to the bill</template>
              <template v-else>{{ categoryProducts.length }} products · pick sizes and quantities, then add them together</template>
            </div>
          </div>
        </div>
        <button class="ui-modal__close" type="button" aria-label="Close" @click="emit('update:modelValue', false)">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <div class="category-dialog__toolbar">
        <div class="d-flex flex-wrap ga-2 flex-grow-1">
          <v-chip :color="brandFilter === null ? 'primary' : undefined" :variant="brandFilter === null ? 'flat' : 'outlined'" @click="brandFilter = null">All brands</v-chip>
          <v-chip v-for="brand in categoryBrands" :key="brand.id" :color="brandFilter === brand.id ? 'primary' : undefined"
            :variant="brandFilter === brand.id ? 'flat' : 'outlined'" @click="brandFilter = brand.id">
            {{ brand.name }}
          </v-chip>
          <v-chip v-if="hasUnbranded" :color="brandFilter === 0 ? 'primary' : undefined" :variant="brandFilter === 0 ? 'flat' : 'outlined'" @click="brandFilter = 0">No brand</v-chip>
        </div>
        <div class="category-dialog__search">
          <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" placeholder="Find size, model, SKU..." hide-details clearable density="compact" />
        </div>
      </div>

      <v-card-text class="category-dialog__body">
        <div v-for="product in shown" :key="product.id" class="product-block">
          <div class="product-block__head">
            <v-avatar size="58" rounded="lg" class="product-block__image">
              <v-img :src="product.image_url" contain />
            </v-avatar>
            <div class="overflow-hidden">
              <div class="product-block__name">
                <span v-if="product.number" class="product-block__number">{{ product.number }}</span>{{ product.name }}
              </div>
              <div class="d-flex align-center ga-2 mt-1">
                <v-chip v-if="product.brand" size="x-small" color="primary" variant="tonal">{{ product.brand.name }}</v-chip>
                <span class="text-caption text-lightText">{{ product.variants.length }} size{{ product.variants.length === 1 ? '' : 's' }}</span>
              </div>
            </div>
          </div>
          <div class="variant-grid">
            <div class="variant-grid__row variant-grid__row--head">
              <span>Size / Rating</span><span>SKU</span><span class="text-right">Price</span><span class="text-right">In stock</span><span class="text-center">Qty</span>
            </div>
            <div v-for="variant in product.variants" :key="variant.id" class="variant-grid__row"
              :class="{ 'variant-grid__row--picked': (quantities[variant.id] || 0) > 0, 'variant-grid__row--out': !available(variant) }">
              <span class="font-weight-semibold">{{ variant.name }}</span>
              <span class="text-caption text-lightText">{{ variant.sku }}</span>
              <span class="text-right font-weight-bold">{{ formatMoney(variant.sale_price) }}</span>
              <span class="text-right" :class="variant.stock <= variant.reorder_level ? 'text-error font-weight-bold' : ''">
                {{ formatNumber(available(variant), 3) }}<span v-if="inCart[variant.id]" class="text-caption text-lightText"> ({{ inCart[variant.id] }} on bill)</span>
              </span>
              <div class="qty-control">
                <v-btn icon="mdi-minus" size="x-small" variant="tonal" color="primary" :disabled="!(quantities[variant.id] > 0)" @click="step(variant, -1)" />
                <input class="qty-control__input" type="number" min="0" :max="available(variant)" :value="quantities[variant.id] || 0"
                  :disabled="!available(variant)" @input="setQuantity(variant, ($event.target as HTMLInputElement).value)" @focus="($event.target as HTMLInputElement).select()" />
                <v-btn icon="mdi-plus" size="x-small" variant="flat" color="primary" :disabled="(quantities[variant.id] || 0) >= available(variant)" @click="step(variant, 1)" />
              </div>
            </div>
          </div>
        </div>
        <p v-if="!shown.length" class="text-center text-lightText py-8">No products match.</p>
      </v-card-text>

      <div class="ui-modal__divider" />
      <div class="category-dialog__footer">
        <div>
          <div class="font-weight-bold">{{ selected.length }} size{{ selected.length === 1 ? '' : 's' }} · {{ selectedPieces }} pcs</div>
          <div class="text-caption text-lightText">{{ formatMoney(selectedTotal) }}</div>
        </div>
        <v-spacer />
        <v-btn variant="outlined" color="primary" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" variant="flat" prepend-icon="mdi-cart-plus" :disabled="!selected.length" @click="add">Add to Bill</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.category-dialog__subtitle {
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.85);
}

.category-dialog__toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 20px;
  border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.category-dialog__search {
  width: 260px;
  max-width: 100%;
}

.category-dialog__body {
  padding: 16px 20px !important;
  background: rgb(var(--v-theme-grey50));
}

.product-block {
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 12px;
  background: #fff;
  margin-bottom: 14px;
  overflow: hidden;
}

.product-block__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.product-block__image {
  border: 1px solid rgb(var(--v-theme-borderColor));
  background: #fff;
}

.product-block__number {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 7px;
  border-radius: 6px;
  background: rgb(var(--v-theme-lightprimary));
  color: rgb(var(--v-theme-primary));
  font-size: 12px;
  font-weight: 700;
  vertical-align: middle;
}

.product-block__name {
  font-size: 15px;
  font-weight: 600;
  color: rgb(var(--v-theme-textPrimary));
}

.variant-grid__row {
  display: grid;
  grid-template-columns: minmax(140px, 1.6fr) minmax(90px, 1fr) 110px 120px 130px;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-bottom: 1px solid rgb(var(--v-theme-borderColor));
  font-size: 13.5px;
}

.variant-grid__row:last-child {
  border-bottom: 0;
}

.variant-grid__row--head {
  background: rgb(var(--v-theme-grey100));
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  color: rgb(var(--v-theme-lightgray));
}

.variant-grid__row--picked {
  background: rgb(var(--v-theme-lightprimary));
}

.variant-grid__row--out {
  opacity: 0.55;
}

.qty-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.qty-control__input {
  width: 46px;
  height: 28px;
  border: 1px solid rgb(var(--v-theme-inputBorder));
  border-radius: 6px;
  text-align: center;
  font-weight: 600;
  outline: none;
  background: #fff;
}

.qty-control__input:focus {
  border-color: rgb(var(--v-theme-primary));
}

.category-dialog__footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
}

@media (max-width: 700px) {
  .variant-grid__row {
    grid-template-columns: 1fr 90px 120px;
  }

  .variant-grid__row > :nth-child(2),
  .variant-grid__row > :nth-child(4) {
    display: none;
  }
}
</style>
