// Shared rendering for the vote page and the admin page.
const LABELS = { trust: 'ไว้วางใจไปกันต่อ', stop: 'พอแค่นี้' };
let clockOffset = 0;
let current = null;

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function renderState(s) {
  current = s;
  clockOffset = s.serverNow - Date.now();

  const badge = document.getElementById('badge');
  const text = {
    waiting: 'รอเริ่มโหวต',
    open: 'กำลังเปิดโหวต',
    closed: s.closeReason === 'full' ? `ปิดโหวตแล้ว (ครบ ${s.maxVoters} คน)`
          : s.closeReason === 'timeup' ? 'ปิดโหวตแล้ว (หมดเวลา)' : 'ปิดโหวตแล้ว',
  }[s.status];
  badge.textContent = text;
  badge.className = `badge ${s.status}`;

  document.getElementById('total').textContent = s.total;
  document.getElementById('max').textContent = s.maxVoters;

  for (const k of ['trust', 'stop']) {
    const n = s.votes[k];
    const pct = s.total ? Math.round((n / s.total) * 1000) / 10 : 0;
    document.getElementById(`n-${k}`).textContent = n;
    document.getElementById(`p-${k}`).textContent = `${pct}%`;
    document.getElementById(`bar-${k}`).style.width = `${pct}%`;
  }
  tick();
}

function tick() {
  if (!current) return;
  const clock = document.getElementById('clock');
  let left;
  if (current.status === 'waiting') left = current.durationMs;
  else if (current.status === 'open') left = current.endsAt - (Date.now() + clockOffset);
  else left = 0;
  clock.textContent = fmt(left);
  clock.classList.toggle('urgent', current.status === 'open' && left <= 30000);
}
setInterval(tick, 250);
