<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
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
import { useLookups } from '@/composables/useLookups';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/utils/permissions';
import { rules, uploadImage } from '@/utils/api';
import type { Header } from '@/models/type-interfaces';

const authStore = useAuthStore();
const alerts = useAlerts();
const drawerAlerts = useAlerts();
const lookups = useLookups();
const shopFilter = ref<number | null>(null);
const roleFilter = ref<number | null>(null);

const list = useListPage('clients', {
  kpis: false,
  filters: () => ({ clientstore_id: shopFilter.value || undefined, role_id: roleFilter.value || undefined }),
  onError: (error) => alerts.fail(error),
});

const headers = ref<Header[]>([
  { title: 'ID', align: 'start', key: 'id' },
  { title: 'NAME', align: 'start', key: 'full_name' },
  { title: 'EMAIL', align: 'start', key: 'email' },
  { title: 'PHONE', align: 'start', key: 'phone' },
  { title: 'ROLE', align: 'start', key: 'role' },
  { title: 'SHOP', align: 'start', key: 'clientstore' },
  { title: 'COUNTER', align: 'start', key: 'counter' },
  { title: 'ACTIVE', align: 'start', key: 'is_active' },
  { title: 'ACTIONS', key: 'actions', sortable: false },
]);

const shopOptions = computed(() => [
  ...(authStore.isStoreBound ? [] : [{ id: 0, store_name: 'Both shops' }]),
  ...lookups.shops.value,
]);

const drawer = ref(false);
const drawerRef = ref<any>(null);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<any>({});
const imageFile = ref<File | null>(null);
const deleteOpen = ref(false);
const deleteId = ref<number | null>(null);
const shopCounters = ref<any[]>([]);

const roleNotes: Record<string, string> = {
  'Manager': 'Sees everything in their shop: selling, counters, bought prices, items and users.',
  'Cashier': 'Opens a counter, makes bills and quotations, gives discounts, adds items from other shopkeepers, and closes the counter.',
  'Product Entry': 'Adds and edits products, sizes, categories and brands.',
};

const selectedRoleNote = computed(() => {
  const role = lookups.roles.value.find((item: any) => item.id === form.value.role_id);
  return role ? roleNotes[role.name] || `${role.permission_count} permissions ticked for this role.` : '';
});

function isLocked(item: any) {
  return item.client_type === 'Owner' || item.id === authStore.client?.id;
}

