// API client + small formatting helpers.

export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'takshashila', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  // Session expired or account deactivated mid-use: let the app sign out and route to the sign-in page.
  if (res.status === 401 && !url.startsWith('/api/auth/')) window.dispatchEvent(new Event('tk:signed-out'));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Something went wrong. Check your connection and try again.', data.fields);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  patch: (url, body = {}) => request('PATCH', url, body),
  del: (url) => request('DELETE', url),
};

/** Upload one document to a student application. */
export const uploadFile = (appId, docType, file, onProgress) =>
  uploadTo(`/api/applications/${appId}/documents/${encodeURIComponent(docType)}`, file, onProgress);

/** Upload one file as the raw request body to `url`, reporting progress (0..1). `headers` adds e.g. a geo-tag. */
export function uploadTo(url, file, onProgress, headers = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('X-Requested-With', 'takshashila');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, data.error || 'Upload failed.'));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed. Check your connection and try again.'));
    xhr.send(file);
  });
}

export function inr(v) {
  if (v === null || v === undefined || v === '') return '—';
  return '₹' + Math.round(Number(v)).toLocaleString('en-IN');
}

export function niceDate(v, withTime = false) {
  if (!v) return '—';
  // 'YYYY-MM-DD' is a calendar date (show as-is); anything longer is an ISO timestamp from the API.
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return v;
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return withTime ? `${date}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : date;
}

export const initials = (name) => (name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const fileSize = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);
export const cx = (...c) => c.filter(Boolean).join(' ');

/** Where a signed-in user belongs. */
export const homeFor = (auth) => ({ student: auth.hasApplication ? '/me' : '/apply', school: '/school' }[auth.user.role] || '/staff');

/** The phone's current position, or null if location is blocked, unavailable or too slow. */
export function getPosition({ timeout = 15000, maximumAge = 60000 } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => resolve(null), { enableHighAccuracy: true, timeout, maximumAge });
  });
}

export const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
