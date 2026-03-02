<script setup lang="ts">
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import HomeCustom from './HomeCustom.vue'
import BlogIndex from './BlogIndex.vue'
import BlogPost from './BlogPost.vue'

const { Layout: DefaultLayout } = DefaultTheme
const { frontmatter } = useData()
</script>

<template>
  <HomeCustom v-if="frontmatter.layout === 'home-custom'" />
  <BlogIndex v-else-if="frontmatter.layout === 'blog-index'" />
  <BlogPost v-else-if="frontmatter.layout === 'blog-post'" />
  <DefaultLayout v-else />
</template>
