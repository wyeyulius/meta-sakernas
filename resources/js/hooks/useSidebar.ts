import { ref } from "vue";

const isOpen = ref(false)

export function useSidebar() {
  return {
    isOpen
  };
}

const showingTwoLevelMenu = ref(false);

export function showMenu() {
  return {
    showingTwoLevelMenu
  };
}
