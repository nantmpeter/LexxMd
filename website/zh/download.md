---
layout: page
title: 下载
---

# 下载 Lexx

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
    <p>支持 Apple Silicon (M1+) 和 Intel Mac</p>
    <a :href="baseUrl + '/Lexx_' + version + '_aarch64.dmg'" class="lexx-btn lexx-btn-primary" download>
      下载 macOS 版（Apple Silicon）
    </a>
    <a :href="baseUrl + '/Lexx_' + version + '_x64.dmg'" class="alt-link">Intel Mac (.dmg)</a>
  </div>
  <div v-else-if="os === 'windows'" class="download-card">
    <h3>Windows</h3>
    <p>Windows 10 及以上版本</p>
    <a :href="baseUrl + '/Lexx_' + version + '_x64-setup.exe'" class="lexx-btn lexx-btn-primary" download>
      下载 Windows 版
    </a>
  </div>
  <div v-else-if="os === 'linux'" class="download-card">
    <h3>Linux</h3>
    <p>AppImage 格式，适用于大多数发行版</p>
    <a :href="baseUrl + '/Lexx_' + version + '_amd64.AppImage'" class="lexx-btn lexx-btn-primary" download>
      下载 Linux 版
    </a>
  </div>
  <div v-else class="download-card">
    <h3>下载 Lexx</h3>
    <p>请在下方选择你的平台</p>
  </div>

  <div class="alt-downloads">
    <h4>所有平台</h4>
    <a :href="baseUrl + '/Lexx_' + version + '_aarch64.dmg'">macOS Apple Silicon (.dmg)</a>
    <a :href="baseUrl + '/Lexx_' + version + '_x64.dmg'">macOS Intel (.dmg)</a>
    <a :href="baseUrl + '/Lexx_' + version + '_x64-setup.exe'">Windows (.exe)</a>
    <a :href="baseUrl + '/Lexx_' + version + '_amd64.AppImage'">Linux (.AppImage)</a>
  </div>
</div>

## 系统要求

| 平台 | 要求 |
|------|------|
| macOS | macOS 12 (Monterey) 及以上 |
| Windows | Windows 10 (1803+) 及以上 |
| Linux | glibc 2.31+，X11 或 Wayland |

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
