<template>
  <div class="tag-board-container">
    <!-- 검색 및 필터 헤더 -->
    <div class="tag-board-header">
      <div class="search-box-wrapper">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="searchPlaceholder"
          class="tag-search-input"
        />
        <span v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">✕</span>
      </div>

      <!-- 태그 클라우드 (노션 스타일) -->
      <div class="tags-cloud">
        <button
          :class="['tag-filter-btn', { active: selectedTag === '' }]"
          @click="selectTag('')"
        >
          🏷️ {{ allText }} ({{ currentLangPosts.length }})
        </button>
        <button
          v-for="item in tagCounts"
          :key="item.name"
          :class="['tag-filter-btn', { active: selectedTag === item.name }]"
          @click="selectTag(item.name)"
        >
          #{{ item.name }}
          <span class="tag-count">{{ item.count }}</span>
        </button>
      </div>
    </div>

    <!-- 결과 통계 -->
    <div class="filter-status-bar">
      <span>
        총 <strong>{{ filteredPosts.length }}</strong>개의 포스트
        <span v-if="selectedTag"> (선택 태그: <span class="highlight-tag">#{{ selectedTag }}</span>)</span>
      </span>
      <button v-if="selectedTag || searchQuery" class="reset-filter-btn" @click="resetFilters">
        필터 초기화 🔄
      </button>
    </div>

    <!-- 포스트 카드 목록 -->
    <div v-if="filteredPosts.length > 0" class="post-cards-grid">
      <div
        v-for="post in filteredPosts"
        :key="post.url"
        class="post-item-card"
      >
        <div class="post-card-top">
          <span :class="['post-cat-badge', post.category.toLowerCase()]">{{ post.category }}</span>
          <span v-if="post.date" class="post-date">📅 {{ post.date }}</span>
        </div>
        <h3 class="post-card-title">
          <a :href="post.url">{{ post.title }}</a>
        </h3>
        <p v-if="post.description" class="post-card-desc">
          {{ post.description }}
        </p>
        <div v-if="post.tags && post.tags.length > 0" class="post-card-tags">
          <span
            v-for="t in post.tags"
            :key="t"
            :class="['notion-tag', getTagColor(t), { 'current-selected': selectedTag === t }]"
            @click.stop="selectTag(t)"
          >
            #{{ t }}
          </span>
        </div>
      </div>
    </div>

    <!-- 검색 결과 없음 -->
    <div v-else class="empty-results">
      <p>🔍 조건에 맞는 게시글이 없습니다.</p>
      <button class="reset-filter-btn" @click="resetFilters">전체 목록 보기</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vitepress'
import { data as posts } from '../posts.data.mjs'

const route = useRoute()
const selectedTag = ref('')
const searchQuery = ref('')

const currentLang = computed(() => {
  if (route.path.startsWith('/en/')) return 'en'
  if (route.path.startsWith('/ja/')) return 'ja'
  return 'ko'
})

const allText = computed(() => {
  if (currentLang.value === 'en') return 'All'
  if (currentLang.value === 'ja') return 'すべて'
  return '전체'
})

const searchPlaceholder = computed(() => {
  if (currentLang.value === 'en') return 'Search by title, description or tag...'
  if (currentLang.value === 'ja') return 'タイトル、説明、タグで検索...'
  return '제목, 내용, 태그로 검색...'
})

// 현재 언어에 해당하는 포스트만 추출
const currentLangPosts = computed(() => {
  return posts.filter(p => p.lang === currentLang.value)
})

// 태그별 게시글 수 집계
const tagCounts = computed(() => {
  const map = {}
  currentLangPosts.value.forEach(p => {
    p.tags.forEach(t => {
      map[t] = (map[t] || 0) + 1
    })
  })
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
})

// 태그 색상 클래스
const getTagColor = (tag) => {
  const t = tag.toLowerCase()
  if (t.includes('aws') || t.includes('cloud') || t.includes('network') || t.includes('linux') || t.includes('rds')) return 'notion-tag-blue'
  if (t.includes('troubleshoot') || t.includes('성능') || t.includes('automation')) return 'notion-tag-green'
  if (t.includes('security') || t.includes('cve') || t.includes('incident') || t.includes('backup')) return 'notion-tag-red'
  if (t.includes('serverless') || t.includes('lambda') || t.includes('ai') || t.includes('gemini')) return 'notion-tag-purple'
  if (t.includes('windows') || t.includes('wsl') || t.includes('sql') || t.includes('mysql')) return 'notion-tag-yellow'
  return 'notion-tag-gray'
}

// 필터링된 포스트 목록
const filteredPosts = computed(() => {
  return currentLangPosts.value.filter(p => {
    // 1. 태그 필터
    if (selectedTag.value && !p.tags.includes(selectedTag.value)) {
      return false
    }
    // 2. 검색어 필터
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const inTitle = p.title.toLowerCase().includes(q)
      const inDesc = p.description.toLowerCase().includes(q)
      const inTags = p.tags.some(t => t.toLowerCase().includes(q))
      return inTitle || inDesc || inTags
    }
    return true
  })
})

