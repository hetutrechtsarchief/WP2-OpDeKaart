import {createApp} from 'vue'
import './index.css'
import './style.css'
import App from './App.vue'
import VueMapboxTs from "vue-mapbox-ts";
import {store} from "./store";
import naive from "naive-ui";

const app = createApp(App);
app.use(store);
app.use(VueMapboxTs);
app.use(naive);
app.mount('#app');