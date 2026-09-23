<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import ListToolbar from '@/components/shared/ListToolbar.vue';
import TableBottom from '@/components/shared/TableBottom.vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import DeleteDialog from '@/components/shared/DeleteDialog.vue';
import ActiveIcon from '@/components/shared/ActiveIcon.vue';
import ImageField from '@/components/shared/ImageField.vue';
import { useListPage } from '@/composables/useListPage';
import { useAlerts } from '@/composables/useAlerts';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/utils/permissions';
import { rules, uploadImage } from '@/utils/api';
import type { Header } from '@/models/type-interfaces';

const authStore = useAuthStore();
const alerts = useAlerts();
const drawerAlerts = useAlerts();
const status = ref<string | null>(null);

const list = useListPage('categories', {
  kpis: false,
  storeScoped: true,
  filters: () => ({ status: status.value || undefined }),
  onError: (error) => alerts.fail(error),
});

const headers = ref<Header[]>([
  { title: 'ID', align: 'start', key: 'id' },
  { title: 'CATEGORY', align: 'start', key: 'name' },
  { title: 'DESCRIPTION', align: 'start', key: 'description' },
  { title: 'PRODUCTS', align: 'start', key: 'product_count' },
  { title: 'ORDER', align: 'start', key: 'sort_order' },
  { title: 'ACTIVE', align: 'start', key: 'is_active' },
  { title: 'ACTIONS', key: 'actions', sortable: false },
]);

const drawer = ref(false);
const drawerRef = ref<any>(null);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<any>({});
const imageFile = ref<File | null>(null);
const deleteOpen = ref(false);
const deleteId = ref<number | null>(null);

function openForm(item: any = null) {
  editingId.value = item?.id || null;
  form.value = {
    name: item?.name || '',
    description: item?.description || '',
    sort_order: item?.sort_order ?? list.totalItems.value + 1,
    image_url: item?.image_url || '',
    is_active: item?.is_active ?? true,
  };
  imageFile.value = null;
  drawerAlerts.clear();
  drawer.value = true;
  drawerRef.value?.resetValidation();
}

async function save() {
  if (!(await drawerRef.value.validate())) return;
  saving.value = true;
  try {
    const payload: Record<string, any> = {
      ...form.value,
      name: form.value.name.trim(),
      sort_order: Number(form.value.sort_order) || 0,
      clientstore_id: authStore.clientstoreId,
    };
    const image = await uploadImage('category', imageFile.value);
    if (image) payload.image_url = image;
    if (editingId.value) {
      await axios.put(`categories/${editingId.value}`, payload);
      alerts.success('Category has been updated!');
    } else {
      await axios.post('categories', payload);
      alerts.success('Category has been created!');
    }
    drawer.value = false;
    list.refresh();
  } catch (error) {
    drawerAlerts.fail(error);
  } finally {
    saving.value = false;
  }
}

function openDelete(item: any) {
  deleteId.value = item.id;
  deleteOpen.value = true;
}

async function remove() {
  try {
    await axios.delete(`categories/${deleteId.value}`);
    alerts.success('Category has been deleted!');
    list.refresh();
  } catch (error) {
    alerts.fail(error);
  }
}
</script>

<template>
  <v-row>
    <v-col cols="12">
      <UiParentCard>
        <ListToolbar :total="list.totalItems.value" label="Total Categories" search-placeholder="Search categories..."
          add-label="Add New Category" :can-add="can('categories_create', 'Category')" @search="list.onSearch" @add="openForm()">
          <template #filters>
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
          <template v-slot:item.name="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar size="48" rounded="md" class="border bg-white">
                <v-img v-if="item.image_url" :src="item.image_url" contain />
                <v-icon v-else size="20" color="primary">mdi-shape-outline</v-icon>
              </v-avatar>
              <span class="text-subtitle-2 ml-3">{{ item.name }}</span>
            </div>
          </template>
          <template v-slot:item.description="{ item }">{{ item.description || '-' }}</template>
          <template v-slot:item.is_active="{ item }"><ActiveIcon :active="item.is_active" /></template>
          <template v-slot:item.actions="{ item }">
            <v-btn v-if="$can('categories_edit', 'Category')" icon="mdi-pencil-outline" color="#EFF0F1" size="small" class="me-2" @click="openForm(item)"></v-btn>
            <v-btn v-if="$can('categories_delete', 'Category')" icon="mdi-delete-outline" color="#FFEFEF" size="small" class="text-error" @click="openDelete(item)"></v-btn>
          </template>
          <template v-slot:no-data>
            <p class="px-2 py-2">No categories yet</p>
          </template>
          <template v-slot:bottom>
            <TableBottom v-model:page="list.currentPage.value" :page-count="list.pageCount.value" v-model:per-page="list.itemsPerPageInput.value" :total="list.totalItems.value" />
          </template>
        </v-data-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <RightDrawer ref="drawerRef" v-model="drawer" :title="editingId ? 'Edit Category' : 'Add New Category'"
    subtitle="Categories show as picture tiles on the sell screen"
    :submit-label="editingId ? 'Update Category' : 'Create Category'" :loading="saving"
    :show-error-alert="drawerAlerts.showErrorAlert.value" :error-text="drawerAlerts.errorText.value"
    @submit="save" @close-error="drawerAlerts.clear()">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Name</v-label>
        <v-text-field v-model="form.name" :rules="[rules.required]" placeholder="e.g. MCB" hide-details="auto" />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Description</v-label>
        <v-textarea v-model="form.description" rows="2" auto-grow hide-details />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Order on sell screen</v-label>
        <v-text-field v-model="form.sort_order" type="number" hide-details />
      </v-col>
      <v-col cols="12">
        <ImageField v-model="imageFile" :existing-url="form.image_url" label="Tile picture" />
      </v-col>
      <v-col cols="12" class="pb-0 d-flex align-center justify-space-between">
        <p class="text-subtitle-1 font-weight-bold" :class="{ 'text-primary': form.is_active }">Active?</p>
        <v-switch color="primary" v-model="form.is_active" hide-details></v-switch>
      </v-col>
    </v-row>
  </RightDrawer>

  <DeleteDialog v-model="deleteOpen" message="Are you sure you want to delete this category?" hint="Categories with products cannot be deleted." @confirm="remove" />
</template>
