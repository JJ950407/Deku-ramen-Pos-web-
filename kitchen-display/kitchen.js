const ordersContainer = document.getElementById("orders");
const connectionStatus = document.getElementById("connectionStatus");
const BASE_URL = window.location.origin;

let orders = [];

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildItemLine(item) {
  if (item.meta && item.meta.size) {
    const extras = item.meta.extras && item.meta.extras.length
      ? ` | Extras: ${item.meta.extras.map((extra) => `${extra.name} x${extra.qty}`).join(", ")}`
      : "";
    return `${item.qty}x ${item.name} (${item.meta.size}, Picante ${item.meta.spicy}${extras})`;
  }
  return `${item.qty}x ${item.name}`;
}

function renderOrders() {
  ordersContainer.innerHTML = "";
  if (orders.length === 0) {
    ordersContainer.innerHTML = "<p>No hay órdenes por ahora.</p>";
    return;
  }

  orders.forEach((order) => {
    const card = document.createElement("div");
    card.className = "order-card";

    const header = document.createElement("div");
    header.className = "order-header";
    header.innerHTML = `
      <div>
        <strong>${order.id.split("-").slice(-1)[0]}</strong>
        <div class="small">${formatTime(order.createdAt)}</div>
      </div>
      <span class="badge ${order.status}">${order.status}</span>
    `;

    const items = document.createElement("div");
    items.className = "order-items";
    order.items.forEach((item) => {
      const line = document.createElement("div");
      line.textContent = buildItemLine(item);
      items.appendChild(line);
    });

    if (order.notes) {
      const notes = document.createElement("div");
      notes.className = "small";
      notes.textContent = `Notas: ${order.notes}`;
      items.appendChild(notes);
    }

    const actions = document.createElement("div");
    actions.className = "order-actions";

    const preparingBtn = document.createElement("button");
    preparingBtn.className = "prepare";
    preparingBtn.textContent = "EN PREPARACIÓN";
    preparingBtn.addEventListener("click", () => updateStatus(order.id, "preparing"));

    const readyBtn = document.createElement("button");
    readyBtn.className = "ready";
    readyBtn.textContent = "LISTO";
    readyBtn.addEventListener("click", () => updateStatus(order.id, "ready"));

    actions.append(preparingBtn, readyBtn);

    card.append(header, items, actions);
    ordersContainer.appendChild(card);
  });
}

async function fetchOrders() {
  const response = await fetch(`${BASE_URL}/api/orders`);
  orders = await response.json();
  renderOrders();
}

async function updateStatus(id, status) {
  await fetch(`${BASE_URL}/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
}

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${window.location.host}`);

  socket.addEventListener("open", () => {
    connectionStatus.textContent = "En vivo";
  });

  socket.addEventListener("close", () => {
    connectionStatus.textContent = "Desconectado";
    setTimeout(connectWebSocket, 2000);
  });

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.event === "order:new") {
      orders.push(payload.data);
      renderOrders();
    }
    if (payload.event === "order:updated") {
      orders = orders.map((order) => order.id === payload.data.id ? payload.data : order);
      renderOrders();
    }
  });
}

fetchOrders().catch(console.error);
connectWebSocket();
