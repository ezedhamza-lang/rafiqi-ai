import '@testing-library/jest-dom/vitest';

// Material Icons و matchMedia غير متوفرين في jsdom — بدائل آمنة
if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
}