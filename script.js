const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = "http://localhost:3001";
const WS_URL = "ws://localhost:4001";

let tgId = null;
let ws = null;
let currentMultiplier = 1.0;
let inBet = false;

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
  console.log("LOGIN:", data);

  tgId = data.user.tgId;
  document.getElementById("balance").innerText = data.user.balance;
}

login();

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
      document.getElementById("cashoutBtn").style.display = "none";
      document.getElementById("betBtn").style.display = "inline-block";
      document.getElementById("status").innerText = "Игра началась!";
    }

    if (data.type === "tick") {
      currentMultiplier = data.multiplier;
      document.getElementById("multiplier").innerText = currentMultiplier.toFixed(2) + "x";
    }

    if (data.type === "crash") {
      document.getElementById("status").innerText = "💥 КРАШ: " + data.multiplier + "x";
      document.getElementById("cashoutBtn").style.display = "none";
      document.getElementById("betBtn").style.display = "inline-block";
      inBet = false;
    }

    if (data.type === "bet_accepted") {
      document.getElementById("status").innerText = "Ставка принята!";
      document.getElementById("betBtn").style.display = "none";
      document.getElementById("cashoutBtn").style.display = "inline-block";
      updateBalance(-data.amount);
      inBet = true;
    }

    if (data.type === "cashout_ok") {
      document.getElementById("status").innerText =
        "Вы забрали: " + data.winAmount + " 💰";
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
  document.getElementById("status").innerText = state;
  document.getElementById("multiplier").innerText = multiplier.toFixed(2) + "x";
}

function updateBalance(amount) {
  const el = document.getElementById("balance");
  el.innerText = Number(el.innerText) + amount;
}

// ----------------------
// Ставка
// ----------------------
document.getElementById("betBtn").onclick = () => {
  const amount = Number(document.getElementById("betAmount").value);

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
