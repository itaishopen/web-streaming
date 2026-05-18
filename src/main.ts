import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/global.css'

// Register Lit components (they self-register via @customElement)
import './components/app-sidebar'
import './components/media-card'
import './components/trending-carousel'
import './components/search-modal'
import './components/setup-screen'
import './components/trailer-modal'

const app = createApp(App)
app.use(router)
app.mount('#app')
