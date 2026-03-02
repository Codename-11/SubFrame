<script setup lang="ts">
import { useData } from 'vitepress'
import HomeCustom from './HomeCustom.vue'
import BlogIndex from './BlogIndex.vue'
import BlogPost from './BlogPost.vue'

const { frontmatter } = useData()
</script>

<template>
  <HomeCustom v-if="frontmatter.layout === 'home-custom'" />
  <BlogIndex v-else-if="frontmatter.layout === 'blog-index'" />
  <BlogPost v-else-if="frontmatter.layout === 'blog-post'" />
  <div v-else>
    <Content />
  </div>
</template>
