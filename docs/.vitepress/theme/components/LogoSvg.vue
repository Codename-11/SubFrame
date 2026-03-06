<script setup lang="ts">
/**
 * Animated SubFrame atom logo — neon synthwave style.
 * 3 elliptical orbits (purple, pink, cyan) with orbiting electrons,
 * pulsing nucleus, ambient glow, and optional frame outline.
 */
const props = withDefaults(defineProps<{
  size?: number
  id?: string
  animate?: boolean
  frame?: boolean
}>(), {
  size: 28,
  id: 'logo',
  animate: true,
  frame: false,
})
</script>

<template>
  <svg :id="id" role="img" :aria-labelledby="`logo-title-${id}`" :width="size" :height="size" viewBox="0 0 180 180" style="vertical-align: middle">
    <title :id="`logo-title-${id}`">SubFrame logo</title>
    <defs>
      <!-- Electron glow -->
      <filter :id="`${id}-ge`" x="-150%" y="-150%" width="400%" height="400%">
        <feGaussianBlur stdDeviation="5" result="b" />
        <feComposite in="SourceGraphic" in2="b" operator="over" />
      </filter>
      <!-- Nucleus glow -->
      <filter :id="`${id}-gn`" x="-300%" y="-300%" width="700%" height="700%">
        <feGaussianBlur stdDeviation="10" result="b" />
        <feComposite in="SourceGraphic" in2="b" operator="over" />
      </filter>
      <!-- Frame glow -->
      <filter v-if="frame" :id="`${id}-gf`" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="b" />
        <feComposite in="SourceGraphic" in2="b" operator="over" />
      </filter>
      <!-- Ambient gradient -->
      <radialGradient :id="`${id}-ag`">
        <stop offset="0%" stop-color="rgba(255,110,180,0.18)" />
        <stop offset="50%" stop-color="rgba(180,128,255,0.05)" />
        <stop offset="100%" stop-color="transparent" />
      </radialGradient>
      <!-- Frame gradient -->
      <linearGradient v-if="frame" :id="`${id}-fg`" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#b480ff" stop-opacity="0.5" />
        <stop offset="50%" stop-color="#ff6eb4" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#64d8ff" stop-opacity="0.5" />
      </linearGradient>
      <!-- Orbit paths for animateMotion -->
      <path :id="`${id}-p1`" d="M32,90A58,22 0 1,0 148,90A58,22 0 1,0 32,90" />
      <path :id="`${id}-p2`" d="M32,90A58,22 0 1,0 148,90A58,22 0 1,0 32,90" />
      <path :id="`${id}-p3`" d="M32,90A58,22 0 1,0 148,90A58,22 0 1,0 32,90" />
    </defs>

    <!-- Ambient glow -->
    <circle cx="90" cy="90" r="40" :fill="`url(#${id}-ag)`">
      <template v-if="animate">
        <animate attributeName="r" values="36;48;36" dur="3s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
        <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      </template>
    </circle>

    <!-- Orbit 1: Purple -->
    <g transform="rotate(0,90,90)">
      <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(180,128,255,0.3)" stroke-width="1.5" />
      <circle r="3" fill="#b480ff" :filter="`url(#${id}-ge)`">
        <animateMotion v-if="animate" dur="4s" begin="0s" repeatCount="indefinite">
          <mpath :href="`#${id}-p1`" />
        </animateMotion>
        <template v-if="!animate">
          <!-- Static position -->
        </template>
      </circle>
    </g>

    <!-- Orbit 2: Pink (dashed) -->
    <g transform="rotate(60,90,90)">
      <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(255,110,180,0.25)" stroke-width="1.5" stroke-dasharray="5 3.5" />
      <circle r="3" fill="#ff6eb4" :filter="`url(#${id}-ge)`">
        <animateMotion v-if="animate" dur="5.5s" begin="-1.833s" repeatCount="indefinite">
          <mpath :href="`#${id}-p2`" />
        </animateMotion>
      </circle>
    </g>

    <!-- Orbit 3: Cyan -->
    <g transform="rotate(120,90,90)">
      <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(100,216,255,0.22)" stroke-width="1.5" />
      <circle r="3" fill="#64d8ff" :filter="`url(#${id}-ge)`">
        <animateMotion v-if="animate" dur="7s" begin="-4.667s" repeatCount="indefinite">
          <mpath :href="`#${id}-p3`" />
        </animateMotion>
      </circle>
    </g>

    <!-- Nucleus -->
    <circle cx="90" cy="90" r="5.5" fill="#ff6eb4" :filter="`url(#${id}-gn)`">
      <animate v-if="animate" attributeName="r" values="5;6.5;5" dur="2.5s" repeatCount="indefinite"
        calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </circle>

    <!-- Frame outline -->
    <rect v-if="frame" x="10" y="10" width="160" height="160" rx="14" ry="14"
      fill="none" :stroke="`url(#${id}-fg)`" stroke-width="1.5"
      :filter="`url(#${id}-gf)`"
      :stroke-dasharray="animate ? '632' : undefined"
      :stroke-dashoffset="animate ? '632' : undefined"
      :opacity="animate ? 0 : 1">
      <template v-if="animate">
        <animate attributeName="opacity" values="0;1" dur="0.3s" begin="0.5s" fill="freeze" />
        <animate attributeName="stroke-dashoffset" from="632" to="0" dur="2s" begin="0.5s"
          fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
      </template>
    </rect>
  </svg>
</template>
