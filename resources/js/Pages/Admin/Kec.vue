<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, router } from '@inertiajs/vue3';

defineProps({
    data: Object
})

function open(desa) {
    const par = route().params
    router.visit(route('admin.desa', { kab : par['kab'], kec : par['kec'], desa }), {
        preserveState: true,
        preserveScroll: true,
    })
}

function back() {
    history.back();
    return false;
}
</script>

<template>
    <Head title="Dashboard" />

    <AdminLayout>
        <div class="py-1">
            <div class="max-w-full mx-auto sm:px-6 lg:px-8">
                <div class="flex justify-between ...">
                    <h2 class="text-lg">Monitoring Realisasi Entri per Desa/Kelurahan</h2>
                    <button @click="back()" type="button"
                        class="background-transparent text-blue-500 px-3 py-1 content-end text-md outline-none focus:outline-none ease-linear transition-all duration-150">
                        Kembali
                    </button>
                </div>
                <div class="bg-white w-full overflow-hidden shadow-sm rounded-lg">
                    <div class="p-6 bg-white border-b border-gray-200 overflow-x-auto ">
                        <table class="monitoring w-full text-xs text-gray-500 dark:text-gray-400">
                            <thead class="text-xs text-gray-700 uppercase bg-gray-300 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" class="px-3 py-3">
                                        No
                                    </th>
                                    <th scope="col" class="px-3 py-3">
                                        Desa/Kelurahan
                                    </th>
                                    <th scope="col" class="px-3 py-3">
                                        Target Sampel
                                    </th>
                                    <th scope="col" class="px-3 py-3">
                                        Realisasi Entri
                                    </th>
                                    <th scope="col" class="px-3 py-3">
                                        % Realisasi Entri
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="data == ''">
                                    <td colspan="5" scope="row"
                                        class="px-3 text-center py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                        Data tidak tersedia
                                    </td>
                                </tr>
                                <tr v-else v-for="(datum, index) in data" :key="datum.desa"
                                    class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                    <th scope="row"
                                        class="px-3 py-2 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                        {{ index + 1 }}
                                    </th>
                                    <td class="px-3 py-2">
                                        <button @click="open(datum.desa)" type="button"
                                            class="background-transparent px-3 py-1 text-xs outline-none focus:outline-none ease-linear transition-all duration-150">
                                            {{ "[" + datum.desa + "] " + datum.nama_desa }}
                                        </button>
                                    </td>
                                    <td class="px-3 py-2 text-center">
                                        {{ datum.jml_sampel }}
                                    </td>
                                    <td class="px-3 py-2 text-center">
                                        {{ datum.jml_entri }}
                                    </td>
                                    <td class="px-3 py-2 text-center">
                                        {{ (datum.jml_entri / datum.jml_sampel * 100).toFixed(2) + ' %' }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </AdminLayout></template>