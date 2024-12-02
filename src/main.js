import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import VueLazyload from '@jambonn/vue-lazyload'

import loadimage from '@/assets/avatar.svg'

createApp(App).use(VueLazyload, {
  preLoad: 1.3,
  error: loadimage,
  loading: loadimage,
  attempt: 1
})
createApp(App).mount('#app')
