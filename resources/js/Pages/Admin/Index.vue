<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head } from '@inertiajs/vue3';

defineProps({
    data: Object
})

</script>

<template>
    <Head title="Dashboard" />

    <AdminLayout>
        <template #header>
            <h2 class="font-semibold text-xl text-gray-800 leading-tight">
                Users
            </h2>
        </template>

        <div class="py-5">
            <div class="max-w-full mx-auto sm:px-6 lg:px-8">
                <div class="bg-white w-full overflow-hidden shadow-sm rounded-lg">
                    <div class="p-6 bg-white border-b border-gray-200 overflow-x-auto ">
                        <table class="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
                            <thead class="text-xs text-gray-700 uppercase bg-gray-300 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" class="px-6 py-3">
                                        Kode kabupaten
                                    </th>
                                    <th scope="col" class="px-6 py-3">
                                        Nama Kabupaten
                                    </th>
                                    <th scope="col" class="px-6 py-3">
                                        Jumlah Entri
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="data == ''">
                                    <td colspan="5" scope="row"
                                        class="px-6 text-center py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                        Data tidak tersedia
                                    </td>
                                </tr>
                                <tr v-else v-for="datum in data" :key="datum.kabupaten"
                                    class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                    <th scope="row"
                                        class="px-6 py-1 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                        {{ datum.kabupaten }}
                                    </th>
                                    <td class="px-6 py-1">
                                        {{ datum.nama_kabupaten }}
                                    </td>
                                    <td class="px-6 py-1">
                                        {{ datum.jml_entri }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </AdminLayout>
</template>