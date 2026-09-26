<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import ListToolbar from '@/components/shared/ListToolbar.vue';
import TableBottom from '@/components/shared/TableBottom.vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import DeleteDialog from '@/components/shared/DeleteDialog.vue';
import DashboardStatCard from '@/components/shared/DashboardStatCard.vue';
import ImageField from '@/components/shared/ImageField.vue';
import { useListPage } from '@/composables/useListPage';
import { useAlerts } from '@/composables/useAlerts';
import { can } from '@/utils/permissions';
import { formatDate, formatMoney, uploadImage } from '@/utils/api';
import type { Header } from '@/models/type-interfaces';

const router = useRouter();
const alerts = useAlerts();
const drawerAlerts = useAlerts();
const balance = ref<string | null>(null);

const list = useListPage('debtors', {
  filters: () => ({ balance: balance.value || undefined }),
  onError: (error) => alerts.fail(error),
});

const headers = ref<Header[]>([
  { title: 'ID', align: 'start', key: 'id' },
  { title: 'NAME', align: 'start', key: 'name' },
  { title: 'PHONE', align: 'start', key: 'phone' },
  { title: 'BILLS', align: 'start', key: 'bills' },
  { title: 'PAID', align: 'start', key: 'paid' },
  { title: 'BALANCE', align: 'start', key: 'balance' },
  { title: 'LAST PAYMENT', align: 'start', key: 'last_payment' },
  { title: 'ACTIONS', key: 'actions', sortable: false },
]);

const drawer = ref(false);
const drawerRef = ref<any>(null);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<any>({});
const deleteOpen = ref(false);
const deleteId = ref<number | null>(null);
const imageFile = ref<File | null>(null);

