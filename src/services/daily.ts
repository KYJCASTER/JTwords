// Daily goal & notification tracking
export interface DailyState { date: string; reviews: number; correct: number; goal: number; notified?: boolean; }
const KEY = 'cet6_daily_v1';
const DEFAULT_GOAL = 30;
function today(): string { return new Date().toISOString().slice(0, 10); }
function load(): DailyState { try { const raw = localStorage.getItem(KEY); if (raw) { const d: DailyState = JSON.parse(raw); if (d.date === today()) return d; return { date: today(), reviews: 0, correct: 0, goal: d.goal || DEFAULT_GOAL }; } } catch { } return { date: today(), reviews: 0, correct: 0, goal: DEFAULT_GOAL }; }
function save(state: DailyState) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { } }
let state = load();
let listeners: ((s: DailyState) => void)[] = [];
export function getDaily(): DailyState { return state; }
function emit() { save(state); listeners.forEach(l => l(state)); }
export function subscribeDaily(fn: (s: DailyState) => void) { listeners.push(fn); return () => { listeners = listeners.filter(x => x !== fn); }; }
export function recordReview(quality: number) { if (state.date !== today()) state = { date: today(), reviews: 0, correct: 0, goal: state.goal }; state.reviews += 1; if (quality >= 3) state.correct += 1; emit(); }
export function setGoal(goal: number) { if (goal <= 0) return; state.goal = goal; emit(); }
let reminderTimer: any; export function scheduleReminder(delayMinutes = 30) { if (!('Notification' in window)) return; if (Notification.permission === 'default') Notification.requestPermission(); clearTimeout(reminderTimer); reminderTimer = setTimeout(() => { if (Notification.permission === 'granted') { if (state.correct < state.goal && !state.notified) { new Notification('继续背单词', { body: `今日进度 ${state.correct}/${state.goal}，再接再厉！` }); state.notified = true; emit(); } } }, delayMinutes * 60 * 1000); }
export function goalRatio(): number { return state.goal ? Math.min(1, state.correct / state.goal) : 0; }
