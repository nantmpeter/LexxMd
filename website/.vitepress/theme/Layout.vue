<script setup lang="ts">
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

const { frontmatter } = useData()
</script>

<template>
  <DefaultTheme.Layout v-if="frontmatter.layout !== 'home'" />
  <div v-else class="lexx-site">
    <Content />
  </div>
</template>

<style>
.lexx-site {
  min-height: 100vh;
}
</style>
