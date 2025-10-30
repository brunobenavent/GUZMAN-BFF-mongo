// src/services/auth.service.ts
import axios from 'axios';
import 'dotenv/config';
// *** CORRECCIÓN: La importación correcta es 'wrapper' ***
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { cookieJar } from './apiClient'; // Importa el cookieJar

interface LoginResponse {
  token: string;
  expiresIn: number;
}

let sessionCache = {
  accessToken: null as string | null,
  expiresAt: 0,
};

async function login(): Promise<string> {
  try {
    console.log('[AuthService] Realizando login en la API de terceros...');
    const baseURL = process.env.THIRD_PARTY_API_URL;
    if (!baseURL) throw new Error('THIRD_PARTY_API_URL no está definida');
    
    console.log(`[AuthService DEBUG] Usando baseURL: ${baseURL}`);
    const authClient = axios.create({ baseURL, withCredentials: true });
    axiosCookiejarSupport(authClient);
    authClient.defaults.jar = cookieJar;

    const loginParams = {
      name: process.env.THIRD_PARTY_USERNAME,
      password: process.env.THIRD_PARTY_PASSWORD,
    };
    const loginEndpoint = '/autentificar';
    console.log(`[AuthService DEBUG] Intentando GET a ${baseURL}${loginEndpoint}`);
    
    const response = await authClient.get<LoginResponse>(loginEndpoint, { params: loginParams });
    const { token, expiresIn } = response.data;
    console.log(`[AuthService DEBUG] Respuesta Login Raw: ${JSON.stringify(response.data)}`);

    let effectiveExpiresIn = expiresIn;
    if (typeof expiresIn !== 'number' || expiresIn <= 0) {
      console.warn(`[AuthService WARN] 'expiresIn' inválido: ${expiresIn}. Usando 3600s.`);
      effectiveExpiresIn = 3600;
    }

    const marginSeconds = 60;
    sessionCache.expiresAt = Date.now() + (effectiveExpiresIn - marginSeconds) * 1000;
    if (!token) throw new Error('Respuesta de login inválida (token faltante)');
    
    sessionCache.accessToken = token;
    const expiryDate = new Date(sessionCache.expiresAt);
    console.log(`[AuthService DEBUG] Token guardado. Válido hasta: ${expiryDate.toISOString()}`);
    console.log('[AuthService] Login exitoso.');
    return token;
  } catch (error: any) {
    console.error('[AuthService] Error al hacer login:', error.message);
    if (axios.isAxiosError(error)) {
        console.error('[AuthService] Detalle Error Axios:', { message: error.message, url: error.config?.url, baseURL: error.config?.baseURL, code: error.code });
    }
    sessionCache.accessToken = null;
    sessionCache.expiresAt = 0;
    throw new Error(`No se pudo autenticar con Dantia: ${error.message}`);
  }
}

/**
 * Función pública usada por el worker (dantia.service).
 * ESTA FUNCIÓN SÍ SE EXPORTA.
 */
export async function ensureValidSession(): Promise<string> {
  const now = Date.now();
  const expiresAt = sessionCache.expiresAt;
  const isValid = !!sessionCache.accessToken && expiresAt > now;

  const nowISO = new Date(now).toISOString();
  const expiresAtISO = expiresAt > 0 ? new Date(expiresAt).toISOString() : 'N/A';
  console.log(`[AuthService Check] Ahora: ${nowISO}, Token Expira: ${expiresAtISO}, ¿Válido?: ${isValid}`);

  if (isValid) {
    return sessionCache.accessToken!;
  }
  console.log('[AuthService] Token no válido o expirado. Refrescando sesión...');
  return await login();
}