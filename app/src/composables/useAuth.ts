import { computed, ref } from 'vue';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Device } from '@capacitor/device';
import { api } from '@/services/api';

export interface Usuario { id: number; nombre: string }

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

// Estado compartido por toda la app (fuera de la función = un solo valor) — YA IMPLEMENTADO
const token = ref<string | null>(null);
const usuario = ref<Usuario | null>(null);
let tokenCargado = false;

/** YA IMPLEMENTADO — lo usa services/api.ts para armar el encabezado Authorization. */
export const obtenerToken = () => token.value;

export async function olvidarSesion() {
  token.value = null;
  usuario.value = null;
  await Promise.allSettled([SecureStorage.remove(CLAVE_TOKEN), SecureStorage.remove(CLAVE_USUARIO)]);
}

export function useAuth() {
  const estaAutenticado = computed(() => token.value !== null);

  async function login(email: string, password: string) {
    const info = await Device.getInfo();
    const device_name = `${info.platform} ${info.model}`.slice(0, 60);

    const respuesta = await api<{ token: string; usuario: Usuario }>('/login', {
      method: 'POST',
      body: { email, password, device_name },
    });

    token.value = respuesta.token;
    usuario.value = respuesta.usuario;
    await SecureStorage.set(CLAVE_TOKEN, respuesta.token);
    await SecureStorage.set(CLAVE_USUARIO, respuesta.usuario as unknown as Record<string, unknown>);
  }

  async function cargarToken() {
    if (tokenCargado) return;
    try {
      const guardado = await SecureStorage.get(CLAVE_TOKEN);
      const usuarioGuardado = await SecureStorage.get(CLAVE_USUARIO);
      if (typeof guardado === 'string' && guardado) {
        token.value = guardado;
        usuario.value = (usuarioGuardado as unknown as Usuario | null) ?? null;
      }
    } catch {
    } finally {
      tokenCargado = true;
    }
  }

  async function cerrarSesion() {
    try {
      await api('/logout', { method: 'POST' });
    } catch {
    } finally {
      await olvidarSesion();
    }
  }

  return { usuario, estaAutenticado, login, cargarToken, cerrarSesion };
}
