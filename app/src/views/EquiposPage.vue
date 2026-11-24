<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Equipos</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/tabs/equipos/nuevo" aria-label="Nuevo equipo">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="q" :debounce="400" placeholder="Buscar por código o nombre" @ion-input="buscar" />
      </ion-toolbar>
      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">Sin conexión: los datos pueden estar desactualizados</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ion-refresh="refrescar">
        <ion-refresher-content />
      </ion-refresher>

      <ion-list v-if="cargando && equipos.length === 0 && !error">
        <ion-item v-for="n in 6" :key="n">
          <ion-label>
            <h2><ion-skeleton-text animated style="width: 60%" /></h2>
            <p><ion-skeleton-text animated style="width: 40%" /></p>
          </ion-label>
        </ion-item>
      </ion-list>

      <div v-else-if="error && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="cloudOfflineOutline" />
        <p>{{ error }}</p>
        <ion-button @click="cargar(true)">Reintentar</ion-button>
      </div>

      <div v-else-if="!cargando && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="searchOutline" />
        <p>{{ q ? 'No hay equipos que coincidan con la búsqueda.' : 'Aún no hay equipos registrados.' }}</p>
      </div>

      <ion-list v-else>
        <ion-item-sliding v-for="equipo in equipos" :key="equipo.id">
          <ion-item :router-link="`/tabs/equipos/${equipo.id}/editar`" detail>
            <ion-label>
              <h2>{{ equipo.nombre }}</h2>
              <p>{{ equipo.codigo }} · {{ equipo.categoria.nombre }}</p>
            </ion-label>
            <ion-badge slot="end" :color="colorEstado[equipo.estado]">{{ equipo.estado }}</ion-badge>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" @click="confirmarEliminacion(equipo, $event)">
              <ion-icon slot="start" :icon="trashOutline" />
              Eliminar
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <ion-infinite-scroll :disabled="!hayMas || equipos.length === 0" @ion-infinite="cargarMas">
        <ion-infinite-scroll-content />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar, IonContent,
  IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonSkeletonText, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent,
  alertController, onIonViewWillEnter,
} from '@ionic/vue';
import type { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/vue';
import { add, cloudOfflineOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { eliminar, listar, type Equipo, type Estado } from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

const colorEstado: Record<Estado, string> = { disponible: 'success', prestado: 'warning', mantenimiento: 'medium' };

const { conectado } = useConexion();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');
const cargando = ref(false);
const error = ref('');
const hayMas = computed(() => pagina.value < ultimaPagina.value);

let solicitud = 0;

async function cargar(reiniciar = false) {
  const mia = ++solicitud;
  const siguiente = reiniciar ? 1 : pagina.value + 1;
  cargando.value = true;
  error.value = '';
  try {
    const respuesta = await listar(siguiente, q.value.trim());
    if (mia !== solicitud) return;
    equipos.value = reiniciar ? respuesta.data : [...equipos.value, ...respuesta.data];
    pagina.value = respuesta.meta.current_page;
    ultimaPagina.value = respuesta.meta.last_page;
  } catch (e) {
    if (mia !== solicitud) return;
    error.value = e instanceof ErrorApi && e.status === 0
      ? 'No fue posible conectar con la API.'
      : 'No fue posible cargar los equipos.';
    if (equipos.value.length > 0) mostrarToast(error.value, 'danger');
  } finally {
    if (mia === solicitud) cargando.value = false;
  }
}

onIonViewWillEnter(() => cargar(true));

const buscar = (evento: CustomEvent) => {
  q.value = evento.detail.value ?? '';
  return cargar(true);
};

async function refrescar(evento: RefresherCustomEvent) {
  await cargar(true);
  await evento.target.complete();
}

async function cargarMas(evento: InfiniteScrollCustomEvent) {
  if (!cargando.value && hayMas.value) await cargar(false);
  await evento.target.complete();
}

const quitarDeLista = (id: number) => {
  equipos.value = equipos.value.filter((e) => e.id !== id);
};

async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  const deslizable = (evento.target as HTMLElement | null)?.closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
  await deslizable?.close();

  const alerta = await alertController.create({
    header: 'Eliminar equipo',
    message: `¿Eliminar ${equipo.codigo} · ${equipo.nombre}?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  try {
    await eliminar(equipo.id);
    quitarDeLista(equipo.id);
    vibrar();
    mostrarToast('Equipo eliminado.', 'success');
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 409) {
      mostrarToast(e.cuerpo?.mensaje ?? e.message, 'warning');
    } else if (e instanceof ErrorApi && e.status === 404) {
      quitarDeLista(equipo.id);
      mostrarToast('El equipo ya no existe.', 'warning');
    } else {
      mostrarToast('No fue posible eliminar el equipo.', 'danger');
    }
  }
}
</script>
