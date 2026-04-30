<template>
  <q-page class="q-pa-lg bg-grey-1">

    <!-- Header -->
    <div class="row items-center justify-between header-content" style="margin-bottom: 20px;">
      <div class="row items-center q-gutter-md">
        <img src="~assets/Veleuciliste-u-Rijeci-Logo.png"
             alt="Veleri logo"
             style="width: 200px; height: 70px; object-fit: contain;" />
        <div style="line-height: 1.2;">
          <div class="text-h5 text-black" style="margin-bottom: 1px;">
            Dobrodošli na Forum
          </div>
          <div class="text-caption" style="color: #9e9e9e;">Okruženje za rasprave i dijeljenje znanja</div>
        </div>
      </div>
      <q-btn
        v-if="isAuthenticated"
        label="+ Nova tema"
        color="primary"
        size="md"
        no-caps
        class="text-weight-bold new-topic-btn"
      />
    </div>

    <!-- Search bar + Filters (vizualno, statično) -->
    <div class="row items-end search-filter-row" style="margin-bottom: 16px;">
      <div class="col-9">
        <q-input v-model="searchQuery" filled dense
                 placeholder="Pretraži forum po ključnoj riječi..."
                 class="search-input bg-white rounded-borders">
          <template #prepend>
            <q-icon name="search" style="color: #9e9e9e;" />
          </template>
        </q-input>
      </div>
      <div class="col-3 q-pl-md">
        <div style="display: flex; gap: 8px; width: 100%;">
          <q-select
            v-model="selectedTagsStatic"
            :options="[]"
            label="Svi tagovi"
            multiple filled dense
            class="filter-select bg-white rounded-borders"
          />
          <q-select
            v-model="selectedUserStatic"
            :options="[]"
            label="Svi korisnici"
            filled dense clearable
            class="filter-select bg-white rounded-borders"
          />
        </div>
      </div>
    </div>

    <!-- Category tabs (vizualno, statično) -->
    <div class="category-tabs">
      <div class="row q-gutter-md">
        <span
          v-for="cat in categoryButtons"
          :key="cat.value"
          class="category-item"
          :class="{ active: selectedCategory === cat.value }"
          @click="selectedCategory = cat.value"
        >
          {{ cat.label }}
        </span>
      </div>
    </div>

    <!-- Section label -->
    <div class="section-label">
      NAJNOVIJE OBJAVE
    </div>

    <!-- Loading -->
    <div v-if="loading" class="row justify-center q-pa-lg">
      <q-spinner color="primary" size="40px" />
    </div>

    <!-- Posts container -->
    <div v-else class="forum-posts-container">
      <div v-if="paginatedPosts.length === 0" class="q-pa-lg text-center" style="color: #9e9e9e;">
        Nema objava za prikaz.
      </div>

      <div
        class="post-item"
        v-for="(post, index) in paginatedPosts"
        :key="post.id"
        @click="goToPost(post.id)"
      >
        <div class="post-card-inner">

          <!-- Avatar + ime + kategorija | datum -->
          <div class="row items-center justify-between q-mb-sm">
            <div class="row items-center q-gutter-sm">
              <q-avatar size="32px" :color="getAvatarColor(post.author)" text-color="white" class="text-weight-bold">
                {{ getInitials(post.author) }}
              </q-avatar>
              <span class="text-caption text-grey-9 text-weight-medium">{{ post.author }}</span>
              <span class="category-pill">{{ post.category }}</span>
            </div>
            <span class="text-caption" style="color: #9e9e9e;">
              {{ post.edited_at ? `Uređeno ${formatDate(post.edited_at)}` : formatDate(post.date) }}
            </span>
          </div>

          <!-- Naslov, preview, tagovi, akcije -->
          <div class="post-indent">
            <div class="text-subtitle2 text-weight-medium text-primary q-mb-xs">
              {{ post.title }}
            </div>
            <div class="text-body2 line-clamp-2 q-mb-sm" style="color: #9e9e9e;">
              {{ post.preview }}
            </div>
            <div class="row items-center justify-between">
              <div class="row items-center q-gutter-xs">
                <q-chip
                  v-for="tag in post.tags"
                  :key="tag"
                  dense size="sm"
                  :label="'#' + tag"
                  color="grey-3"
                  text-color="primary"
                  class="tag-chip"
                />
              </div>
              <div class="row items-center q-gutter-sm">
                <q-btn
                  v-if="isCurrentUserPost(post)"
                  flat dense no-caps size="sm"
                  color="primary"
                  icon="edit"
                  label="Uredi"
                  class="edit-btn"
                  @click.stop="openEditDialog(post)"
                />
                <div class="row items-center q-gutter-xs">
                  <q-icon name="chat_bubble_outline" size="14px" color="blue-9" />
                  <span class="text-caption" style="color: #9e9e9e;">{{ post.comments }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
        <q-separator v-if="index < paginatedPosts.length - 1" />
      </div>
    </div>

    <!-- Pagination -->
    <div class="row justify-center q-mt-lg">
      <q-pagination v-model="page" :max="maxPage" max-pages="5" boundary-numbers color="primary" />
    </div>

    <!-- Edit Dialog -->
    <q-dialog v-model="editDialog" persistent>
      <q-card style="min-width: 600px; max-width: 800px;">
        <q-card-section>
          <div class="text-h6 text-primary">
            <q-icon name="edit" class="q-mr-sm" />
            Uredi objavu
          </div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input v-model="editTitle" label="Naslov objave" filled maxlength="100" counter
            :disable="editLoading" :error="!!editTitleError" :error-message="editTitleError" class="q-mb-md" />
          <q-input v-model="editContent" type="textarea" label="Sadržaj objave" rows="4" maxlength="256" counter filled
            :disable="editLoading" :error="!!editContentError" :error-message="editContentError" class="q-mb-md" />
          <q-select v-model="editCategory" :options="categories" option-label="label" option-value="value"
            label="Kategorija" filled color="primary" :disable="editLoading"
            :error="!!editCategoryError" :error-message="editCategoryError" class="q-mb-md" />
          <q-select v-model="editTags" :options="availableTags" option-label="label" option-value="value"
            label="Tagovi" multiple filled color="primary" :disable="editLoading"
            :error="!!editTagsError" :error-message="editTagsError"
            hint="Maksimalno 5 tagova" :rules="[val => val.length <= 5 || 'Dozvoljeno je do 5 tagova.']" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Odustani" color="grey" @click="closeEditDialog" :disable="editLoading" />
          <q-btn flat label="Spremi sve izmjene" color="primary" @click="saveEdit" :loading="editLoading"
            :disable="!editTitle.trim() || !editContent.trim() || !editCategory" />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const router = useRouter()

const isAuthenticated = computed(() => !!localStorage.getItem('token'))

// Statični vizualni state (searchbar + filteri + kategorije)
const searchQuery = ref('')
const selectedTagsStatic = ref([])
const selectedUserStatic = ref(null)
const selectedCategory = ref('all')
const categoryButtons = [
  { label: 'Sve objave', value: 'all' },
  { label: 'Pitanja i odgovori', value: 'Pitanja i odgovori' },
  { label: 'Razmjena materijala', value: 'Razmjena materijala' },
  { label: 'Tehnička podrška', value: 'Tehnička podrška' }
]

// Posts
const posts = ref([])
const loading = ref(false)
const page = ref(1)
const perPage = 4

const availableTags = ref([])
const categories = ref([])

const maxPage = computed(() => Math.max(1, Math.ceil(posts.value.length / perPage)))
const paginatedPosts = computed(() =>
  posts.value.slice((page.value - 1) * perPage, page.value * perPage)
)

// Edit state
const editDialog = ref(false)
const editingPost = ref(null)
const editTitle = ref('')
const editContent = ref('')
const editCategory = ref(null)
const editTags = ref([])
const editLoading = ref(false)
const editTitleError = ref('')
const editContentError = ref('')
const editCategoryError = ref('')
const editTagsError = ref('')

// Avatar helpers
const avatarColorList = ['indigo-6', 'teal-6', 'deep-orange-6', 'purple-6', 'cyan-7', 'green-7', 'pink-6', 'blue-grey-6']
function getAvatarColor(author) {
  if (!author) return 'primary'
  let hash = 0
  for (let i = 0; i < author.length; i++) hash += author.charCodeAt(i)
  return avatarColorList[hash % avatarColorList.length]
}
function getInitials(author) {
  if (!author) return '?'
  const parts = author.trim().split(/[\s_]+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return author.slice(0, 2).toUpperCase()
}

function formatDate(dateString) {
  if (!dateString) return ''
  const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  return new Date(dateString).toLocaleString('hr-HR', options).replace(',', ' u')
}

function isCurrentUserPost(post) {
  const token = localStorage.getItem('token')
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (post.authorId !== undefined && payload.id !== undefined) return payload.id == post.authorId
    if (payload.korisnicko_ime && post.author) return payload.korisnicko_ime.toLowerCase() === post.author.toLowerCase()
    if (payload.ime && post.author) return payload.ime.toLowerCase() === post.author.toLowerCase()
    return false
  } catch { return false }
}

function goToPost(id) {
  router.push(`/objava/${id}`)
}

async function fetchObjave() {
  loading.value = true
  try {
    const response = await axios.get('http://localhost:3000/api/objave')
    posts.value = response.data
  } catch (error) {
    console.error('Ne mogu dohvatiti objave:', error)
    $q.notify({ type: 'negative', message: 'Greška pri dohvaćanju objava.', timeout: 2500 })
  } finally {
    loading.value = false
  }
}

async function fetchTagovi() {
  try {
    const response = await axios.get('http://localhost:3000/api/tagovi')
    availableTags.value = response.data
  } catch (error) {
    console.error('Ne mogu dohvatiti tagove:', error)
  }
}

async function fetchKategorije() {
  try {
    const response = await axios.get('http://localhost:3000/api/kategorije')
    categories.value = response.data
  } catch (error) {
    console.error('Ne mogu dohvatiti kategorije:', error)
  }
}

async function openEditDialog(post) {
  editingPost.value = post
  editTitle.value = post.title
  editContent.value = post.preview
  editTitleError.value = ''
  editContentError.value = ''
  editCategoryError.value = ''
  editTagsError.value = ''
  try {
    editLoading.value = true
    const response = await api.get(`/objave/${post.id}`)
    const fullPost = response.data
    editCategory.value = fullPost.kategorija
      ? categories.value.find(cat => cat.label === fullPost.kategorija || cat.value === fullPost.fk_kategorija) || null
      : null
    editTags.value = fullPost.tagovi && Array.isArray(fullPost.tagovi)
      ? availableTags.value.filter(tag => fullPost.tagovi.includes(tag.label))
      : []
    editDialog.value = true
  } catch (error) {
    console.error('Greška pri dohvaćanju podataka objave:', error)
    $q.notify({ type: 'negative', message: 'Greška pri učitavanju podataka objave', timeout: 2500 })
  } finally {
    editLoading.value = false
  }
}

function closeEditDialog() {
  editDialog.value = false
  editingPost.value = null
  editTitle.value = ''
  editContent.value = ''
  editCategory.value = null
  editTags.value = []
  editTitleError.value = ''
  editContentError.value = ''
  editCategoryError.value = ''
  editTagsError.value = ''
}

async function saveEdit() {
  editTitleError.value = ''
  editContentError.value = ''
  editCategoryError.value = ''
  editTagsError.value = ''
  let hasErrors = false

  if (!editTitle.value.trim()) { editTitleError.value = 'Naslov objave ne može biti prazan'; hasErrors = true }
  else if (editTitle.value.length > 100) { editTitleError.value = 'Naslov ne može biti duži od 100 znakova'; hasErrors = true }
  if (!editContent.value.trim()) { editContentError.value = 'Sadržaj objave ne može biti prazan'; hasErrors = true }
  else if (editContent.value.length > 256) { editContentError.value = 'Sadržaj ne može biti duži od 256 znakova'; hasErrors = true }
  if (!editCategory.value) { editCategoryError.value = 'Kategorija je obavezna'; hasErrors = true }
  if (editTags.value.length > 5) { editTagsError.value = 'Maksimalno 5 tagova je dozvoljeno'; hasErrors = true }
  if (hasErrors) return

  editLoading.value = true
  try {
    const response = await api.put(`/objave/${editingPost.value.id}`, {
      naslov: editTitle.value.trim(),
      sadrzaj: editContent.value.trim(),
      fk_kategorija: editCategory.value?.value || null,
      tagovi: editTags.value.map(tag => tag.value)
    })
    if (response.data.success) {
      const updated = {
        title: editTitle.value.trim(),
        preview: editContent.value.trim(),
        category: editCategory.value?.label || '',
        tags: editTags.value.map(tag => tag.label),
        edited_at: response.data.objava.edited_at
      }
      const index = posts.value.findIndex(p => p.id === editingPost.value.id)
      if (index !== -1) posts.value[index] = { ...posts.value[index], ...updated }
      closeEditDialog()
      $q.notify({ type: 'positive', message: 'Objava je uspješno ažurirana', timeout: 2500, position: 'top-right' })
    }
  } catch (error) {
    console.error('Greška pri ažuriranju objave:', error)
    editContentError.value = error.response?.data?.error || 'Greška prilikom spremanja'
  } finally {
    editLoading.value = false
  }
}

onMounted(() => {
  fetchObjave()
  fetchTagovi()
  fetchKategorije()
})
</script>

<style scoped>
.header-content {
  margin-left: 70px;
  margin-right: 100px;
}

.search-filter-row {
  margin-left: 100px;
  margin-right: 100px;
}

/* ===== SEARCH INPUT ===== */
.search-input :deep(.q-field),
.search-input :deep(.q-field__control),
.search-input :deep(.q-field__native),
.search-input :deep(.q-field__prepend),
.search-input :deep(.q-field__append) {
  background-color: white !important;
  border-radius: 8px !important;
}
.search-input :deep(.q-field__control::before),
.search-input :deep(.q-field__control::after) {
  background-color: white !important;
  border: none !important;
}
.search-input :deep(.q-field--filled .q-field__control::before) {
  background-color: white !important;
}
.search-input :deep(.q-field--filled:hover .q-field__control::before),
.search-input :deep(.q-field--filled.q-field--focused .q-field__control::before) {
  background-color: white !important;
  opacity: 1 !important;
}
.search-input :deep(.q-field__native),
.search-input :deep(.q-field__native::placeholder),
.search-input :deep(input::placeholder) {
  color: #9e9e9e !important;
}
.search-input :deep(.q-field__label) {
  color: #9e9e9e !important;
}

/* ===== FILTER SELECTS ===== */
.filter-select {
  min-width: 120px;
}
.filter-select :deep(.q-field),
.filter-select :deep(.q-field__control),
.filter-select :deep(.q-field__native),
.filter-select :deep(.q-field__prepend),
.filter-select :deep(.q-field__append) {
  background-color: white !important;
  border-radius: 8px !important;
}
.filter-select :deep(.q-field__control::before),
.filter-select :deep(.q-field__control::after) {
  background-color: white !important;
  border: none !important;
}
.filter-select :deep(.q-field--filled .q-field__control::before) {
  background-color: white !important;
}
.filter-select :deep(.q-field--filled:hover .q-field__control::before),
.filter-select :deep(.q-field--filled.q-field--focused .q-field__control::before) {
  background-color: white !important;
  opacity: 1 !important;
}
.filter-select :deep(.q-field__label),
.filter-select :deep(.q-field__native),
.filter-select :deep(.q-field__input),
.filter-select :deep(.q-select__dropdown-icon),
.filter-select :deep(.q-icon) {
  color: #9e9e9e !important;
  font-size: 13px !important;
}
.filter-select :deep(.q-chip__content) {
  color: #9e9e9e !important;
}
.filter-select :deep(.q-chip) {
  background-color: #f5f5f5 !important;
}

/* ===== CATEGORY TABS ===== */
.category-tabs {
  margin-left: 100px;
  margin-right: 100px;
  margin-bottom: 24px;
  border-bottom: 1.5px solid #e0e0e0;
}
.category-item {
  font-size: 13px;
  color: #9e9e9e;
  cursor: pointer;
  position: relative;
  padding: 6px 12px;
  padding-bottom: 10px;
  transition: color 0.2s ease;
  border-radius: 0;
  background: none !important;
}
.category-item:hover {
  color: #757575;
  background: none !important;
}
.category-item.active {
  color: #1976d2;
  font-weight: 500;
  background: none !important;
}
.category-item.active::after {
  content: '';
  position: absolute;
  bottom: -1.5px;
  left: 0;
  right: 0;
  height: 2px;
  background: #1976d2;
}

.new-topic-btn {
  font-size: 14px;
  padding: 8px 20px;
  border-radius: 8px;
  letter-spacing: 0.5px;
}

.section-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: #9e9e9e;
  margin-left: 100px;
  margin-bottom: 16px;
}

/* ===== POSTS ===== */
.forum-posts-container {
  background: white;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  overflow: hidden;
  margin-left: 100px;
  margin-right: 100px;
}

.post-item {
  padding: 14px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.post-item:hover {
  background-color: #f5f5f5;
}
.post-item:last-child {
  border-bottom: none !important;
}

.post-indent {
  margin-left: 44px;
}

.category-pill {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  color: #1976d2;
  background-color: #e3f0fd;
  border-radius: 4px;
  padding: 2px 8px;
  line-height: 1.6;
}

.edit-btn {
  font-size: 11px;
  opacity: 0.85;
}
.edit-btn:hover {
  opacity: 1;
}

.tag-chip {
  border-radius: 6px;
  font-size: 11px;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
