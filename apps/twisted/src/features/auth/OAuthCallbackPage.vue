<template>
  <ion-page>
    <ion-content :fullscreen="true" class="callback-content">
      <div class="callback-container">
        <ion-spinner name="crescent" class="callback-spinner" />
        <p class="callback-text">{{ statusMessage }}</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
  import { onMounted, ref } from "vue";
  import { useRouter } from "vue-router";
  import { IonPage, IonContent, IonSpinner, toastController } from "@ionic/vue";
  import { finalizeAuthorization } from "@atcute/oauth-browser-client";
  import { useAuthStore } from "@/core/auth/store.js";

  const router = useRouter();
  const authStore = useAuthStore();

  const statusMessage = ref("Completing sign in...");

  onMounted(async () => {
    try {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const result = await finalizeAuthorization(params);

      authStore.setSession(result.session);
      statusMessage.value = "Signed in successfully!";

      const toast = await toastController.create({
        message: "Signed in successfully!",
        duration: 2000,
        color: "success",
      });
      await toast.present();

      router.replace("/tabs/profile");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign in failed";
      statusMessage.value = message;
      authStore.state = "error";
      authStore.error = message;

      const toast = await toastController.create({ message, duration: 3000, color: "danger" });
      await toast.present();

      setTimeout(() => {
        router.replace("/tabs/profile");
      }, 1500);
    }
  });
</script>

<style scoped>
  .callback-content {
    --background: var(--ion-background-color);
  }

  .callback-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 20px;
  }

  .callback-spinner {
    width: 48px;
    height: 48px;
    color: var(--t-accent);
  }

  .callback-text {
    font-size: 16px;
    color: var(--t-text-secondary);
    margin: 0;
  }
</style>
