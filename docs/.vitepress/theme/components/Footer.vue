<template>
  <footer class="docs-footer">
    <div class="docs-footer-inner">
      <span class="footer-brand">SubFrame</span>
      <span class="footer-copy">Open source · MIT License</span>
    </div>
  </footer>
</template>

<style scoped>
.docs-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 2rem 1.5rem;
  text-align: center;
}
.docs-footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}
.footer-brand {
  font-weight: 700;
  color: var(--sf-text-primary, #eeeef0);
}
.footer-copy {
  font-size: 0.75rem;
  color: var(--sf-text-tertiary, #6b6b80);
}
</style>
