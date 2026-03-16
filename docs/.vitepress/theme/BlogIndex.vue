<script setup lang="ts">
import { withBase } from 'vitepress'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import { data as posts } from '../../blog.data.mts'
import './styles/blog.css'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const tagColors: Record<string, string> = {
  Guide: 'tag-green',
  Feature: 'tag-purple',
  Architecture: 'tag-cyan',
  Vision: 'tag-pink',
  Roadmap: 'tag-amber',
}

function tagClass(tag: string): string {
  return tagColors[tag] || ''
}
</script>

<template>
  <div class="blog-page">
    <NavBar />

    <section class="blog-hero">
      <div class="blog-container">
        <p class="blog-hero-label">Blog</p>
        <h1>Engineering Insights</h1>
        <p class="blog-hero-sub">Behind-the-scenes on building SubFrame — architecture decisions, feature deep dives, and lessons learned.</p>
      </div>
    </section>

    <section class="blog-list">
      <div class="blog-container">
        <a
          v-for="post in posts"
          :key="post.url"
          :href="withBase(post.url)"
          class="blog-card"
        >
          <div class="blog-card-meta">
            <span class="blog-card-date">{{ formatDate(post.date) }}</span>
            <span class="blog-card-tag" :class="tagClass(post.tag)">{{ post.tag }}</span>
          </div>
          <h2>{{ post.title }}</h2>
          <p>{{ post.description }}</p>
          <span class="blog-card-read">Read →</span>
        </a>
      </div>
    </section>

    <Footer />
  </div>
</template>
