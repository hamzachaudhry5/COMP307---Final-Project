const BASE_URL = "http://localhost:8000";

function getToken() {
  return localStorage.getItem("access_token");
}

async function fetchAuth(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...options.headers },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Error");
  return res.json();

  // // DEBUG
  // let data;
  // try {
  //   data = await res.json();
  // } catch (e) {
  //   data = null;
  // }

  // if (!res.ok) {
  //   console.error("API ERROR:", data);

  //   const message =
  //     (Array.isArray(data?.detail)
  //       ? data.detail.map(d => d.msg || d.message).join(", ")
  //       : data?.detail) ||
  //     data?.message ||
  //     JSON.stringify(data) ||
  //     "Request failed";

  //   throw new Error(message);
  // }

  // return data;
}

async function fetchPub(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Error");
  return res.json();
}

export const auth = {
  register: (data) => fetchPub("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: async (email, password) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const res = await fetch(`${BASE_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    if (!res.ok) throw new Error("Login failed");
    return res.json();
  },
  me: () => fetchAuth("/auth/me"),
  refresh: (token) => fetchPub("/auth/refresh", { method: "POST", body: JSON.stringify({ refresh_token: token }) }),
  logout: (token) => fetchPub("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: token }) }).catch(() => {}),
};

export const dashboard = { get: () => fetchAuth("/dashboard") };

export const calendar = {
  exportIcs: async () => {
    const res = await fetch(`${BASE_URL}/calendar/export.ics`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error("Failed to export");
    return res.blob();
  },
};

export const slots = {
  create: (data) => fetchAuth("/slots", { method: "POST", body: JSON.stringify(data) }),
  createBulk: (data) => fetchAuth("/slots/bulk", { method: "POST", body: JSON.stringify(data) }),
  getMine: () => fetchAuth("/slots/mine"),
  activate: (id) => fetchAuth(`/slots/${id}/activate`, { method: "PATCH" }),
  update: (id, data) => fetchAuth(`/slots/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id) => fetchAuth(`/slots/${id}`, { method: "DELETE" }),
  getBookers: (id) => fetchAuth(`/slots/${id}/reservations`),
  getByInvite: (token) => fetchAuth(`/slots/invite/${token}`),
  createInviteLink: () => fetchAuth("/slots/invite-link", { method: "POST" }),
  regenerateInviteLink: () => fetchAuth("/slots/invite-link/regenerate", { method: "POST" }),
  getOwners: () => fetchAuth("/slots/owners"),
  getByOwner: (id) => fetchAuth(`/slots/owner/${id}`),
};

export const reservations = {
  create: (slotId) => fetchAuth(`/reservations/${slotId}`, { method: "POST" }),
  cancel: (id) => fetchAuth(`/reservations/${id}`, { method: "DELETE" }),
  getMy: () => fetchAuth("/reservations/me"),
  getOwnerAll: () => fetchAuth("/reservations/owner/all"),
};

export const groupMeetings = {
  create: (data) => fetchAuth("/group-meetings", { method: "POST", body: JSON.stringify(data) }),
  get: (id) => fetchAuth(`/group-meetings/${id}`),
  vote: (id, data) => fetchAuth(`/group-meetings/${id}/vote`, { method: "POST", body: JSON.stringify(data) }),
  getHeatmap: (id) => fetchAuth(`/group-meetings/${id}/heatmap`),
  finalize: (id, optionId, weeks = 1) => fetchAuth(`/group-meetings/${id}/finalize?option_id=${optionId}&recurrence_weeks=${weeks}`, { method: "POST" }),
};

export const meetingRequests = {
  send: (data) => fetchAuth("/meeting-requests", { method: "POST", body: JSON.stringify(data) }),
  getSent: () => fetchAuth("/meeting-requests/sent"),
  getIncoming: () => fetchAuth("/meeting-requests/incoming"),
  accept: (id) => fetchAuth(`/meeting-requests/${id}/accept`, { method: "PATCH" }),
  decline: (id) => fetchAuth(`/meeting-requests/${id}/decline`, { method: "PATCH" }),
};

export default { auth, dashboard, calendar, slots, reservations, groupMeetings, meetingRequests };