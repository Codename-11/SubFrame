<script setup lang="ts">
import { useData } from 'vitepress'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import './styles/blog.css'

const { frontmatter } = useData()

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="blog-page">
    <NavBar />

    <article>
      <header class="post-header">
        <div class="blog-container">
          <a href="/blog/" class="post-back">&larr; All posts</a>
          <div class="post-meta">
            <span class="post-date">{{ formatDate(frontmatter.date) }}</span>
            <span class="post-tag">{{ frontmatter.tag }}</span>
          </div>
          <h1>{{ frontmatter.title }}</h1>
          <p class="post-subtitle">{{ frontmatter.description }}</p>
        </div>
      </header>

      <div class="post-content">
        <div class="blog-container">
          <Content />
        </div>
      </div>
    </article>

    <Footer />
  </div>
</template>