function openForm(item: any = null) {
  editingId.value = item?.id || null;
  form.value = {
    full_name: item?.full_name || '',
    email: item?.email || '',
    phone: item?.phone || '',
    password: '',
    role_id: item?.role_id || null,
    clientstore_id: item ? item.clientstore_id || 0 : authStore.clientstoreId || 0,
    counter_id: item?.counter_id || null,
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
    const { password, ...fields } = form.value;
    const payload: Record<string, any> = {
      ...fields,
      ...(password ? { password } : {}),
      full_name: fields.full_name.trim(),
      email: fields.email.trim(),
      phone: fields.phone.trim(),
      clientstore_id: fields.clientstore_id || null,
      counter_id: fields.clientstore_id ? fields.counter_id || null : null,
    };
    const image = await uploadImage('client', imageFile.value);
    if (image) payload.image_url = image;
    if (editingId.value) {
      await axios.put(`clients/${editingId.value}`, payload);
      alerts.success('User has been updated!');
    } else {
      await axios.post('clients', payload);
      alerts.success('User has been created!');
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
    const response = await axios.delete(`clients/${deleteId.value}`);
    alerts.success(response.data?.message || 'User has been deleted!');
    list.refresh();
  } catch (error) {
    alerts.fail(error);
  }
}

watch(() => form.value.clientstore_id, async (shopId) => {
  shopCounters.value = [];
  if (!shopId) return;
  try {
    shopCounters.value = (await axios.get('counters/list', { params: { clientstore_id: shopId } })).data;
    if (form.value.counter_id && !shopCounters.value.some((counter) => counter.id === form.value.counter_id)) form.value.counter_id = null;
  } catch (error) {
    drawerAlerts.fail(error);
  }
});

onMounted(async () => {
  try {
    await Promise.all([lookups.loadShops(), lookups.loadRoles()]);
  } catch (error) {
    alerts.fail(error);
  }
});
</script>

<template>
  <v-row>
    <v-col cols="12">
      <UiParentCard>
        <ListToolbar :total="list.totalItems.value" label="Total Users" search-placeholder="Search name, email, phone..."
          add-label="Add New User" :can-add="can('users_create', 'Users')" @search="list.onSearch" @add="openForm()">
          <template #filters>
            <div v-if="!authStore.isStoreBound">
              <v-select v-model="shopFilter" :items="lookups.shops.value" item-title="store_name" item-value="id" placeholder="All shops" clearable hide-details @update:model-value="list.reload()" />
            </div>
            <div>
              <v-select v-model="roleFilter" :items="lookups.roles.value" item-title="name" item-value="id" placeholder="All roles" clearable hide-details @update:model-value="list.reload()" />
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
          <template v-slot:item.full_name="{ item }">
            <div class="d-flex align-center">
              <v-avatar size="30" color="lightprimary">
                <v-img v-if="item.image_url" :src="item.image_url" cover />
                <span v-else class="text-caption font-weight-bold text-primary">{{ item.full_name?.charAt(0) }}</span>
              </v-avatar>
              <div class="ml-3">
                <span class="text-subtitle-2">{{ item.full_name }}</span>
                <v-chip v-if="item.client_type === 'Owner'" size="x-small" class="ml-2" variant="tonal" color="primary">Owner</v-chip>
                <v-chip v-if="item.id === authStore.client?.id" size="x-small" class="ml-1" variant="tonal">You</v-chip>
              </div>
            </div>
          </template>
          <template v-slot:item.role="{ item }"><span class="font-weight-bold">{{ item.role?.name || '-' }}</span></template>
          <template v-slot:item.clientstore="{ item }">{{ item.clientstore?.store_name || 'Both shops' }}</template>
          <template v-slot:item.counter="{ item }">{{ item.counter?.name || (item.clientstore ? 'Any counter' : '-') }}</template>
          <template v-slot:item.is_active="{ item }"><ActiveIcon :active="item.is_active" /></template>
          <template v-slot:item.actions="{ item }">
            <div v-if="!isLocked(item)" class="d-flex">
              <v-btn v-if="$can('users_edit', 'Users')" icon="mdi-pencil-outline" color="#EFF0F1" size="small" class="me-2" @click="openForm(item)"></v-btn>
              <v-btn v-if="$can('users_delete', 'Users')" icon="mdi-delete-outline" color="#FFEFEF" size="small" class="text-error" @click="openDelete(item)"></v-btn>
            </div>
          </template>
          <template v-slot:no-data><p class="px-2 py-2">No users found</p></template>
          <template v-slot:bottom>
            <TableBottom v-model:page="list.currentPage.value" :page-count="list.pageCount.value" v-model:per-page="list.itemsPerPageInput.value" :total="list.totalItems.value" />
          </template>
        </v-data-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <RightDrawer ref="drawerRef" v-model="drawer" :title="editingId ? 'Edit User' : 'Add New User'" icon="mdi-account-key-outline"
    subtitle="A user linked to one shop only sees that shop" :submit-label="editingId ? 'Update User' : 'Create User'" max-width="600" :loading="saving"
    :show-error-alert="drawerAlerts.showErrorAlert.value" :error-text="drawerAlerts.errorText.value"
    @submit="save" @close-error="drawerAlerts.clear()">
    <v-row>
      <v-col cols="12" sm="6" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Full Name</v-label>
        <v-text-field v-model="form.full_name" :rules="[rules.required]" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6" class="pt-sm-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Phone</v-label>
        <v-text-field v-model="form.phone" :rules="[rules.required]" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Email (login)</v-label>
        <v-text-field v-model="form.email" type="email" :rules="[rules.required, rules.email]" autocomplete="off" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">{{ editingId ? 'New Password (optional)' : 'Password' }}</v-label>
        <v-text-field v-model="form.password" type="password" autocomplete="new-password"
          :rules="editingId ? [rules.minLength(6)] : [rules.required, rules.minLength(6)]" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Role</v-label>
        <v-select v-model="form.role_id" :items="lookups.roles.value" item-title="name" item-value="id" :rules="[rules.requiredSelect]" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Shop</v-label>
        <v-select v-model="form.clientstore_id" :items="shopOptions" item-title="store_name" item-value="id" :disabled="authStore.isStoreBound" hide-details />
      </v-col>
      <v-col v-if="form.clientstore_id" cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Counter</v-label>
        <v-select v-model="form.counter_id" :items="shopCounters" item-title="name" item-value="id" clearable placeholder="Any counter" hide-details />
      </v-col>
      <v-col v-if="form.clientstore_id" cols="12" sm="6" class="d-flex align-end">
        <p class="text-caption text-lightText mb-2">A user with a counter can only open that counter, and without "See All Counters' Bills & Quotations" only sees that counter's bills and quotations.</p>
      </v-col>
      <v-col v-if="selectedRoleNote" cols="12" class="py-0">
        <v-alert type="info" variant="tonal" density="compact" icon="mdi-shield-account-outline">{{ selectedRoleNote }}</v-alert>
      </v-col>
      <v-col cols="12">
        <ImageField v-model="imageFile" :existing-url="form.image_url" label="Photo" />
      </v-col>
      <v-col cols="12" class="pb-0 d-flex align-center justify-space-between">
        <p class="text-subtitle-1 font-weight-bold" :class="{ 'text-primary': form.is_active }">Active?</p>
        <v-switch color="primary" v-model="form.is_active" hide-details></v-switch>
      </v-col>
    </v-row>
  </RightDrawer>

  <DeleteDialog v-model="deleteOpen" message="Are you sure you want to delete this user?" hint="Users with counter history are made inactive instead." @confirm="remove" />
</template>
