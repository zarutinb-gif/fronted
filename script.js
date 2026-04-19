const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = "http://localhost:3001";
const WS_URL = "ws://localhost:4001";

let tgId = null;
let ws = null;
let currentMultiplier = 1.0;
let inBet = false;
let history = [];

const rocketEl = document.getElementById("rocket");
const multiplierEl = document.getElementById("multiplier");
const statusEl = document.getElementById("status");
const balanceEl = document.getElementById("balance");
const historyEl = document.getElementById("history");

// ----------------------
// Авторизация
// ----------------------
async function login() {
  const initData = tg.initData;

  const res = await fetch(API_URL + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData })
  });

  const data = await res.json();
  tgId = data.user.tgId;
  balanceEl.innerText = data.user.balance;
}

login();

// ----------------------
// История коэффициентов
// ----------------------
function pushHistory(mult) {
  history.unshift(mult);
  if (history.length > 10) history.pop();
  renderHistory();
}

function renderHistory() {
  historyEl.innerHTML = "";
  history.forEach((m) => {
    const span = document.createElement("span");
    span.classList.add("history-item");

    if (m >= 3) span.classList.add("good");
    else if (m >= 1.5) span.classList.add("mid");
    else span.classList.add("bad");

    span.textContent = m.toFixed(2) + "x";
    historyEl.appendChild(span);
  });
}

// ----------------------
// WebSocket
// ----------------------
function connectWS() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => console.log("WS connected");

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);

    if (data.type === "state") {
      updateState(data.state, data.multiplier);
    }

    if (data.type === "game_start") {
      inBet = false;
      statusEl.innerText = "Новый раунд!";
      document.getElementById("cashoutBtn").style.display = "none";
      document.getElementById("betBtn").style.display = "inline-block";
      resetRocket();
    }

    if (data.type === "tick") {
      currentMultiplier = data.multiplier;
      updateMultiplier(currentMultiplier);
      moveRocket(currentMultiplier);
    }

    if (data.type === "crash") {
      statusEl.innerText = "💥 КРАШ: " + data.multiplier.toFixed(2) + "x";
      explodeRocket();
      document.getElementById("cashoutBtn").style.display = "none";
      document.getElementById("betBtn").style.display = "inline-block";
      inBet = false;
      pushHistory(data.multiplier);
    }

    if (data.type === "bet_accepted") {
      statusEl.innerText = "Ставка принята!";
      document.getElementById("betBtn").style.display = "none";
      document.getElementById("cashoutBtn").style.display = "inline-block";
      updateBalance(-data.amount);
      inBet = true;
    }

    if (data.type === "cashout_ok") {
      statusEl.innerText = "Вы забрали: " + data.winAmount + " 💰";
      updateBalance(data.winAmount);
      document.getElementById("cashoutBtn").style.display = "none";
      document.getElementById("betBtn").style.display = "inline-block";
      inBet = false;
    }
  };
}

connectWS();

// ----------------------
// UI helpers
// ----------------------
function updateState(state, multiplier) {
  statusEl.innerText = state;
  updateMultiplier(multiplier);
}

function updateMultiplier(multiplier) {
  multiplierEl.innerText = multiplier.toFixed(2) + "x";
}

function updateBalance(amount) {
  balanceEl.innerText = Number(balanceEl.innerText) + amount;
}

// ----------------------
// Ракета: движение и взрыв
// ----------------------
function resetRocket() {
  rocketEl.classList.remove("exploded");
  rocketEl.style.opacity = "1";
  moveRocket(1.0);
}

function moveRocket(multiplier) {
  // multiplier 1.0 → низ, 5.0+ → вверх
  const clamped = Math.min(multiplier, 6);
  const progress = (clamped - 1) / 5; // 0..1
  const bottomPercent = 12 + progress * 60; // от 12% до 72%
  const leftOffset = 10 + progress * 60; // от 10% до 70%

  rocketEl.style.bottom = bottomPercent + "%";
  rocketEl.style.left = leftOffset + "%";
  rocketEl.style.transform = `translate(-50%, 0) rotate(${ -35 + progress * 10 }deg)`;
}

function explodeRocket() {
  rocketEl.classList.add("exploded");
}

// ----------------------
// Ставка
// ----------------------
document.getElementById("betBtn").onclick = () => {
  const amount = Number(document.getElementById("betAmount").value);
  if (!amount || amount <= 0) return;

  ws.send(JSON.stringify({
    type: "bet",
    tgId,
    amount
  }));
};

// ----------------------
// Кэш-аут
// ----------------------
document.getElementById("cashoutBtn").onclick = () => {
  ws.send(JSON.stringify({
    type: "cashout",
    tgId,
    multiplier: currentMultiplier
  }));
};
