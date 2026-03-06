<script setup lang="ts">
import './styles/docs.css'
import { useData, withBase } from 'vitepress'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'

interface SidebarLink {
  text: string
  link: string
}

interface SidebarGroup {
  text: string
  items: SidebarLink[]
}

type SidebarEntry = SidebarLink | SidebarGroup

const { page, theme, frontmatter } = useData()

const sidebarEntries = computed(() => {
  const sidebar = theme.value.sidebar || {}
  for (const [prefix, entries] of Object.entries(sidebar)) {
    if (page.value.relativePath.startsWith(prefix.replace(/^\//, ''))) {
      return entries as SidebarEntry[]
    }
  }
  return []
})

const currentPath = computed(() => {
  return '/' + page.value.relativePath.replace(/\.md$/, '').replace(/index$/, '')
})

function isActive(link: string): boolean {
  const normalizedLink = link.endsWith('/') ? link : link + '/'
  const normalizedCurrent = currentPath.value.endsWith('/') ? currentPath.value : currentPath.value + '/'
  return normalizedLink === normalizedCurrent
}

function isGroup(entry: SidebarEntry): entry is SidebarGroup {
  return 'items' in entry
}

// Mobile sidebar toggle
const sidebarOpen = ref(false)

function closeSidebar() {
  sidebarOpen.value = false
}

// Close sidebar on route change
onMounted(() => {
  window.addEventListener('hashchange', closeSidebar)
})
onUnmounted(() => {
  window.removeEventListener('hashchange', closeSidebar)
})
</script>

<template>
  <div class="docs-page">
    <NavBar />

    <div class="docs-layout">
      <button
        class="docs-sidebar-toggle"
        @click="sidebarOpen = !sidebarOpen"
        :aria-expanded="sidebarOpen.toString()"
        aria-label="Toggle sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
        <span>Menu</span>
      </button>

      <aside class="docs-sidebar" :class="{ open: sidebarOpen }">
        <nav class="docs-sidebar-nav">
          <template v-for="entry in sidebarEntries" :key="isGroup(entry) ? entry.text : entry.link">
            <!-- Grouped sidebar -->
            <template v-if="isGroup(entry)">
              <div class="docs-sidebar-group-label">{{ entry.text }}</div>
              <a
                v-for="item in entry.items"
                :key="item.link"
                :href="withBase(item.link)"
                class="docs-sidebar-link"
                :class="{ active: isActive(item.link) }"
                @click="closeSidebar"
              >
                {{ item.text }}
              </a>
            </template>
            <!-- Flat sidebar link -->
            <a
              v-else
              :href="withBase(entry.link)"
              class="docs-sidebar-link"
              :class="{ active: isActive(entry.link) }"
              @click="closeSidebar"
            >
              {{ entry.text }}
            </a>
          </template>
        </nav>
      </aside>

      <main class="docs-content">
        <article class="docs-article">
          <h1 v-if="frontmatter.title" class="docs-title">{{ frontmatter.title }}</h1>
          <Content />
        </article>
      </main>
    </div>

    <Footer />
  </div>
</template>
