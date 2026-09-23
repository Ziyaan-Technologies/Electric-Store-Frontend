import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/utils/permissions';

export const usePendingStore = defineStore('pending', () => {
    const authStore = useAuthStore();
    const count = ref(0);
    const mine = ref(0);

    async function refresh() {
        if (!authStore.clientstoreId || !can('pending_costs_view', 'Pending Cost')) {
            count.value = 0;
            mine.value = 0;
            return;
        }
        try {
            const response = await axios.get('pending-costs/count', { params: { clientstore_id: authStore.clientstoreId } });
            count.value = response.data.count;
            mine.value = response.data.mine;
        } catch (error) {
            console.error('Failed to load pending costs', error);
        }
    }

    return { count, mine, refresh };
});
