<script setup lang="ts">
import { Head } from "@inertiajs/vue3";
import UserAuthForm from "@/Components/UserAuthForm.vue";
</script>

<template>

    <Head title="Log In" />
    <div
        class="container relative grid h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <img class="w-20 sm:w-6 lg:w-16 absolute right-4 top-4 md:right-8 md:top-8" src="@img/rb.png" alt="logo" />
        <!-- <a href="/examples/authentication" :class="cn(
            buttonVariants({ variant: 'ghost' }),
            'absolute right-4 top-4 md:right-8 md:top-8',
        )">
            Login
        </a> -->
        <div class="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
            <div class="absolute inset-0 bg-zinc-900" />
            <div class="relative z-20 flex items-center text-lg font-medium">
                <img class="w-20 sm:w-6 lg:w-16" src="@img/bps.svg" alt="logo" />
            </div>
            <div class="relative z-20 mt-auto">
                <blockquote class="space-y-2">
                    <p class="text-lg">
                        &ldquo;It does not matter how slowly you go, so long as you do not stop.&rdquo;
                    </p>
                    <footer class="text-sm">—Confucius</footer>
                </blockquote>
            </div>
        </div>
        <div class="lg:p-8">
            <div class="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                <div class="flex flex-col space-y-2 text-center">
                    <h1 class="text-2xl font-semibold tracking-tight">
                        Silakan login untuk melanjutkan
                    </h1>
                    <p class="text-sm text-muted-foreground">
                        Masukan email dan password anda
                    </p>
                </div>
                <UserAuthForm />
                <!-- <p class="px-8 text-center text-sm text-muted-foreground">
                    By clicking continue, you agree to our
                    <a href="/terms" class="underline underline-offset-4 hover:text-primary">
                        Terms of Service
                    </a>
                    and
                    <a href="/privacy" class="underline underline-offset-4 hover:text-primary">
                        Privacy Policy
                    </a>
                    .
                </p> -->
            </div>
        </div>
    </div>
</template>
