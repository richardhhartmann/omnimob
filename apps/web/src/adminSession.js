const STORAGE_KEY = "domus.adminSession";

export function loadAdminSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAdminSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  localStorage.removeItem(STORAGE_KEY);
}