const selectTag = (tag) => {
  selectedTag.value = tag
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    if (tag) {
      url.searchParams.set('tag', tag)
    } else {
      url.searchParams.delete('tag')
    }
    window.history.replaceState({}, '', url)
  }
}

const resetFilters = () => {
  selectedTag.value = ''
  searchQuery.value = ''
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    url.searchParams.delete('tag')
    window.history.replaceState({}, '', url)
  }
}

// URL query parameter 파싱
onMounted(() => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const tagParam = params.get('tag')
    if (tagParam) {
      selectedTag.value = decodeURIComponent(tagParam)
    }
  }
})
</script>

<style scoped>
.tag-board-container {
  margin: 1.5rem 0 3rem 0;
}

.tag-board-header {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  padding: 1.2rem;
  margin-bottom: 1.5rem;
}

.search-box-wrapper {
  position: relative;
  margin-bottom: 1rem;
}

.tag-search-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.tag-search-input:focus {
  border-color: var(--vp-c-brand-1);
}

.clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}

.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-filter-btn {
  cursor: pointer;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.tag-filter-btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.tag-filter-btn.active {
  background: var(--vp-c-brand-1);
  color: #ffffff;
  border-color: var(--vp-c-brand-1);
}

.tag-count {
  font-size: 0.72rem;
  opacity: 0.75;
  background: rgba(0, 0, 0, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
}

.tag-filter-btn.active .tag-count {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.filter-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.2rem;
  font-size: 0.88rem;
  color: var(--vp-c-text-2);
}

.highlight-tag {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.reset-filter-btn {
  cursor: pointer;
  background: none;
  border: 1px solid var(--vp-c-border);
  color: var(--vp-c-text-2);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.reset-filter-btn:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.post-cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.post-item-card {
  padding: 1.2rem 1.4rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.post-item-card:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand-1);
}

.post-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.post-cat-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.post-cat-badge.tech {
  background: rgba(37, 99, 235, 0.12);
  color: var(--vp-c-brand-1);
}

.post-cat-badge.blog {
  background: rgba(194, 65, 12, 0.12);
  color: var(--point-color);
}

.post-date {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}

.post-card-title {
  margin: 0 0 0.5rem 0 !important;
  font-size: 1.15rem !important;
  font-weight: 600 !important;
  border-top: none !important;
}

.post-card-title a {
  color: var(--vp-c-text-1) !important;
  text-decoration: none !important;
}

.post-card-title a:hover {
  color: var(--vp-c-brand-1) !important;
}

.post-card-desc {
  margin: 0 0 0.8rem 0;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.post-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.post-card-tags .notion-tag {
  cursor: pointer;
}

.current-selected {
  outline: 2px solid var(--vp-c-brand-1);
}

.empty-results {
  text-align: center;
  padding: 3rem 1rem;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  color: var(--vp-c-text-2);
}
</style>
