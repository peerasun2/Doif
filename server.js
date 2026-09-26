const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = (process.env.ADMIN_KEY || 'lamphun').trim();
const isAdmin = (key) => String(key || '').trim() === ADMIN_KEY;
const MAX_VOTERS = Number(process.env.MAX_VOTERS || 171);
const DURATION_MS = Number(process.env.DURATION_SEC || 300) * 1000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// status: 'waiting' | 'open' | 'closed'
let state;
let timer = null;

function reset() {
  clearTimeout(timer);
  state = {
    status: 'waiting',
    endsAt: null,
    closeReason: null,
    votes: { trust: 0, stop: 0 },
    voters: new Set(),
  };
}
reset();

function publicState() {
  return {
    status: state.status,
    endsAt: state.endsAt,
    serverNow: Date.now(),
    closeReason: state.closeReason,
    votes: state.votes,
    total: state.votes.trust + state.votes.stop,
    maxVoters: MAX_VOTERS,
    durationMs: DURATION_MS,
  };
}

function broadcast() {
  io.emit('state', publicState());
}

function close(reason) {
  if (state.status !== 'open') return;
  clearTimeout(timer);
  state.status = 'closed';
  state.closeReason = reason;
  broadcast();
}

io.on('connection', (socket) => {
  socket.emit('state', publicState());

  socket.on('checkVoted', (voterId, ack) => {
    if (typeof ack === 'function') ack(state.voters.has(String(voterId)));
  });

  socket.on('vote', ({ voterId, choice } = {}, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    voterId = String(voterId || '');
    if (!voterId) return reply({ ok: false, error: 'ไม่พบรหัสผู้โหวต' });
    if (state.status === 'waiting') return reply({ ok: false, error: 'ยังไม่เปิดโหวต' });
    if (state.status === 'closed') return reply({ ok: false, error: 'ปิดโหวตแล้ว' });
    if (choice !== 'trust' && choice !== 'stop') return reply({ ok: false, error: 'ตัวเลือกไม่ถูกต้อง' });
    if (state.voters.has(voterId)) return reply({ ok: false, error: 'คุณโหวตไปแล้ว', voted: true });

    state.voters.add(voterId);
    state.votes[choice] += 1;
    reply({ ok: true, choice });

    if (state.voters.size >= MAX_VOTERS) close('full');
    else broadcast();
  });

  socket.on('admin:start', (key, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!isAdmin(key)) return reply({ ok: false, error: 'รหัสผู้ดูแลไม่ถูกต้อง' });
    if (state.status !== 'waiting') return reply({ ok: false, error: 'เริ่มไปแล้ว — กดรีเซ็ตก่อน' });
    state.status = 'open';
    state.endsAt = Date.now() + DURATION_MS;
    timer = setTimeout(() => close('timeup'), DURATION_MS);
    broadcast();
    reply({ ok: true });
  });

  socket.on('admin:stop', (key, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!isAdmin(key)) return reply({ ok: false, error: 'รหัสผู้ดูแลไม่ถูกต้อง' });
    close('manual');
    reply({ ok: true });
  });

  socket.on('admin:reset', (key, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!isAdmin(key)) return reply({ ok: false, error: 'รหัสผู้ดูแลไม่ถูกต้อง' });
    reset();
    io.emit('reset');
    broadcast();
    reply({ ok: true });
  });
});

server.listen(PORT, () => {
  console.log(`Vote page:  http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin   (key: ${ADMIN_KEY})`);
});
