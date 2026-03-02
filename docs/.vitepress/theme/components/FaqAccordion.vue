<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface FaqItem {
  question: string
  answer: string
}

defineProps<{ items: FaqItem[] }>()

const openIndex = ref<number | null>(null)
const visible = ref(false)

function toggle(index: number) {
  openIndex.value = openIndex.value === index ? null : index
}

onMounted(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        visible.value = true
        observer.disconnect()
      }
    },
    { threshold: 0.1 }
  )
  const el = document.querySelector('.faq-grid')
  if (el) observer.observe(el)
})
</script>

<template>
  <div class="faq-grid" :class="{ 'fade-in': true, visible }">
    <div
      v-for="(item, i) in items"
      :key="i"
      class="faq-item"
      :class="{ open: openIndex === i }"
    >
      <button
        class="faq-question"
        :id="`faq-btn-${i}`"
        :aria-expanded="openIndex === i"
        :aria-controls="`faq-answer-${i}`"
        @click="toggle(i)"
      >
        <span>{{ item.question }}</span>
        <svg aria-hidden="true" class="faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        class="faq-answer"
        :id="`faq-answer-${i}`"
        role="region"
        :aria-labelledby="`faq-btn-${i}`"
      >
        <p v-html="item.answer"></p>
      </div>
    </div>
  </div>
</template>
