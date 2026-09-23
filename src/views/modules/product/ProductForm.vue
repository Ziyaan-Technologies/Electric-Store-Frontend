<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import BtnFilled from '@/components/shared/BtnFilled.vue';
import BtnOutlined from '@/components/shared/BtnOutlined.vue';
import ImageField from '@/components/shared/ImageField.vue';
import { useAlerts } from '@/composables/useAlerts';
import { useLookups } from '@/composables/useLookups';
import { useAuthStore } from '@/stores/auth';
import { formatMoney, formatNumber, rules, uploadImage } from '@/utils/api';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const alerts = useAlerts();
const lookups = useLookups();
const id = computed(() => route.params.id as string | undefined);
const isEdit = computed(() => !!id.value);
const formRef = ref<any>(null);
const loading = ref(false);
const saving = ref(false);
const imageFile = ref<File | null>(null);
const form = ref<any>({
  name: '',
  description: '',
  category_id: null,
  brand_id: null,
  is_active: true,
  image_url: '',
});
const variants = ref<any[]>([]);

function blankVariant() {
  return {
    id: undefined,
    name: '',
    sku: '',
    barcode: '',
    cost_price: 0,
    sale_price: 0,
    stock: 0,
    reorder_level: 0,
    is_active: true,
  };
}

function margin(variant: any) {
  const price = Number(variant.sale_price) || 0;
  const cost = Number(variant.cost_price) || 0;
  if (!price) return null;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

function suggestSku(variant: any, index: number) {
  if (variant.sku || !form.value.name) return;
  const base = form.value.name.replace(/[^a-z0-9]+/gi, '').slice(0, 6).toUpperCase();
  const suffix = (variant.name || String(index + 1)).replace(/[^a-z0-9]+/gi, '').slice(0, 6).toUpperCase();
  variant.sku = `${authStore.clientstore?.store_code || 'SKU'}-${base}-${suffix}`;
}

function variantError() {
  if (!variants.value.length) return 'Add at least one size / rating';
  for (const [index, variant] of variants.value.entries()) {
    if (!variant.name?.trim()) return `Row ${index + 1}: size / rating is required`;
    if (!variant.sku?.trim()) return `Row ${index + 1}: SKU is required`;
    if (!(Number(variant.sale_price) > 0)) return `Row ${index + 1}: sale price must be above zero`;
  }
  return '';
}

async function save() {
  const { valid } = await formRef.value.validate();
  if (!valid) return;
  const message = variantError();
  if (message) {
    alerts.fail(null, message);
    return;
  }
  saving.value = true;
  try {
    const image = await uploadImage('product', imageFile.value);
    const payload = {
      ...form.value,
      clientstore_id: authStore.clientstoreId,
      name: form.value.name.trim(),
      image_url: image || form.value.image_url || undefined,
      brand_id: form.value.brand_id || null,
      variants: variants.value.map((variant) => ({
        ...(variant.id ? { id: variant.id } : {}),
        name: variant.name.trim(),
        sku: variant.sku.trim(),
        barcode: variant.barcode?.trim() || undefined,
        cost_price: Number(variant.cost_price) || 0,
        sale_price: Number(variant.sale_price) || 0,
        stock: Number(variant.stock) || 0,
        reorder_level: Number(variant.reorder_level) || 0,
        is_active: variant.is_active,
      })),
    };
    if (isEdit.value) {
      await axios.put(`products/${id.value}`, payload);
    } else {
      await axios.post('products', payload);
    }
    router.push('/products');
  } catch (error) {
    alerts.fail(error);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([lookups.loadCategories(), lookups.loadBrands()]);
    if (isEdit.value) {
      const product = (await axios.get(`products/${id.value}`)).data;
      form.value = {
        name: product.name,
        description: product.description || '',
        category_id: product.category_id,
        brand_id: product.brand_id || null,
        is_active: product.is_active,
        image_url: product.image_url || '',
      };
      variants.value = product.variants.map((variant: any) => ({ ...variant, barcode: variant.barcode || '' }));
    } else {
      variants.value = [blankVariant()];
    }
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <v-row>
    <v-col cols="12">
      <UiParentCard>
        <template #action>
          <v-btn variant="outlined" color="primary" to="/products" prepend-icon="mdi-arrow-left">Back</v-btn>
        </template>

        <v-skeleton-loader v-if="loading" type="article, table" />
        <v-form v-else ref="formRef" @submit.prevent>
          <v-row>
            <v-col cols="12" lg="8">
              <v-row>
                <v-col cols="12">
                  <v-label class="text-subtitle-1 pb-2 text-lightText">Product Name</v-label>
                  <v-text-field v-model="form.name" :rules="[rules.required]" placeholder="e.g. YCB7-63N Miniature Breaker" hide-details="auto" />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-label class="text-subtitle-1 pb-2 text-lightText">Category</v-label>
                  <v-autocomplete v-model="form.category_id" :items="lookups.categories.value" item-title="name" item-value="id" :rules="[rules.requiredSelect]" hide-details="auto" />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-label class="text-subtitle-1 pb-2 text-lightText">Brand</v-label>
                  <v-autocomplete v-model="form.brand_id" :items="lookups.brands.value" item-title="name" item-value="id" clearable placeholder="No brand" hide-details />
                </v-col>
                <v-col cols="12">
                  <v-label class="text-subtitle-1 pb-2 text-lightText">Description</v-label>
                  <v-textarea v-model="form.description" rows="3" auto-grow hide-details />
                </v-col>
              </v-row>
            </v-col>
            <v-col cols="12" lg="4">
              <ImageField v-model="imageFile" :existing-url="form.image_url" />
              <div class="border rounded-md px-4 py-2 mt-4 d-flex align-center justify-space-between">
                <p class="text-subtitle-1 font-weight-bold" :class="{ 'text-primary': form.is_active }">Active?</p>
                <v-switch color="primary" v-model="form.is_active" hide-details></v-switch>
              </div>
            </v-col>
          </v-row>

          <div class="d-flex align-center justify-space-between mt-6 mb-2">
            <div>
              <h4 class="text-h5">Sizes / Ratings</h4>
              <p class="text-caption text-lightText mb-0">Each row is one thing you sell, like "1 Pole · 32A". Stock and cost of a saved size change through Add Stock.</p>
            </div>
            <v-btn variant="tonal" color="primary" prepend-icon="mdi-plus" @click="variants.push(blankVariant())">Add Size</v-btn>
          </div>

          <div class="border rounded-md overflow-x-auto">
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th style="min-width: 160px">SIZE / RATING</th>
                  <th style="min-width: 170px">SKU</th>
                  <th style="min-width: 160px">BARCODE</th>
                  <th style="width: 120px">COST</th>
                  <th style="width: 120px">SALE PRICE</th>
                  <th style="width: 100px">STOCK</th>
                  <th style="width: 100px">REORDER AT</th>
                  <th style="width: 80px">MARGIN</th>
                  <th style="width: 70px">ACTIVE</th>
                  <th style="width: 60px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(variant, index) in variants" :key="variant.id || `new-${index}`">
                  <td><v-text-field v-model="variant.name" density="compact" hide-details placeholder="1 Pole · 32A" /></td>
                  <td><v-text-field v-model="variant.sku" density="compact" hide-details @focus="suggestSku(variant, index)" /></td>
                  <td><v-text-field v-model="variant.barcode" density="compact" hide-details prepend-inner-icon="mdi-barcode" /></td>
                  <td>
                    <v-text-field v-if="!variant.id" v-model.number="variant.cost_price" type="number" min="0" density="compact" hide-details />
                    <span v-else class="text-no-wrap">{{ formatMoney(variant.cost_price) }}</span>
                  </td>
                  <td><v-text-field v-model.number="variant.sale_price" type="number" min="0" density="compact" hide-details /></td>
                  <td>
                    <v-text-field v-if="!variant.id" v-model.number="variant.stock" type="number" min="0" density="compact" hide-details />
                    <span v-else class="text-no-wrap">{{ formatNumber(variant.stock, 3) }}</span>
                  </td>
                  <td><v-text-field v-model.number="variant.reorder_level" type="number" min="0" density="compact" hide-details /></td>
                  <td>
                    <span v-if="margin(variant) !== null" :class="(margin(variant) ?? 0) < 0 ? 'text-error font-weight-bold' : ''">{{ margin(variant) }}%</span>
                    <span v-else class="text-lightText">-</span>
                  </td>
                  <td><v-checkbox-btn v-model="variant.is_active" color="primary" density="compact" /></td>
                  <td><v-btn icon="mdi-delete-outline" color="#FFEFEF" size="small" class="text-error" :disabled="variants.length === 1" @click="variants.splice(index, 1)"></v-btn></td>
                </tr>
              </tbody>
            </v-table>
          </div>

          <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mt-4 single-line-alert" closable />

          <div class="d-flex justify-end gap-2 mt-6">
            <BtnOutlined type="button" outline="Cancel" @click="router.back()" />
            <BtnFilled type="button" :filled="isEdit ? 'Save Changes' : 'Create Product'" :loading="saving" @click="save" />
          </div>
        </v-form>
      </UiParentCard>
    </v-col>
  </v-row>
</template>
