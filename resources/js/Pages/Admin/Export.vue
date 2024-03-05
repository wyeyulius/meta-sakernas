<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, router } from '@inertiajs/vue3';
import { ref, defineProps, reactive  } from 'vue';
import Toastify from 'toastify-js'

// Use `ref` for reactive data
const refKabupaten = ref(null);
const refKecamatan = ref(null);
const kecamatans = ref([]);
const refDesa = ref(null);
const desas = ref([]);
const refBlok = ref(null);
const bloks = ref([]);

const form = reactive({
  kabupaten: null,
  kecamatan: null,
  desa: null,
  blok:null
})

defineProps({
    kabupatens: Object,
    user_kab: String,
})


const loadKecamatans = async () => {
    try {
        const response = await axios.get(`/kecamatan/` + refKabupaten.value.value);

        kecamatans.value = response.data.kecamatan;

    } catch (error) {
        console.error('Error fetching kecamatan:', error);
    }
};

const loadDesas = async () => {
    try {
        form.desa = null;
        form.blok = null;
        const response = await axios.get(`/desa/` + refKabupaten.value.value + `/` + refKecamatan.value.value);

        desas.value = response.data.desa;

    } catch (error) {
        console.error('Error fetching desa:', error);
    }
};

const loadBloks = async () => {
    try {
        form.blok = null;
        const response = await axios.get(`/blok/` + refKabupaten.value.value + `/` + refKecamatan.value.value + `/` + refDesa.value.value);

        bloks.value = response.data.blok;
    } catch (error) {
        console.error('Error fetching blok sensus:', error);
    }
};

function submit() {
  axios.post(route('admin.export.download'), form, {
    responseType: 'arraybuffer',
  })
  .then((response) => {
    if (response.status === 200) {
      const blob = new Blob([response.data], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'export.csv';
      link.click();
    } else if (response.status === 204) {
      // Handle the case when there is no data to export
      console.log({response})
      Toastify({
        text: "Data tidak ditemukan",
        duration: 3000,
        style: {
            background: "#e60b0b",
        },
        }).showToast();
    }
  })
  .catch((error) => {
    console.error('Error exporting data:', error);
  });
}
</script>

<template>

    <Head title="Dashboard" />

    <AdminLayout>
        <div class="py-5">
            <div class="max-w-full mx-auto sm:px-6 lg:px-8">
                <h2 class="text-lg">Export Data</h2>
                <div class="bg-white w-full overflow-hidden shadow-sm rounded-lg">
                    <div class="p-2 bg-white border-b border-gray-200 overflow-x-auto ">
                        <form @submit.prevent="submit">
                            <div class="sm:col-span-3 px-3 py-2">
                                <label for="kabupaten"
                                    class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">KABUPATEN</label>
                                <select v-model="form.kabupaten" ref="refKabupaten" name="kabupaten" @change="loadKecamatans"
                                    class="form-control sm:col-span-3 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg w-full   focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                    id="kabupatens">
                                    <option v-for="kabupaten in kabupatens" :value="kabupaten.id" :key="kabupaten.id">{{
                            kabupaten.nama }}</option>
                                </select>
                            </div>
                            <div class="sm:col-span-3 px-3 py-2">
                                <label for="kecamatan"
                                    class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">KECAMATAN</label>
                                <select v-model="form.kecamatan" ref="refKecamatan" name="kecamatan" :disabled="!form.kabupaten" @change="loadDesas"
                                    class="form-control sm:col-span-3 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg w-full focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                    id="kecamatans">
                                    <option v-for="kecamatan in kecamatans" :value="kecamatan.id" :key="kecamatan.id">{{
                            kecamatan.nama }}</option>
                                </select>
                            </div>
                            <div class="sm:col-span-3 px-3 py-2">
                                <label for="desa"
                                    class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">DESA</label>
                                <select v-model="form.desa" ref="refDesa" name="desa" :disabled="!form.kecamatan" @change="loadBloks"
                                    class="form-control sm:col-span-3 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg w-full  focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                    id="desas">
                                    <option v-for="desa in desas" :value="desa.id" :key="desa.id">{{ desa.nama }}
                                    </option>
                                </select>
                            </div>
                            <div class="sm:col-span-3 px-3 py-2 order-4 sm:order-4">
                                <label for="bloks"
                                    class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">NBS /
                                    NKS</label>
                                <select v-model="form.blok" ref="refBlok" name="blok" :disabled="!form.desa"
                                    class="form-control sm:col-span-3 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg w-full focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                    id="bloks">
                                    <option v-for="blok in bloks" :value="blok.id" :key="blok.id">{{ blok.nama }}
                                    </option>
                                </select>
                            </div>
                            <div class="sm:col-span-3 px-3 py-2 order-5 sm:order-5">
                                <button type="submit" :disabled="!form.kabupaten && user_kab != '00'"
                                    class="disabled:bg-gray-200 min-w-15 text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 inline-flex items-center">Export</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </AdminLayout>
</template>