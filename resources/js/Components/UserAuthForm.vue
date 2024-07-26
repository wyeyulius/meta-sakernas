<script setup lang="ts">
import { ref } from "vue";
import { Head, Link, useForm } from "@inertiajs/vue3";

import { cn } from "@/lib/utils";
import { Button } from "@/lib/registry/new-york/ui/button";
import { Input } from "@/lib/registry/new-york/ui/input";
import { Label } from "@/lib/registry/new-york/ui/label";
import InputError from "@/Components/InputError.vue";
import Checkbox from "@/Components/Checkbox.vue";

const isLoading = ref(false);
async function onSubmit(event: Event) {
    event.preventDefault();
    isLoading.value = true;

    setTimeout(() => {
        isLoading.value = false;
    }, 3000);
}

defineProps<{
    canResetPassword?: boolean;
    status?: string;
}>();

const form = useForm({
    email: "",
    password: "",
    remember: false,
});

const submit = () => {
    form.post(route("login"), {
        onFinish: () => {
            form.reset("password");
        },
    });
};
</script>

<template>
    <div :class="cn('grid gap-6', $attrs.class ?? '')">
        <form @submit.prevent="submit">
            <div class="grid gap-2">
                <div class="grid gap-1">
                    <Label class="sr-only" for="email"> Email </Label>
                    <Input id="email" required v-model="form.email" placeholder="name@example.com" type="email"
                        auto-capitalize="none" auto-complete="email" auto-correct="off" :disabled="isLoading" />
                    <InputError class="mt-2" :message="form.errors.email" />
                </div>
                <div class="grid gap-1">
                    <Label class="sr-only" for="password"> Password </Label>
                    <Input id="password" required v-model="form.password" placeholder="*******" type="password"
                        auto-complete="current-passowrd" auto-correct="off" :disabled="isLoading" />
                    <InputError class="mt-2" :message="form.errors.password" />
                </div>
                <Button :disabled="isLoading">
                    <LucideSpinner v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
                    Log In
                </Button>
            </div>

            <div class="block mt-4">
                <label class="flex items-center">
                    <Checkbox name="remember" v-model:checked="form.remember" />
                    <span class="ms-2 text-sm text-gray-600">Remember me</span>
                </label>
            </div>

            <div class="flex items-center justify-end mt-4">
                <Link v-if="canResetPassword" :href="route('password.request')"
                    class="underline text-sm text-gray-600 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Forgot your password?
                </Link>
            </div>
        </form>
        <!-- <div class="relative">
            <div class="absolute inset-0 flex items-center">
                <span class="w-full border-t" />
            </div>
            <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-background px-2 text-muted-foreground">
                    Or continue with
                </span>
            </div>
        </div>
        <Button variant="outline" type="button" :disabled="isLoading">
            <LucideSpinner v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
            <GitHubLogo v-else class="mr-2 h-4 w-4" />
            GitHub
        </Button> -->
    </div>
</template>
