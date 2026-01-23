import axios from "axios";
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = "http://127.0.0.1:8000";

type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer" | string;
};

const STORAGE_KEYS = {
  access: "finance.access_token",
  refresh: "finance.refresh_token",
};

export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.access);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.refresh);
}

export function setTokens(tokens: TokenPair) {
  localStorage.setItem(STORAGE_KEYS.access, tokens.access_token);
  localStorage.setItem(STORAGE_KEYS.refresh, tokens.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEYS.access);
  localStorage.removeItem(STORAGE_KEYS.refresh);
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Coloca access token em toda request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = getAccessToken();
  if (access) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function resolveQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

// Faz refresh token
async function refreshTokens(): Promise<TokenPair> {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("No refresh token");

  const res = await axios.post<TokenPair>(
    `${API_BASE_URL}/auth/refresh`,
    { refresh_token: refresh },
    { headers: { "Content-Type": "application/json" } }
  );

  setTokens(res.data);
  return res.data;
}

// Interceptor de resposta: se 401, tenta refresh e repete
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    // Só trata 401 em requests que existem e ainda não foram retry
    if (!original || original._retry || error.response?.status !== 401) {
      throw error;
    }

    original._retry = true;

    // Se já tem refresh rolando, aguarda na fila
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push((token) => {
          if (!token) return reject(error);
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api.request(original));
        });
      });
    }

    // Inicia refresh
    isRefreshing = true;

    try {
      const tokens = await refreshTokens();
      isRefreshing = false;
      resolveQueue(tokens.access_token);

      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${tokens.access_token}`;
      return api.request(original);
    } catch (_e) {
      isRefreshing = false;
      resolveQueue(null);
      clearTokens();
      throw error;
    }
  }
);
