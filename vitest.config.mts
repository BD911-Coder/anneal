import { defineConfig } from "vitest/config";

// Test sadece /engine için: uyumluluk kuralları ve performans hesabı.
// Arayüz bileşenleri test edilmez, bu yüzden tarayıcı ortamı kurulmuyor.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
