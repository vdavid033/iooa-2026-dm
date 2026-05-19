<template>
  <div class="poruke-widget">
    <div class="widget-header">
      <div class="header-left">
        <div class="blue-dot" />
        <span class="header-title">MOJE PORUKE</span>
      </div>
      <router-link to="/poruke" class="vidi-sve">Vidi sve</router-link>
    </div>

    <div v-if="loading" class="status-msg">Učitavanje...</div>
    <div v-else-if="!token" class="status-msg">Prijavite se za prikaz poruka.</div>
    <div v-else-if="sortedChats.length === 0" class="status-msg">Nema poruka za prikaz.</div>

    <router-link
      v-for="(chat, idx) in sortedChats"
      :key="chat.id_korisnika"
      :to="`/poruke?user=${chat.id_korisnika}`"
      class="chat-row"
      :class="{ 'no-border': idx === sortedChats.length - 1 }"
    >
      <div class="avatar" :style="avatarStyle(idx)">
        {{ initials(chat.ime_korisnika, chat.prezime_korisnika) }}
      </div>
      <div class="chat-info">
        <div class="chat-name" :class="{ bold: isUnread(chat.id_korisnika) }">
          {{ chat.ime_korisnika }} {{ chat.prezime_korisnika }}
        </div>
        <div class="chat-preview">
          <span v-if="fromMe(chat.id_korisnika)" class="from-me">Ti: </span>
          {{ getPreview(chat.id_korisnika) }}
        </div>
      </div>
      <div class="chat-meta">
        <span class="chat-time">{{ getTime(chat.id_korisnika) }}</span>
        <div
          class="unread-dot"
          :style="{ visibility: isUnread(chat.id_korisnika) ? 'visible' : 'hidden' }"
        />
      </div>
    </router-link>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { jwtDecode } from 'jwt-decode'

const token = ref(localStorage.getItem('token'))
const trenutniId = ref(null)
const chats = ref([])
const poruke = ref([])
const loading = ref(true)

const bgColors = ['#E6F1FB', '#E1F5EE', '#FAECE7', '#EEEDFE', '#FAEEDA']
const txtColors = ['#0C447C', '#085041', '#712B13', '#3C3489', '#633806']

const avatarStyle = (idx) => ({
  background: bgColors[idx % bgColors.length],
  color: txtColors[idx % txtColors.length],
})

const initials = (ime, prez) => ((ime?.[0] || '') + (prez?.[0] || '')).toUpperCase()

const getLastMsg = (korisnikId) => {
  const kId = String(korisnikId)
  const tId = String(trenutniId.value)
  return (
    poruke.value
      .filter(
        (p) =>
          (String(p.posiljatelj) === kId && String(p.primatelj) === tId) ||
          (String(p.posiljatelj) === tId && String(p.primatelj) === kId)
      )
      .sort((a, b) => new Date(b.datum_vrijeme) - new Date(a.datum_vrijeme))[0] || null
  )
}

const sortedChats = computed(() =>
  [...chats.value]
    .sort(
      (a, b) =>
        new Date(getLastMsg(b.id_korisnika)?.datum_vrijeme || 0) -
        new Date(getLastMsg(a.id_korisnika)?.datum_vrijeme || 0)
    )
    .slice(0, 4)
)

const getPreview = (id) => {
  const msg = getLastMsg(id)
  if (!msg) return 'Nema poruka'
  return msg.sadrzaj.length > 32 ? msg.sadrzaj.slice(0, 32) + '…' : msg.sadrzaj
}

const fromMe = (id) => {
  const msg = getLastMsg(id)
  return msg && String(msg.posiljatelj) === String(trenutniId.value)
}

const isUnread = (id) => {
  const msg = getLastMsg(id)
  return msg && String(msg.posiljatelj) !== String(trenutniId.value)
}

const formatTime = (dt) => {
  if (!dt) return ''
  const d = new Date(dt)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'jučer'
  const days = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub']
  const diff = Math.floor((now - d) / 86400000)
  if (diff < 7) return days[d.getDay()]
  return d.toLocaleDateString()
}

const getTime = (id) => {
  const msg = getLastMsg(id)
  return msg ? formatTime(msg.datum_vrijeme) : ''
}

onMounted(async () => {
  if (!token.value) {
    loading.value = false
    return
  }
  try {
    const decoded = jwtDecode(token.value)
    trenutniId.value = decoded.id

    const r1 = await fetch(`http://localhost:3000/api/messages/korisnici/${decoded.id}`)
    chats.value = await r1.json()

    const svePoruke = await Promise.all(
      chats.value.map((chat) =>
        fetch(`http://localhost:3000/api/messages/poruke/${decoded.id}/${chat.id_korisnika}`)
          .then((r) => r.json())
          .catch(() => [])
      )
    )
    poruke.value = svePoruke.flat()
  } catch (e) {
    console.error(e)
  }
  loading.value = false
})
</script>

<style scoped>
.poruke-widget {
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
.chat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  text-decoration: none;
  color: inherit;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  transition: background 0.12s;
}
.chat-row:hover {
  background: #f7f7f7;
}
.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}
.chat-info {
  flex: 1;
  min-width: 0;
}
.chat-name {
  font-size: 13px;
  font-weight: 400;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chat-name.bold {
  font-weight: 500;
}
.chat-preview {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.from-me {
  color: #555;
}
.chat-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}
.chat-time {
  font-size: 11px;
  color: #aaa;
}
.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #185fa5;
}
</style>
