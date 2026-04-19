const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = "https://rocket-backend-z4qb.onrender.com";
const WS_URL = "wss://rocket-backend-z4qb.onrender.com";

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
const betInput = document.getElementById("betAmount");
const autoCashoutInput = document.getElementById("autoCashout");
const betBtn = document.getElementById("betBtn");
const cashoutBtn = document.getElementById("cashoutBtn");

// ----------------------
// Навигация по вкладкам
// ----------------------
const navItems = document.querySelectorAll(".nav-item");
const screens = {
  game: document.getElementById("screen-game"),
  ref: document.getElementById("screen-ref"),
  profile: document.getElementById("screen-profile"),
};

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navItems.forEach((i) => i.classList.remove("active"));
    item.classList.add("active");

    const screen = item.getAttribute("data-screen");
    Object.keys(screens).forEach((key) => {
      screens[key].classList.toggle("active", key === screen);
    });
  });
});

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
  balanceEl.innerText = `${data.user.balance.toFixed ? data.user.balance.toFixed(2) : Number(data.user.balance).toFixed(2)} ★`;
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
      cashoutBtn.style.display = "none";
      betBtn.style.display = "inline-block";
      resetRocket();
    }

    if (data.type === "tick") {
      currentMultiplier = data.multiplier;
      updateMultiplier(currentMultiplier);
      moveRocket(currentMultiplier);

      const auto = Number(autoCashoutInput.value);
      if (inBet && auto > 1 && currentMultiplier >= auto) {
        sendCashout();
      }
    }

    if (data.type === "crash") {
      statusEl.innerText = "💥 КРАШ: " + data.multiplier.toFixed(2) + "x";
      explodeRocket();
      cashoutBtn.style.display = "none";
      betBtn.style.display = "inline-block";
      inBet = false;
      pushHistory(data.multiplier);
    }

    if (data.type === "bet_accepted") {
      statusEl.innerText = "Ставка принята!";
      betBtn.style.display = "none";
      cashoutBtn.style.display = "inline-block";
      updateBalance(-data.amount);
      inBet = true;
    }

    if (data.type === "cashout_ok") {
      statusEl.innerText = "Вы забрали: " + data.winAmount + " ★";
      updateBalance(data.winAmount);
      cashoutBtn.style.display = "none";
      betBtn.style.display = "inline-block";
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

function updateBalance(delta) {
  const current = Number(balanceEl.innerText.replace("★", "").trim());
  const next = current + delta;
  balanceEl.innerText = next.toFixed(2) + " ★";
}

// ----------------------
// Ракета
// ----------------------
function resetRocket() {
  rocketEl.classList.remove("exploded");
  rocketEl.style.opacity = "1";
  moveRocket(1.0);
}

function moveRocket(multiplier) {
  const clamped = Math.min(multiplier, 6);
  const progress = (clamped - 1) / 5; // 0..1
  const bottomPercent = 12 + progress * 60;
  const leftOffset = 10 + progress * 60;

  rocketEl.style.bottom = bottomPercent + "%";
  rocketEl.style.left = leftOffset + "%";
  rocketEl.style.transform = `translate(-50%, 0) rotate(${ -35 + progress * 10 }deg)`;
}

function explodeRocket() {
  rocketEl.classList.add("exploded");
}

// ----------------------
// Ставка / кэш-аут
// ----------------------
betBtn.onclick = () => {
  const amount = Number(betInput.value);
  if (!amount || amount <= 0) return;

  ws.send(JSON.stringify({
    type: "bet",
    tgId,
    amount
  }));
};

function sendCashout() {
  ws.send(JSON.stringify({
    type: "cashout",
    tgId,
    multiplier: currentMultiplier
  }));
}

cashoutBtn.onclick = () => {
  sendCashout();
};

// ----------------------
// Чипы ставок
// ----------------------
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const amount = Number(chip.getAttribute("data-amount"));
    betInput.value = amount;
  });
});

// ----------------------
// Пополнить / Вывести (пока заглушки)
// ----------------------
document.getElementById("depositBtn").onclick = () => {
  tg.showAlert("Пополнение через Stars добавим следующим шагом.");
};

document.getElementById("withdrawBtn").onclick = () => {
  tg.showAlert("Вывод через Stars тоже скоро подключим.");
};
