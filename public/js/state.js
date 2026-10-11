import { api } from './api.js';
export const state = { me: null };
export async function refreshMe() { const d = await api.get('/api/me'); state.me = d.user ? d : null; return state.me; }
export const go = (hash) => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; };
