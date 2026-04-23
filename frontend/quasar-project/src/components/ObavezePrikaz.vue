<template>
  <div class="obaveze-widget">
    <div class="widget-header">
      <div class="header-left">
        <div class="red-dot" />
        <span class="header-title">OBAVEZE</span>
      </div>
      <router-link to="/kalendar-obaveze" class="vidi-sve">Vidi sve</router-link>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner-dots size="40px" color="primary" />
    </q-inner-loading>
    <div v-if="!loading && tjedan1.length === 0 && tjedan2.length === 0" class="status-msg">Nema obaveza za tekući i naredni tjedan.</div>

    <!-- Ovaj tjedan -->
    <template v-if="tjedan1.length > 0">
      <div class="tjedan-label">Ovaj tjedan ({{ formatDateRange(weekRanges.start1, weekRanges.end1) }})</div>
    <router-link
      v-for="(obaveza, idx) in tjedan1"
      :key="obaveza.id_obaveze"
      :to="`/kalendar-obaveze`"
      class="obaveza-row"
      :style="{ backgroundColor: getTipBgColor(obaveza.fk_tip_obaveze), borderLeftColor: getTipColor(obaveza.fk_tip_obaveze), borderBottomWidth: idx === tjedan1.length - 1 ? '0px' : '0.5px' }"
    >
        <div class="obaveza-info">
          <div class="obaveza-title">{{ obaveza.opis_obaveze }}</div>
          <div class="obaveza-meta">
            {{ formatDate(obaveza.datum_obaveze) }} • {{ formatTimeShort(obaveza.vrijeme_pocetka) }}
          </div>
          <div class="tip-label" :style="{ color: getTipColor(obaveza.fk_tip_obaveze) }">{{ getTipName(obaveza.fk_tip_obaveze) }}</div>
        </div>
      </router-link>
    </template>

    <!-- Sljedeći tjedan -->
    <template v-if="tjedan2.length > 0">
       
      <div class="tjedan-label">Sljedeći tjedan ({{ formatDateRange(weekRanges.start2, weekRanges.end2) }})</div>
    <router-link
      v-for="(obaveza, idx) in tjedan2"
      :key="obaveza.id_obaveze"
      :to="`/kalendar-obaveze`"
      class="obaveza-row"
      :style="{ backgroundColor: getTipBgColor(obaveza.fk_tip_obaveze), borderLeftColor: getTipColor(obaveza.fk_tip_obaveze), borderBottomWidth: idx === tjedan2.length - 1 ? '0px' : '0.5px' }"
    >
        <div class="obaveza-info">
          <div class="obaveza-title">{{ obaveza.opis_obaveze }}</div>
          <div class="obaveza-meta">
            {{ formatDate(obaveza.datum_obaveze) }} • {{ formatTimeShort(obaveza.vrijeme_pocetka) }}
          </div>
          <div class="tip-label" :style="{ color: getTipColor(obaveza.fk_tip_obaveze) }">{{ getTipName(obaveza.fk_tip_obaveze) }}</div>
        </div>
      </router-link>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const obaveze = ref([])
const loading = ref(false)

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const start1 = new Date(now.setDate(diff))
  start1.setHours(0, 0, 0, 0)
  const end1 = new Date(start1)
  end1.setDate(end1.getDate() + 6)
  end1.setHours(23, 59, 59, 999)
  const start2 = new Date(end1)
  start2.setDate(start2.getDate() + 1)
  const end2 = new Date(start2)
  end2.setDate(end2.getDate() + 6)
  end2.setHours(23, 59, 59, 999)
  return { start1, end1, start2, end2 }
}

function formatDateRange(start, end) {
  const options = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('hr-HR', options)} - ${end.toLocaleDateString('hr-HR', options)}`
}

const weekRanges = computed(() => getWeekRange())

const tjedan1 = computed(() => {
  const { start1, end1 } = getWeekRange()
  return obaveze.value.filter(o => {
    const d = new Date(o.datum_obaveze)
    return d >= start1 && d <= end1
  })
})

const tjedan2 = computed(() => {
  const { start2, end2 } = getWeekRange()
  return obaveze.value.filter(o => {
    const d = new Date(o.datum_obaveze)
    return d >= start2 && d <= end2
  })
})

function formatTimeShort(timeStr) {
  if (!timeStr) return ''
  return timeStr.substring(0, 5)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const dani = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota']
  return dani[d.getDay()]
}

function getTipName(tipId) {
  switch (tipId) {
    case 1: return 'Kolokvij'
    case 2: return 'Praktični zadatak'
    case 3: return 'Predavanje/seminar'
    default: return 'Ostalo'
  }
}

function getTipColor(tipId) {
  switch (tipId) {
    case 1: return '#e65100' // kolokvij - orange
    case 2: return '#c62828' // praktični zadatak - red
    case 3: return '#2e7d32' // predavanje - green
    default: return '#1565c0' // drugo - blue
  }
}

function getTipBgColor(tipId) {
  switch (tipId) {
    case 1: return '#fff3e0' // kolokvij - light orange
    case 2: return '#ffebee' // praktični zadatak - light red
    case 3: return '#e8f5e9' // predavanje - light green
    default: return '#e3f2fd' // drugo - light blue
  }
}

onMounted(async () => {
  const token = localStorage.getItem('token')
  if (!token) {
    loading.value = false
    return
  }
  try {
    loading.value = true
    const response = await axios.get('http://localhost:3000/api/obaveze-za-tjedan', {
      headers: { Authorization: `Bearer ${token}` }
    })
    obaveze.value = response.data
  } catch (error) {
    console.error('Greška pri dohvaćanju obaveza:', error.response?.data || error.message)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.obaveze-widget {
  width: 100%;
  max-width: 500px;
  background: white;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  overflow: hidden;
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
.red-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #a51818;
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
.obaveza-row {
  display: flex;
  align-items: center;
  padding: 15px 20px;
  text-decoration: none;
  color: inherit;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  border-left: 4px solid transparent;
  border-radius: 8px;
  margin: 6px 8px;
  transition: background 0.12s;
}
.obaveza-row:hover {
  background: #f7f7f7;
}
.obaveza-info {
  flex: 1;
  min-width: 0;
}
.obaveza-title {
  font-size: 14px;
  font-weight: 500;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.obaveza-meta {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}
.tip-label {
  font-size: 11px;
  font-weight: 500;
  margin-top: 6px;
  margin-bottom: -4px;
  padding: 2px 10px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.04);
  display: inline-block;
}
.tjedan-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #555;
  padding: 10px 20px 6px 20px;
  background: #fafafa;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}
.tjedan-separator {
  height: 12px;
  background: #f5f5f5;
  border-top: 0.5px solid rgba(0, 0, 0, 0.06);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}
</style>
