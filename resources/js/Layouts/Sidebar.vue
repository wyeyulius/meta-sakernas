<script setup>
import { ref } from "vue";
import { useSidebar } from "../hooks/useSidebar";
import { showMenu } from "../hooks/useSidebar";

import ApplicationLogo from "@/Components/ApplicationLogo.vue";
import Dropdown from "@/Components/Dropdown.vue";
import DropdownLink from "@/Components/DropdownLink.vue";
import NavLink from "@/Components/NavLink.vue";
import ResponsiveNavLink from "@/Components/ResponsiveNavLink.vue";
import { Link } from "@inertiajs/vue3";


const { isOpen } = useSidebar();

const activeClass = ref(
  "bg-gray-600 bg-opacity-25 text-gray-100 border-gray-100"
);
const inactiveClass = ref(
  "border-gray-800 text-gray-400 hover:bg-gray-600 hover:bg-opacity-25 hover:text-gray-100"
);

const activeClassChild = ref(
  "bg-gray-600 bg-opacity-25 text-gray-100 border-gray-100"
);

const activeClassSubmenu = ref(
  "bg-gray-980 bg-opacity-25 text-gray-100 border-gray-800"
);

const activeClassIcon = ref(
  "rotate-180 transition ease-in-out"
);

const inactiveClassIcon = ref(
  "rotate-0 transition ease-in-out"
);

const inactiveClassChild = ref(
  "border-gray-900 text-gray-500 hover:bg-gray-600 hover:bg-opacity-25 hover:text-gray-100"
);

const { showingTwoLevelMenu } = showMenu();

</script>

