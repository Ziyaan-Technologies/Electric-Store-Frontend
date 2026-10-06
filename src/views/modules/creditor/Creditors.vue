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
import { useAuthStore } from '@/stores/auth';
import { can } from '@/utils/permissions';
import { formatDate, formatMoney, uploadImage } from '@/utils/api';
import type { Header } from '@/models/type-interfaces';

const router = useRouter();
const authStore = useAuthStore();
const alerts = useAlerts();
const drawerAlerts = useAlerts();
const balance = ref<string | null>(null);

const list = useListPage('creditors', {
  storeScoped: true,
  filters: () => ({ balance: balance.value || undefined }),
  onError: (error) => alerts.fail(error),
});

const headers = ref<Header[]>([
  { title: 'ID', align: 'start', key: 'id' },
  { title: 'NAME', align: 'start', key: 'name' },
  { title: 'PHONE', align: 'start', key: 'phone' },
  { title: 'TAKEN', align: 'start', key: 'taken' },
  { title: 'PAID', align: 'start', key: 'paid' },
  { title: 'INCENTIVE', align: 'start', key: 'incentive' },
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
    incentive: item?.incentive ?? 0,
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
    const image = await uploadImage('creditor', imageFile.value);
    const payload = {
      clientstore_id: authStore.clientstoreId,
      image_url: image || form.value.image_url || '',
      name: form.value.name.trim(),
      phone: form.value.phone?.trim() || '',
      address: form.value.address?.trim() || '',
      opening_balance: Number(form.value.opening_balance) || 0,
      incentive: Number(form.value.incentive) || 0,
      note: form.value.note?.trim() || '',
    };
    if (editingId.value) {
      await axios.put(`creditors/${editingId.value}`, payload);
      alerts.success('Creditor has been updated!');
    } else {
      await axios.post('creditors', payload);
      alerts.success('Creditor has been added!');
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
    await axios.delete(`creditors/${deleteId.value}`);
    alerts.success('Creditor has been deleted!');
    list.refresh();
  } catch (error) {
    alerts.fail(error);
  }
}
</script>

<template>
  <v-row>
    <v-col cols="12" sm="6" lg="4">
      <DashboardStatCard title="Creditors" :value="list.kpis.value.creditors ?? 0" icon="mdi-account-arrow-left-outline" comparison-label="Shopkeepers on khata" />
    </v-col>
    <v-col cols="12" sm="6" lg="4">
      <DashboardStatCard title="We Owe" :value="formatMoney(list.kpis.value.totalOwed ?? 0)" icon="mdi-cash-clock" :comparison-label="`${list.kpis.value.owing ?? 0} to be paid`" :show-info-icon="(list.kpis.value.totalOwed ?? 0) > 0" />
    </v-col>

    <v-col cols="12" sm="6" lg="4">
      <DashboardStatCard title="Incentive" :value="formatMoney(list.kpis.value.totalIncentive ?? 0)" icon="mdi-gift-outline" comparison-label="Money they give on targets" />
    </v-col>

    <v-col cols="12">
      <UiParentCard>
        <ListToolbar :total="list.totalItems.value" label="Total Creditors" search-placeholder="Search by name or phone..."
          add-label="Add New Creditor" :can-add="can('creditors_create', 'Creditors')" @search="list.onSearch" @add="openForm()">
          <template #filters>
            <div>
              <v-select v-model="balance" :items="['We owe', 'Clear', 'Advance']" placeholder="All balances" clearable hide-details @update:model-value="list.reload()" />
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
          <template v-slot:item.taken="{ item }">{{ formatMoney(item.taken) }}</template>
          <template v-slot:item.paid="{ item }">{{ formatMoney(item.paid) }}</template>
          <template v-slot:item.incentive="{ item }">
            <span v-if="item.incentive" class="font-weight-bold text-primary">{{ formatMoney(item.incentive) }}</span>
            <span v-else class="text-lightText">-</span>
          </template>
          <template v-slot:item.balance="{ item }">
            <span v-if="item.balance > 0" class="font-weight-bold text-error">{{ formatMoney(item.balance) }}</span>
            <template v-else-if="item.balance < 0">
              <span class="font-weight-bold text-success">{{ formatMoney(item.advance) }}</span>
              <div class="text-caption text-lightText">Advance</div>
            </template>
            <span v-else class="font-weight-bold text-success">{{ formatMoney(0) }}</span>
          </template>
          <template v-slot:item.last_payment="{ item }">{{ item.last_payment ? formatDate(item.last_payment) : '-' }}</template>
          <template v-slot:item.actions="{ item }">
            <v-btn icon="mdi-eye-outline" color="#EFF0F1" size="small" class="me-2" title="Open khata" @click="router.push(`/creditors/${item.id}`)"></v-btn>
            <v-btn v-if="$can('creditors_edit', 'Creditors')" icon="mdi-pencil-outline" color="#EFF0F1" size="small" class="me-2" @click="openForm(item)"></v-btn>
            <v-btn v-if="$can('creditors_delete', 'Creditors')" icon="mdi-delete-outline" color="#FFEFEF" size="small" class="text-error" @click="openDelete(item)"></v-btn>
          </template>
          <template v-slot:no-data><p class="px-2 py-2">No creditors found</p></template>
          <template v-slot:bottom>
            <TableBottom v-model:page="list.currentPage.value" :page-count="list.pageCount.value" v-model:per-page="list.itemsPerPageInput.value" :total="list.totalItems.value" />
          </template>
        </v-data-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <RightDrawer ref="drawerRef" v-model="drawer" :title="editingId ? 'Edit Creditor' : 'Add New Creditor'" icon="mdi-account-arrow-left-outline"
    :submit-label="editingId ? 'Update Creditor' : 'Add Creditor'" :loading="saving"
    :show-error-alert="drawerAlerts.showErrorAlert.value" :error-text="drawerAlerts.errorText.value"
    @submit="save" @close-error="drawerAlerts.clear()">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Name</v-label>
        <v-text-field v-model="form.name" :rules="[(v: string) => !!v?.trim() || 'Name is required']" placeholder="e.g. Karim Electric Store" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Phone</v-label>
        <v-text-field v-model="form.phone" placeholder="e.g. 0300-1234567" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Opening Balance</v-label>
        <v-text-field v-model="form.opening_balance" type="number" :disabled="!!editingId && !$can('creditors_edit', 'Creditors')" hide-details="auto" />
        <div class="text-caption text-lightText mt-1">What we already owe him. A minus number means he is holding our advance.</div>
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Incentive</v-label>
        <v-text-field v-model="form.incentive" type="number" min="0" hide-details="auto" />
        <div class="text-caption text-lightText mt-1">What he gives you when a target is hit. Not part of his balance.</div>
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

  <DeleteDialog v-model="deleteOpen" message="Are you sure you want to delete this creditor?" hint="A creditor with khata entries or payments cannot be deleted." @confirm="remove" />
</template>
