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

const baseUrl = 'https://lexxmd.com/downloads'
const version = '0.1.0'
</script>

<div class="download-section">
  <div v-if="os === 'mac'" class="download-card">
    <h3>macOS</h3>
    <p>Supports Apple Silicon (M1+) and Intel Macs</p>
    <a :href="baseUrl + '/Lexx_' + version + '_aarch64.dmg'" class="lexx-btn lexx-btn-primary" download>
      Download for macOS (Apple Silicon)
    </a>
    <a :href="baseUrl + '/Lexx_' + version + '_x64.dmg'" class="alt-link">Intel Mac (.dmg)</a>
  </div>
  <div v-else-if="os === 'windows'" class="download-card">
    <h3>Windows</h3>
    <p>Windows 10 and later</p>
    <a :href="baseUrl + '/Lexx_' + version + '_x64-setup.exe'" class="lexx-btn lexx-btn-primary" download>
      Download for Windows
    </a>
  </div>
  <div v-else-if="os === 'linux'" class="download-card">
    <h3>Linux</h3>
    <p>AppImage format, works on most distributions</p>
    <a :href="baseUrl + '/Lexx_' + version + '_amd64.AppImage'" class="lexx-btn lexx-btn-primary" download>
      Download for Linux
    </a>
  </div>
  <div v-else class="download-card">
    <h3>Download Lexx</h3>
    <p>Choose your platform below</p>
  </div>

  <div class="alt-downloads">
    <h4>All Platforms</h4>
    <a :href="baseUrl + '/Lexx_' + version + '_aarch64.dmg'">macOS Apple Silicon (.dmg)</a>
    <a :href="baseUrl + '/Lexx_' + version + '_x64.dmg'">macOS Intel (.dmg)</a>
    <a :href="baseUrl + '/Lexx_' + version + '_x64-setup.exe'">Windows (.exe)</a>
    <a :href="baseUrl + '/Lexx_' + version + '_amd64.AppImage'">Linux (.AppImage)</a>
  </div>
</div>

## System Requirements

| Platform | Requirement |
|----------|-------------|
| macOS | macOS 12 (Monterey) or later |
| Windows | Windows 10 (1803+) or later |
| Linux | glibc 2.31+, X11 or Wayland |

<style scoped>
.download-section {
  text-align: center;
  margin: var(--space-6) 0;
}

.download-card {
  background: var(--lexx-bg-secondary);
  border: 1px solid var(--lexx-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  max-width: 480px;
  margin: 0 auto var(--space-6);
}

.download-card h3 {
  font-size: var(--text-2xl);
  margin-bottom: var(--space-2);
}

.download-card p {
  color: var(--lexx-text-secondary);
  margin-bottom: var(--space-4);
}

.alt-link {
  display: inline-block;
  margin-top: var(--space-2);
  color: var(--lexx-text-tertiary);
  font-size: var(--text-sm);
}

.alt-link:hover {
  color: var(--lexx-text-primary);
}

.alt-downloads {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;
}

.alt-downloads h4 {
  color: var(--lexx-text-tertiary);
  font-size: var(--text-sm);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.alt-downloads a {
  color: var(--lexx-text-secondary);
  font-size: var(--text-sm);
}

.alt-downloads a:hover {
  color: var(--lexx-text-primary);
}
</style>
