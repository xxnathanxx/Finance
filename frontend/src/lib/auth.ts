import axios from "axios";
import { api, clearTokens, setTokens, getRefreshToken } from "./api";

const API_BASE_URL = "http://127.0.0.1:8000";

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer" | string;
};

export type UserOut = {
  id: number;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER" | string;
};

// Considera logado se existe refresh_token (mais estável por causa do refresh flow)
export function isLoggedIn(): boolean {
  return !!getRefreshToken();
}

// LOGIN: precisa ser x-www-form-urlencoded com username/password
export async function login(username: string, password: string): Promise<TokenPair> {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);

  const res = await axios.post<TokenPair>(`${API_BASE_URL}/auth/login`, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  setTokens(res.data);
  return res.data;
}

// CADASTRO: cria a conta (não loga sozinho, precisa chamar login() depois)
export async function registrar(email: string, password: string, name: string): Promise<UserOut> {
  const res = await axios.post<UserOut>(
    `${API_BASE_URL}/auth/register`,
    { email, password, name: name || undefined },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}

// ME: usa api (vai com Authorization automaticamente)
export async function me(): Promise<UserOut> {
  const res = await api.get<UserOut>("/auth/me");
  return res.data;
}

// LOGOUT: seu schema exige refresh_token no body
export async function logout(): Promise<void> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    window.dispatchEvent(new Event("finance:loggedOut"));
    return;
  }

  try {
    await api.post(
      "/auth/logout",
      { refresh_token: refresh },
      { headers: { "Content-Type": "application/json" } }
    );
  } finally {
    clearTokens();
    window.dispatchEvent(new Event("finance:loggedOut"));
  }
}