function openForm(item: any = null) {
  editingId.value = item?.id || null;
  form.value = {
    name: item?.name || '',
    phone: item?.phone || '',
    address: item?.address || '',
    opening_balance: item?.opening_balance ?? 0,
    note: item?.note || '',
    image_url: item?.image_url || '',
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
    const image = await uploadImage('debtor', imageFile.value);
    const payload = {
      image_url: image || form.value.image_url || '',
      name: form.value.name.trim(),
      phone: form.value.phone?.trim() || '',
      address: form.value.address?.trim() || '',
      opening_balance: Number(form.value.opening_balance) || 0,
      note: form.value.note?.trim() || '',
    };
    if (editingId.value) {
      await axios.put(`debtors/${editingId.value}`, payload);
      alerts.success('Debtor has been updated!');
    } else {
      await axios.post('debtors', payload);
      alerts.success('Debtor has been added!');
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
    await axios.delete(`debtors/${deleteId.value}`);
    alerts.success('Debtor has been deleted!');
    list.refresh();
  } catch (error) {
    alerts.fail(error);
  }
}
</script>

<template>
  <v-row>
    <v-col cols="12" sm="6" lg="3">
      <DashboardStatCard title="Debtors" :value="list.kpis.value.debtors ?? 0" icon="mdi-account-cash-outline" comparison-label="On khata" />
    </v-col>
    <v-col cols="12" sm="6" lg="3">
      <DashboardStatCard title="Owing Now" :value="list.kpis.value.owing ?? 0" icon="mdi-account-alert-outline" comparison-label="Have a balance left" />
    </v-col>
    <v-col cols="12" sm="6" lg="3">
      <DashboardStatCard title="Total Owed" :value="formatMoney(list.kpis.value.totalOwed ?? 0)" icon="mdi-cash-clock" comparison-label="Money still with customers" :show-info-icon="(list.kpis.value.totalOwed ?? 0) > 0" />
    </v-col>
    <v-col cols="12" sm="6" lg="3">
      <DashboardStatCard title="Received" :value="formatMoney(list.kpis.value.totalPaid ?? 0)" icon="mdi-cash-check" comparison-label="Paid against khata" />
    </v-col>

    <v-col cols="12">
      <UiParentCard>
        <ListToolbar :total="list.totalItems.value" label="Total Debtors" search-placeholder="Search by name or phone..."
          add-label="Add New Debtor" :can-add="can('debtors_create', 'Debtors')" @search="list.onSearch" @add="openForm()">
          <template #filters>
            <div>
              <v-select v-model="balance" :items="['Owing', 'Clear']" placeholder="All balances" clearable hide-details @update:model-value="list.reload()" />
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
              <v-avatar size="40" class="border bg-white">
                <v-img v-if="item.image_url" :src="item.image_url" cover />
                <span v-else class="text-caption font-weight-bold">{{ item.name?.charAt(0) }}</span>
              </v-avatar>
              <div class="ml-3">
                <div class="text-subtitle-2">{{ item.name }}</div>
                <div v-if="item.address" class="text-caption text-lightText">{{ item.address }}</div>
              </div>
            </div>
          </template>
          <template v-slot:item.phone="{ item }">{{ item.phone || '-' }}</template>
          <template v-slot:item.paid="{ item }">{{ formatMoney(item.paid) }}</template>
          <template v-slot:item.balance="{ item }">
            <span class="font-weight-bold" :class="item.balance > 0 ? 'text-error' : 'text-success'">{{ formatMoney(item.balance) }}</span>
          </template>
          <template v-slot:item.last_payment="{ item }">{{ item.last_payment ? formatDate(item.last_payment) : '-' }}</template>
          <template v-slot:item.actions="{ item }">
            <v-btn icon="mdi-eye-outline" color="#EFF0F1" size="small" class="me-2" title="Open khata" @click="router.push(`/debtors/${item.id}`)"></v-btn>
            <v-btn v-if="$can('debtors_edit', 'Debtors')" icon="mdi-pencil-outline" color="#EFF0F1" size="small" class="me-2" @click="openForm(item)"></v-btn>
            <v-btn v-if="$can('debtors_delete', 'Debtors')" icon="mdi-delete-outline" color="#FFEFEF" size="small" class="text-error" @click="openDelete(item)"></v-btn>
          </template>
          <template v-slot:no-data><p class="px-2 py-2">No debtors found</p></template>
          <template v-slot:bottom>
            <TableBottom v-model:page="list.currentPage.value" :page-count="list.pageCount.value" v-model:per-page="list.itemsPerPageInput.value" :total="list.totalItems.value" />
          </template>
        </v-data-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <RightDrawer ref="drawerRef" v-model="drawer" :title="editingId ? 'Edit Debtor' : 'Add New Debtor'" icon="mdi-account-cash-outline"
    :submit-label="editingId ? 'Update Debtor' : 'Add Debtor'" :loading="saving"
    :show-error-alert="drawerAlerts.showErrorAlert.value" :error-text="drawerAlerts.errorText.value"
    @submit="save" @close-error="drawerAlerts.clear()">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Name</v-label>
        <v-text-field v-model="form.name" :rules="[(v: string) => !!v?.trim() || 'Name is required']" placeholder="e.g. Hikmat Electric Works" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Phone</v-label>
        <v-text-field v-model="form.phone" placeholder="e.g. 0300-1234567" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Opening Balance</v-label>
        <v-text-field v-model="form.opening_balance" type="number" min="0" :disabled="!!editingId && !$can('debtors_edit', 'Debtors')" hide-details="auto" />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Address</v-label>
        <v-text-field v-model="form.address" hide-details="auto" />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Note</v-label>
        <v-textarea v-model="form.note" rows="2" auto-grow hide-details />
      </v-col>
      <v-col cols="12">
        <ImageField v-model="imageFile" :existing-url="form.image_url" label="Photo" />
      </v-col>
    </v-row>
  </RightDrawer>

  <DeleteDialog v-model="deleteOpen" message="Are you sure you want to delete this debtor?" hint="A debtor with bills or payments cannot be deleted." @confirm="remove" />
</template>
