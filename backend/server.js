const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const MENU_PATH = path.join(DATA_DIR, "menu.json");
const ORDERS_PATH = path.join(DATA_DIR, "orders.json");

app.use(express.json({ limit: "1mb" }));

function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return fallback;
  }
}

function safeWriteJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
  }
}

function loadMenu() {
  return safeReadJson(MENU_PATH, { products: [] });
}

function loadOrders() {
  return safeReadJson(ORDERS_PATH, []);
}

function saveOrders(orders) {
  safeWriteJson(ORDERS_PATH, orders);
}

function broadcast(event, data) {
  const message = JSON.stringify({ event, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function generateOrderId() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${Date.now()}-${random}`;
}

function validateOrderPayload(payload) {
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    return "La orden debe incluir items.";
  }
  if (!payload.totals || typeof payload.totals.total !== "number") {
    return "La orden debe incluir totales válidos.";
  }
  return null;
}

app.get("/api/menu", (req, res) => {
  const menu = loadMenu();
  res.json(menu);
});

app.get("/api/orders", (req, res) => {
  const { status } = req.query;
  let orders = loadOrders();
  if (status) {
    orders = orders.filter((order) => order.status === status);
  }
  orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json(orders);
});

app.post("/api/orders", (req, res) => {
  const error = validateOrderPayload(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const orders = loadOrders();
  const order = {
    id: generateOrderId(),
    createdAt: new Date().toISOString(),
    status: "pending",
    items: req.body.items,
    totals: req.body.totals,
    notes: req.body.notes || ""
  };
  orders.push(order);
  saveOrders(orders);
  broadcast("order:new", order);
  res.status(201).json(order);
});

app.patch("/api/orders/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !["pending", "preparing", "ready"].includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }
  const orders = loadOrders();
  const order = orders.find((item) => item.id === id);
  if (!order) {
    return res.status(404).json({ error: "Orden no encontrada." });
  }
  order.status = status;
  saveOrders(orders);
  broadcast("order:updated", order);
  res.json(order);
});

app.use("/kitchen", express.static(path.join(__dirname, "../kitchen-display")));
app.use("/", express.static(path.join(__dirname, "../waiter-app")));

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ event: "connected", data: "ok" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`POS backend running on http://localhost:${PORT}`);
});