<template>
  <div class="flex">
    <!-- Backdrop -->
    <div :class="isOpen ? 'block' : 'hidden'" @click="isOpen = false"
      class="fixed inset-0 z-20 transition-opacity bg-black opacity-50 lg:hidden"></div>
    <!-- End Backdrop -->

    <div :class="isOpen ? 'translate-x-0 ease-out' : '-translate-x-full ease-in'"
      class="fixed inset-y-0 left-0 z-30 w-64 overflow-y-auto transition duration-300 transform bg-gray-800 lg:translate-x-0 lg:static lg:inset-0">
      <div class="flex items-center justify-center mt-8">
        <div class="flex items-center">
          <svg class="w-12 h-12" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g>
                <path d="M165.25,499.13l-.1-48.39-23.99,40.05h-6.05l-23.99-39.42v47.77h-12.93v-73h11.16l28.99,48.39,28.47-48.39h11.16l.1,73h-12.83Z" fill="#787878" stroke-width="0"/>
                <path d="M273.4,487.76v11.37h-54.75v-73h53.29v11.37h-39.74v18.98h35.25v11.16h-35.25v20.13h41.2Z" fill="#787878" stroke-width="0"/>
                <path d="M324.19,437.59h-24.2v-11.47h61.95v11.47h-24.2v61.53h-13.56v-61.53Z" fill="#787878" stroke-width="0"/>
                <path d="M436.72,482.23h-36.5l-7.2,16.9h-13.97l32.85-73h13.35l32.96,73h-14.18l-7.3-16.9ZM432.24,471.59l-13.77-31.91-13.66,31.91h27.43Z" fill="#787878" stroke-width="0"/>
            </g>
            <g>
                <path d="M81.83,532.11c2.11,1.78,3.17,4.23,3.17,7.34s-1.06,5.56-3.17,7.32c-2.11,1.77-5.03,2.65-8.76,2.65h-7.84v9.22h-3.09v-29.2h10.93c3.73,0,6.65.89,8.76,2.67ZM79.62,544.81c1.53-1.26,2.29-3.05,2.29-5.36s-.77-4.18-2.29-5.44c-1.53-1.26-3.74-1.9-6.63-1.9h-7.76v14.6h7.76c2.89,0,5.1-.63,6.63-1.9Z" fill="#787878" stroke-width="0"/>
                <path d="M114.2,548.59h-18.36c.17,2.28,1.04,4.12,2.63,5.53,1.58,1.41,3.59,2.11,6.01,2.11,1.36,0,2.61-.24,3.75-.73s2.13-1.2,2.96-2.15l1.67,1.92c-.97,1.17-2.19,2.06-3.65,2.67-1.46.61-3.07.92-4.82.92-2.25,0-4.25-.48-5.99-1.44-1.74-.96-3.09-2.29-4.07-3.98-.97-1.7-1.46-3.61-1.46-5.76s.47-4.06,1.4-5.76c.93-1.7,2.21-3.02,3.84-3.96s3.46-1.42,5.49-1.42,3.85.47,5.46,1.42c1.61.95,2.88,2.26,3.8,3.94s1.38,3.61,1.38,5.78l-.04.92ZM98.29,541.1c-1.43,1.35-2.25,3.11-2.44,5.28h15.56c-.2-2.17-1.01-3.93-2.44-5.28-1.43-1.35-3.22-2.02-5.36-2.02s-3.89.67-5.32,2.02Z" fill="#787878" stroke-width="0"/>
                <path d="M158.32,538.91c1.57,1.58,2.36,3.92,2.36,7.01v12.72h-2.96v-12.43c0-2.28-.55-4.02-1.65-5.21-1.1-1.2-2.65-1.79-4.65-1.79-2.28,0-4.08.7-5.38,2.11-1.31,1.4-1.96,3.34-1.96,5.82v11.51h-2.96v-12.43c0-2.28-.55-4.02-1.65-5.21-1.1-1.2-2.66-1.79-4.69-1.79-2.25,0-4.04.7-5.36,2.11-1.32,1.4-1.98,3.34-1.98,5.82v11.51h-2.96v-21.94h2.84v4c.78-1.33,1.86-2.36,3.25-3.09,1.39-.72,2.99-1.08,4.8-1.08s3.43.39,4.78,1.17c1.35.78,2.36,1.93,3.02,3.46.81-1.45,1.97-2.58,3.48-3.4,1.51-.82,3.25-1.23,5.19-1.23,2.75,0,4.92.79,6.49,2.38Z" fill="#787878" stroke-width="0"/>
                <path d="M192.09,548.59h-18.36c.17,2.28,1.04,4.12,2.63,5.53,1.58,1.41,3.59,2.11,6.01,2.11,1.36,0,2.61-.24,3.75-.73s2.13-1.2,2.96-2.15l1.67,1.92c-.97,1.17-2.19,2.06-3.65,2.67-1.46.61-3.07.92-4.82.92-2.25,0-4.25-.48-5.99-1.44-1.74-.96-3.09-2.29-4.07-3.98-.97-1.7-1.46-3.61-1.46-5.76s.47-4.06,1.4-5.76c.93-1.7,2.21-3.02,3.84-3.96s3.46-1.42,5.49-1.42,3.85.47,5.46,1.42c1.61.95,2.88,2.26,3.8,3.94s1.38,3.61,1.38,5.78l-.04.92ZM176.17,541.1c-1.43,1.35-2.25,3.11-2.44,5.28h15.56c-.2-2.17-1.01-3.93-2.44-5.28-1.43-1.35-3.22-2.02-5.36-2.02s-3.89.67-5.32,2.02Z" fill="#787878" stroke-width="0"/>
                <path d="M208.29,537.66c1.38-.75,3.08-1.13,5.11-1.13v2.88l-.71-.04c-2.31,0-4.12.71-5.42,2.13-1.31,1.42-1.96,3.41-1.96,5.97v11.18h-2.96v-21.94h2.84v4.3c.69-1.47,1.73-2.59,3.11-3.34Z" fill="#787878" stroke-width="0"/>
                <path d="M222.87,531.27c-.42-.42-.62-.92-.62-1.5s.21-1.04.62-1.46c.42-.42.93-.63,1.54-.63s1.13.2,1.54.61c.42.4.63.88.63,1.44,0,.61-.21,1.13-.63,1.54-.42.42-.93.63-1.54.63s-1.13-.21-1.54-.63ZM222.91,536.7h2.96v21.94h-2.96v-21.94Z" fill="#787878" stroke-width="0"/>
                <path d="M246.44,547.63l-5.17,4.75v6.26h-2.96v-30.95h2.96v20.98l13.1-11.97h3.67l-9.39,8.97,10.26,12.97h-3.63l-8.84-11.01Z" fill="#787878" stroke-width="0"/>
                <path d="M267.66,558.08c-1.63-.51-2.9-1.16-3.82-1.94l1.33-2.34c.92.72,2.07,1.31,3.46,1.77s2.84.69,4.34.69c2,0,3.48-.31,4.44-.94.96-.63,1.44-1.51,1.44-2.65,0-.81-.26-1.44-.79-1.9s-1.2-.81-2-1.04-1.88-.47-3.21-.69c-1.78-.33-3.21-.67-4.3-1.02-1.08-.35-2.01-.94-2.77-1.77-.77-.83-1.15-1.99-1.15-3.46,0-1.83.76-3.34,2.29-4.5,1.53-1.17,3.66-1.75,6.38-1.75,1.42,0,2.84.19,4.25.56,1.42.38,2.59.87,3.5,1.48l-1.29,2.38c-1.81-1.25-3.96-1.88-6.47-1.88-1.89,0-3.32.33-4.28,1-.96.67-1.44,1.54-1.44,2.63,0,.83.27,1.5.81,2,.54.5,1.22.87,2.02,1.11.81.24,1.92.48,3.34.73,1.75.33,3.16.67,4.21,1,1.06.33,1.96.9,2.71,1.71s1.13,1.92,1.13,3.34c0,1.92-.8,3.44-2.4,4.57-1.6,1.13-3.82,1.69-6.65,1.69-1.78,0-3.48-.26-5.11-.77Z" fill="#787878" stroke-width="0"/>
                <path d="M305.72,538.68c1.53,1.43,2.29,3.55,2.29,6.36v13.6h-2.84v-3.42c-.67,1.14-1.65,2.03-2.94,2.67-1.29.64-2.83.96-4.61.96-2.45,0-4.39-.58-5.84-1.75-1.45-1.17-2.17-2.71-2.17-4.63s.67-3.37,2.02-4.51c1.35-1.14,3.5-1.71,6.45-1.71h6.97v-1.33c0-1.89-.53-3.33-1.58-4.32-1.06-.99-2.6-1.48-4.63-1.48-1.39,0-2.73.23-4,.69s-2.38,1.09-3.3,1.9l-1.33-2.21c1.11-.95,2.45-1.68,4-2.19s3.2-.77,4.92-.77c2.86,0,5.06.72,6.59,2.15ZM302.38,555.37c1.2-.76,2.09-1.87,2.67-3.32v-3.59h-6.88c-3.75,0-5.63,1.31-5.63,3.92,0,1.28.49,2.29,1.46,3.02.97.74,2.34,1.11,4.09,1.11s3.1-.38,4.3-1.15Z" fill="#787878" stroke-width="0"/>
                <path d="M334.51,538.68c1.53,1.43,2.29,3.55,2.29,6.36v13.6h-2.84v-3.42c-.67,1.14-1.65,2.03-2.94,2.67-1.29.64-2.83.96-4.61.96-2.45,0-4.39-.58-5.84-1.75-1.45-1.17-2.17-2.71-2.17-4.63s.67-3.37,2.02-4.51c1.35-1.14,3.5-1.71,6.45-1.71h6.97v-1.33c0-1.89-.53-3.33-1.58-4.32-1.06-.99-2.6-1.48-4.63-1.48-1.39,0-2.73.23-4,.69s-2.38,1.09-3.3,1.9l-1.33-2.21c1.11-.95,2.45-1.68,4-2.19s3.2-.77,4.92-.77c2.86,0,5.06.72,6.59,2.15ZM331.17,555.37c1.2-.76,2.09-1.87,2.67-3.32v-3.59h-6.88c-3.75,0-5.63,1.31-5.63,3.92,0,1.28.49,2.29,1.46,3.02.97.74,2.34,1.11,4.09,1.11s3.1-.38,4.3-1.15Z" fill="#787878" stroke-width="0"/>
                <path d="M366.77,538.93c1.63,1.6,2.44,3.93,2.44,6.99v12.72h-2.96v-12.43c0-2.28-.57-4.02-1.71-5.21-1.14-1.2-2.77-1.79-4.88-1.79-2.36,0-4.23.7-5.61,2.11-1.38,1.4-2.07,3.34-2.07,5.82v11.51h-2.96v-21.94h2.84v4.05c.81-1.33,1.93-2.37,3.36-3.11,1.43-.74,3.09-1.11,4.98-1.11,2.75,0,4.94.8,6.57,2.4Z" fill="#787878" stroke-width="0"/>
                <path d="M397.16,529.44h11.89c3.09,0,5.81.62,8.18,1.86,2.36,1.24,4.2,2.96,5.51,5.17,1.31,2.21,1.96,4.73,1.96,7.57s-.65,5.36-1.96,7.57c-1.31,2.21-3.14,3.94-5.51,5.17-2.36,1.24-5.09,1.86-8.18,1.86h-11.89v-29.2ZM408.89,555.97c2.56,0,4.8-.51,6.72-1.52,1.92-1.01,3.41-2.42,4.46-4.21,1.06-1.79,1.58-3.86,1.58-6.19s-.53-4.4-1.58-6.2c-1.06-1.79-2.54-3.2-4.46-4.21s-4.16-1.52-6.72-1.52h-8.64v23.86h8.64Z" fill="#787878" stroke-width="0"/>
                <path d="M449.43,538.68c1.53,1.43,2.29,3.55,2.29,6.36v13.6h-2.84v-3.42c-.67,1.14-1.65,2.03-2.94,2.67-1.29.64-2.83.96-4.61.96-2.45,0-4.39-.58-5.84-1.75-1.45-1.17-2.17-2.71-2.17-4.63s.67-3.37,2.02-4.51c1.35-1.14,3.5-1.71,6.45-1.71h6.97v-1.33c0-1.89-.53-3.33-1.58-4.32-1.06-.99-2.6-1.48-4.63-1.48-1.39,0-2.73.23-4,.69s-2.38,1.09-3.3,1.9l-1.33-2.21c1.11-.95,2.45-1.68,4-2.19s3.2-.77,4.92-.77c2.86,0,5.06.72,6.59,2.15ZM446.1,555.37c1.2-.76,2.09-1.87,2.67-3.32v-3.59h-6.88c-3.75,0-5.63,1.31-5.63,3.92,0,1.28.49,2.29,1.46,3.02.97.74,2.34,1.11,4.09,1.11s3.1-.38,4.3-1.15Z" fill="#787878" stroke-width="0"/>
                <path d="M475.51,557.3c-.56.5-1.25.88-2.07,1.15-.82.26-1.68.4-2.57.4-2.06,0-3.64-.56-4.76-1.67s-1.67-2.68-1.67-4.71v-13.27h-3.92v-2.5h3.92v-4.8h2.96v4.8h6.67v2.5h-6.67v13.1c0,1.31.33,2.3.98,2.98.65.68,1.59,1.02,2.82,1.02.61,0,1.2-.1,1.77-.29s1.06-.47,1.48-.83l1.04,2.13Z" fill="#787878" stroke-width="0"/>
                <path d="M499.33,538.68c1.53,1.43,2.29,3.55,2.29,6.36v13.6h-2.84v-3.42c-.67,1.14-1.65,2.03-2.94,2.67-1.29.64-2.83.96-4.61.96-2.45,0-4.39-.58-5.84-1.75-1.45-1.17-2.17-2.71-2.17-4.63s.67-3.37,2.02-4.51c1.35-1.14,3.5-1.71,6.45-1.71h6.97v-1.33c0-1.89-.53-3.33-1.58-4.32-1.06-.99-2.6-1.48-4.63-1.48-1.39,0-2.73.23-4,.69s-2.38,1.09-3.3,1.9l-1.33-2.21c1.11-.95,2.45-1.68,4-2.19s3.2-.77,4.92-.77c2.86,0,5.06.72,6.59,2.15ZM495.99,555.37c1.2-.76,2.09-1.87,2.67-3.32v-3.59h-6.88c-3.75,0-5.63,1.31-5.63,3.92,0,1.28.49,2.29,1.46,3.02.97.74,2.34,1.11,4.09,1.11s3.1-.38,4.3-1.15Z" fill="#787878" stroke-width="0"/>
            </g>
            <g>
                <circle cx="77.72" cy="284.2" r="61.72" fill="#2e95ca" stroke-width="0"/>
                <circle cx="448.06" cy="243.05" r="102.87" fill="#e18a39" stroke-width="0"/>
                <path d="M16.71,151.14s147.42.62,187.48,177.17c2.32,10.24,11.26,17.6,21.76,17.6h23.41c12.38,0,22.44-10.09,22.25-22.47-1.07-67.39,18.44-266.07,279.32-313.57,0,0-280.63-33.35-337.55,205.74,0,0-77.04-96-196.67-64.47" fill="#75b546" stroke-width="0"/>
            </g>
          </svg>

          <span class="mx-2 text-2xl font-semibold text-white">SAKERNAS</span>
        </div>
      </div>

      <nav class="mt-10">
        <Link class="flex items-center px-6 py-2 mt-3 duration-200 border-l-4" :class="[
          $page.component === 'Admin/Index' ? activeClass : inactiveClass,
        ]" :href="route('admin.index')">
        <svg class="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 10C2 5.58172 5.58172 2 10 2V10H18C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10Z"
            fill="currentColor" />
          <path d="M12 2.25195C14.8113 2.97552 17.0245 5.18877 17.748 8.00004H12V2.25195Z" fill="currentColor" />
        </svg>

        <span class="mx-4">Dashboard</span>
        </Link>
