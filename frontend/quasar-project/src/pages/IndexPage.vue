<template>
  <q-page class="q-pa-lg">
    <div class="q-mb-lg flex items-center q-gutter-md">
      <img alt="" src="~assets/Veleuciliste-u-Rijeci-Logo.png" style="width: 200px; height: 70px" />
      <div>
        <div class="text-h5">
          Dobrodošli, <strong>{{ ime }}</strong
          >!
        </div>
        <div class="text-caption text-grey">{{ danas }}</div>
      </div>
    </div>

    <!-- Glavni grid -->
    <div class="row q-col-gutter-lg">
      <!-- Lijeva kolona - Forum -->
      <div class="col-8">
        <div class="bg-red-2 fit"><h1>Forum</h1></div>
      </div>

      <!-- Desna kolona - Poruke + Obaveze -->
      <div class="col-4">
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
import { ref } from 'vue'
import { jwtDecode } from 'jwt-decode'

const ime = ref('')
const danas = ref('')

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
</script>
