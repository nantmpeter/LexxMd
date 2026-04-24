---
layout: page
title: Download
---

# Download Lexx

<script setup>
import { ref, onMounted } from 'vue'

const os = ref('unknown')

onMounted(() => {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) os.value = 'mac'
  else if (ua.includes('win')) os.value = 'windows'
  else if (ua.includes('linux')) os.value = 'linux'
})

const base = 'https://lexxmd.pages.dev/update'
const version = '0.1.0'
</script>

<div class="dl-page">
  <div v-if="os === 'mac'" class="dl-card primary">
    <div class="dl-icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/><path d="M14.5 9a3.5 3.5 0 0 0-5 0"/><path d="M12 17v-4"/></svg>
    </div>
    <h3>macOS</h3>
    <p>Supports Apple Silicon (M1+) and Intel Macs</p>
    <a :href="base + '/Lexx_' + version + '_aarch64.dmg'" class="dl-btn" download>
      Download for Apple Silicon
    </a>
    <a :href="base + '/Lexx_' + version + '_x64.dmg'" class="dl-alt">Intel Mac (.dmg)</a>
  </div>

  <div v-else-if="os === 'windows'" class="dl-card primary">
    <div class="dl-icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    </div>
    <h3>Windows</h3>
    <p>Windows 10 and later</p>
    <a :href="base + '/Lexx_' + version + '_x64-setup.exe'" class="dl-btn" download>
      Download for Windows
    </a>
  </div>

  <div v-else-if="os === 'linux'" class="dl-card primary">
    <div class="dl-icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
    </div>
    <h3>Linux</h3>
    <p>AppImage or .deb package</p>
    <a :href="base + '/Lexx_' + version + '_amd64.AppImage'" class="dl-btn" download>
      Download AppImage
    </a>
    <a :href="base + '/Lexx_' + version + '_amd64.deb'" class="dl-alt">.deb package</a>
  </div>

  <div v-else class="dl-card primary">
    <h3>Download Lexx</h3>
    <p>Choose your platform below</p>
  </div>

  <div class="dl-all">
    <h4>All Platforms</h4>
    <div class="dl-list">
      <a :href="base + '/Lexx_' + version + '_aarch64.dmg'">macOS Apple Silicon (.dmg)</a>
      <a :href="base + '/Lexx_' + version + '_x64.dmg'">macOS Intel (.dmg)</a>
      <a :href="base + '/Lexx_' + version + '_x64-setup.exe'">Windows (.exe)</a>
      <a :href="base + '/Lexx_' + version + '_amd64.AppImage'">Linux (.AppImage)</a>
      <a :href="base + '/Lexx_' + version + '_amd64.deb'">Linux (.deb)</a>
    </div>
  </div>
</div>

## System Requirements

| Platform | Requirement |
|----------|-------------|
| macOS | macOS 12 (Monterey) or later |
| Windows | Windows 10 (1803+) or later |
| Linux | glibc 2.31+, X11 or Wayland |

<style>
.dl-page {
  max-width: 520px;
  margin: 2rem auto;
}

.dl-card {
  border: 1px solid #e1e4e8;
  border-radius: 10px;
  padding: 2rem;
  text-align: center;
  margin-bottom: 2rem;
  background: #f6f8fa;
}

.dl-card.primary {
  border-color: #0366d6;
}

.dl-icon {
  color: #0366d6;
  margin-bottom: 0.5rem;
}

.dl-card h3 {
  font-size: 1.25rem;
  margin: 0 0 0.25rem;
}

.dl-card p {
  color: #6a737d;
  font-size: 0.875rem;
  margin: 0 0 1.25rem;
}

.dl-btn {
  display: inline-block;
  padding: 10px 24px;
  background: #0366d6;
  color: #fff !important;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
  text-decoration: none !important;
  transition: background 0.2s;
}

.dl-btn:hover {
  background: #0550ae;
}

.dl-alt {
  display: block;
  margin-top: 0.5rem;
  color: #6a737d !important;
  font-size: 0.8125rem;
  text-decoration: none !important;
}

.dl-alt:hover {
  color: #24292e !important;
}

.dl-all {
  text-align: center;
}

.dl-all h4 {
  color: #999;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem;
}

.dl-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.dl-list a {
  color: #6a737d !important;
  font-size: 0.8125rem;
  text-decoration: none !important;
}

.dl-list a:hover {
  color: #0366d6 !important;
}
</style>
