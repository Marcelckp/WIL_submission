import axios from "axios";

// API Base URL
// Preferred: set NEXT_PUBLIC_API_BASE_URL in hosting env
// Safe fallback:
// - production: default to deployed Railway API
// - development: default to localhost
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://wilsubmission-production.up.railway.app/api/"
    : "http://localhost:3000/api");

// Normalize: ensure single trailing slash for predictable concatenation
const normalizedBaseUrl = API_BASE_URL.endsWith("/")
  ? API_BASE_URL
  : `${API_BASE_URL}/`;

export const apiClient = axios.create({
  baseURL: normalizedBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (unauthorized)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