<!-- 
        <Link class="flex items-center px-6 py-2 mt-3 duration-200 border-l-4" :class="[
          $page.component === 'Profile/Edit' ? activeClass : inactiveClass,
        ]" :href="route('profile.edit')">
        <svg class="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M5 3C3.89543 3 3 3.89543 3 5V7C3 8.10457 3.89543 9 5 9H7C8.10457 9 9 8.10457 9 7V5C9 3.89543 8.10457 3 7 3H5Z"
            fill="currentColor" />
          <path
            d="M5 11C3.89543 11 3 11.8954 3 13V15C3 16.1046 3.89543 17 5 17H7C8.10457 17 9 16.1046 9 15V13C9 11.8954 8.10457 11 7 11H5Z"
            fill="currentColor" />
          <path
            d="M11 5C11 3.89543 11.8954 3 13 3H15C16.1046 3 17 3.89543 17 5V7C17 8.10457 16.1046 9 15 9H13C11.8954 9 11 8.10457 11 7V5Z"
            fill="currentColor" />
          <path
            d="M11 13C11 11.8954 11.8954 11 13 11H15C16.1046 11 17 11.8954 17 13V15C17 16.1046 16.1046 17 15 17H13C11.8954 17 11 16.1046 11 15V13Z"
            fill="currentColor" />
        </svg>

        <span class="mx-4">UI Elements</span>
        </Link> -->

        <Link class="flex items-center px-6 py-2 mt-3 duration-200 border-l-4" :class="[
          route().current() === 'profile.edit' ? activeClass : inactiveClass,
        ]" :href="route('profile.edit')">
        <svg class="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M7 3C6.44772 3 6 3.44772 6 4C6 4.55228 6.44772 5 7 5H13C13.5523 5 14 4.55228 14 4C14 3.44772 13.5523 3 13 3H7Z"
            fill="currentColor" />
          <path
            d="M4 7C4 6.44772 4.44772 6 5 6H15C15.5523 6 16 6.44772 16 7C16 7.55228 15.5523 8 15 8H5C4.44772 8 4 7.55228 4 7Z"
            fill="currentColor" />
          <path
            d="M2 11C2 9.89543 2.89543 9 4 9H16C17.1046 9 18 9.89543 18 11V15C18 16.1046 17.1046 17 16 17H4C2.89543 17 2 16.1046 2 15V11Z"
            fill="currentColor" />
        </svg>

        <span class="mx-4">Export Data</span>
        </Link>

        <!-- <button @click="showingTwoLevelMenu = !showingTwoLevelMenu"
          class="flex items-center px-6 py-2 mt-3 duration-200 justify-between border-l-4 w-full"
          :class="[showingTwoLevelMenu ? activeClassSubmenu : inactiveClass]" aria-haspopup="true">
          <span class="inline-flex items-center">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
            <span class="mx-4">Two-level menu</span>
          </span>
          <svg class="w-4 h-4" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20"
            :class="[showingTwoLevelMenu ? activeClassIcon : inactiveClassIcon]">
            <path fill-rule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clip-rule="evenodd"></path>
          </svg>
        </button> -->
        <!-- <transition enter-to-class="transition-all duration-200 ease-in-out" enter-from-class="max-h-0 opacity-25"
          leave-from-class="opacity-100 max-h-xl" leave-to-class="max-h-0 opacity-0">
          <ul v-show="showingTwoLevelMenu"
            class="p-2 mt-2 space-y-2 overflow-hidden text-sm font-medium text-gray-500 shadow-inner bg-gray-900 dark:text-gray-400 dark:bg-gray-900"
            aria-label="submenu">
            <li class="px-0 py-0 transition-colors duration-150 hover:text-gray-800 dark:hover:text-gray-200">
              <Link class="flex items-center px-10 py-2 duration-200 border-l-4" :class="[
                route().current() === 'users.index' ? activeClassChild : inactiveClassChild,
              ]" :href="route('users.index')">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>

              <span class="mx-4">Users</span>
              </Link>
            </li>
            <li class="px-0 py-0 transition-colors duration-150 hover:text-gray-800 dark:hover:text-gray-200">
              <Link class="flex items-center px-10 py-2 duration-200 border-l-4" :class="[
                route().current() === 'dashboard' ? activeClassChild : inactiveClassChild,
              ]" :href="route('dashboard')">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
              </svg>

              <span class="mx-4">Modal</span>
              </Link>
            </li>
          </ul>
        </transition> -->

        <!-- <Link class="flex items-center px-6 py-2 mt-3 duration-200 border-l-4" :class="[
          route().current() === 'profile.edit' ? activeClass : inactiveClass,
        ]" :href="route('profile.edit')">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
          <path fill-rule="evenodd"
            d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
            clip-rule="evenodd" />
        </svg>

        <span class="mx-4">Forms</span>
        </Link>

        <Link class="flex items-center px-6 py-2 mt-3 duration-200 border-l-4" :class="[
          route().current() === 'profile.edit' ? activeClass : inactiveClass,
        ]" :href="route('profile.edit')">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
          <path fill-rule="evenodd"
            d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
            clip-rule="evenodd" />
        </svg>

        <span class="mx-4">Cards</span>
        </Link> -->
      </nav>
    </div>
  </div>
</template>


