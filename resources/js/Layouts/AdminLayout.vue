<script setup>
import { ref } from "vue";
// import ApplicationLogo from "@/Components/ApplicationLogo.vue";
// import Dropdown from "@/Components/Dropdown.vue";
// import DropdownLink from "@/Components/DropdownLink.vue";
// import NavLink from "@/Components/NavLink.vue";
// import ResponsiveNavLink from "@/Components/ResponsiveNavLink.vue";
// import { Link } from "@inertiajs/vue3";
import Sidebar from "./Sidebar.vue";
import Header from "./Header.vue";

const showingNavigationDropdown = ref(false);
</script>

<template>
  <div class="flex h-screen bg-gray-200 font-roboto">
    <Sidebar />

    <div class="flex-1 flex flex-col overflow-hidden">
      <Header />

      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200">
        <div class="mx-auto px-2 py-4">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

