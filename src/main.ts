import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import { IonicVue } from '@ionic/vue'

import '@fontsource-variable/commissioner/wght.css'
import '@fontsource-variable/azeret-mono/wght.css'
import '@fontsource-variable/instrument-sans/wght.css'

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css'

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'

/* Theme variables */
import './theme/variables.css'
import { initializeTheme } from './theme'
import { initializeBobbinService } from './settings/service'
import { initializeRecentActivity, rememberRecentRoute } from './activity/recent'

initializeTheme()
initializeBobbinService()
initializeRecentActivity(typeof window === 'undefined' ? undefined : window.localStorage)
router.afterEach((route) => rememberRecentRoute(route))

const app = createApp(App).use(IonicVue).use(router)

router.isReady().then(() => {
	app.mount('#app')
})
