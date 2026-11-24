import { onUnmounted, ref } from 'vue';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export function useConexion() {
  const conectado = ref(true);
  const tipo = ref('unknown');

  let handle: PluginListenerHandle | undefined;
  let destruido = false;

  Network.getStatus()
    .then((estado) => {
      conectado.value = estado.connected;
      tipo.value = estado.connectionType;
    })
    .catch(() => {});

  Network.addListener('networkStatusChange', (estado) => {
    conectado.value = estado.connected;
    tipo.value = estado.connectionType;
  }).then((h) => {
    if (destruido) h.remove();
    else handle = h;
  });

  onUnmounted(() => {
    destruido = true;
    handle?.remove();
  });

  return { conectado, tipo };
}

export async function vibrar() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
  }
}
