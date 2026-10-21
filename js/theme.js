// Light/dark theme choice, kept on this device. index.html applies it before first paint.
const KEY = 'theme'; // 'light' | 'dark' | 'auto' (follow the phone)

export function getTheme() {
  try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; }
}

export function setTheme(t) {
  try { localStorage.setItem(KEY, t); } catch { /* storage unavailable: applies until the app closes */ }
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
