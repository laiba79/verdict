import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Keep the Authorization header on THIS instance in sync with the stored
// token. AuthContext calls this after login/logout. (Setting headers on the
// global `axios` object would NOT affect this instance, since axios.create()
// makes an independent instance with its own defaults.)
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

// FastAPI validation errors (422) come back as detail: [{loc, msg, type}, ...]
// rather than a plain string. Everything else is usually detail: "string".
// Normalize both shapes into one readable message for the UI.
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const detail = (err as any)?.response?.data?.detail;
  if (!detail) {
    if ((err as any)?.message === 'Network Error') {
      return 'Cannot reach the server. Make sure the backend is running on http://localhost:8000.';
    }
    return fallback;
  }
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : 'field';
        return `${field}: ${d.msg}`;
      })
      .join(' · ');
  }
  return fallback;
}

export default api;
