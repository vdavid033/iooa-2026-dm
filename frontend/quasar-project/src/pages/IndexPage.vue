<template>
  <q-page class="q-pa-lg">
    <div class="q-mb-lg flex items-center q-gutter-md header-content">
      <img alt="" src="~assets/Veleuciliste-u-Rijeci-Logo.png" style="width: 200px; height: 70px" />
      <div>
        <div class="text-h5">
          Dobrodošli, <strong>{{ ime }}</strong
          >!
        </div>
        <div class="text-caption text-grey">{{ danas }}</div>
      </div>
    </div>

    <div class="header-divider"></div>

    <!-- Glavni grid -->
    <div class="row q-col-gutter-lg">
      <!-- Lijeva kolona - Forum -->
      <div class="col-8">
        <div class="forum-widget">
          <div class="widget-header">
            <div class="header-left">
              <div class="blue-dot" />
              <span class="header-title">FORUM - ZADNJE TEME</span>
            </div>
            <router-link to="/forum" class="vidi-sve">Vidi sve</router-link>
          </div>

          <q-inner-loading :showing="loading">
            <q-spinner-dots size="40px" color="primary" />
          </q-inner-loading>
          <div v-if="!loading && teme.length === 0" class="status-msg">Još nema tema na forumu.</div>

          <router-link
            v-for="(tema, idx) in teme"
            :key="tema.id"
            :to="`/objava/${tema.id}`"
            class="forum-row"
            :class="{ 'no-border': idx === teme.length - 1 }"
          >
            <div class="forum-info">
              <div class="forum-title">{{ tema.title }}</div>
              <div class="forum-meta">
                {{ tema.author }} • {{ formatTime(tema.date) }}
              </div>
            </div>
          </router-link>
        </div>
      </div>

      <!-- Desna kolona - Poruke + Obaveze -->
      <div class="col-4 right-column">
        <div class="column q-gutter-md">
          <PorukePrikaz />
          <div class="bg-grey-2 fit"><h1>Kalendar</h1></div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import PorukePrikaz from 'src/components/PorukePrikaz.vue'
import { ref, onMounted } from 'vue'
import { jwtDecode } from 'jwt-decode'
import axios from 'axios'

const ime = ref('')
const danas = ref('')
const teme = ref([])
const loading = ref(true)

const token = localStorage.getItem('token')
if (token) {
  try {
    const decoded = jwtDecode(token)
    ime.value = decoded.ime || decoded.username || 'korisnik'
  } catch {}
}

const d = new Date()
const dani = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota']
const mjeseci = [
  'siječnja',
  'veljače',
  'ožujka',
  'travnja',
  'svibnja',
  'lipnja',
  'srpnja',
  'kolovoza',
  'rujna',
  'listopada',
  'studenog',
  'prosinca',
]
danas.value = `${dani[d.getDay()]}, ${d.getDate()}. ${mjeseci[d.getMonth()]} ${d.getFullYear()}.`

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'jučer'
  const days = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub']
  const diff = Math.floor((now - d) / 86400000)
  if (diff < 7) return days[d.getDay()]
  return d.toLocaleDateString()
}

onMounted(async () => {
  const token = localStorage.getItem('token')
  if (!token) {
    loading.value = false
    return
  }

  try {
    const response = await axios.get('http://localhost:3000/api/forum/latest', {
      headers: { Authorization: `Bearer ${token}` }
    })
    console.log('Forum latest response:', response.data)
    teme.value = response.data
  } catch (error) {
    console.error('Greška pri dohvaćanju tema:', error.response?.data || error.message)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.header-content {
  margin-left: 70px;
}
.header-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
  margin-left: 100px;
  margin-right: 100px;
  margin-bottom: 30px;
}
.right-column {
  margin-left: -150px;
}
.forum-widget {
  width: 100%;
  max-width: 75%;
  background: white;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  overflow: hidden;
  margin-left: 100px;
  padding-left: 4px;
}
.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.blue-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #185fa5;
}
.header-title {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: #111;
}
.vidi-sve {
  font-size: 13px;
  color: #185fa5;
  text-decoration: none;
}
.status-msg {
  font-size: 13px;
  color: grey;
  padding: 16px;
  text-align: center;
}
.forum-row {
  display: flex;
  align-items: center;
  padding: 15px 20px;
  text-decoration: none;
  color: inherit;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  transition: background 0.12s;
}
.forum-row:hover {
  background: #f7f7f7;
}
.forum-row.no-border {
  border-bottom: none;
}
.forum-info {
  flex: 1;
  min-width: 0;
}
.forum-title {
  font-size: 14px;
  font-weight: 500;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.forum-meta {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}
</style>
