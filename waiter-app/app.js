const state = {
  menu: [],
  activeCategory: "ramen",
  cart: [],
  promo: {
    isThursday: false,
    manualOverrideEnabled: false,
    promoActive: false
  },
  wizard: {
    open: false,
    step: 0,
    ramen: null
  }
};

const categoryTitles = {
  ramen: "Ramen",
  extras: "Extras",
  sides: "Acompañamientos",
  drinks: "Bebidas"
};

const categoryButtons = document.querySelectorAll(".category");
const productGrid = document.getElementById("productGrid");
const categoryTitle = document.getElementById("categoryTitle");
const cartItems = document.getElementById("cartItems");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");
const orderStatus = document.getElementById("orderStatus");

const backendInput = document.getElementById("backendUrl");
const saveBackend = document.getElementById("saveBackend");
const promoButton = document.createElement("button");
promoButton.id = "promoToggle";
promoButton.type = "button";
promoButton.className = saveBackend.className;
saveBackend.parentElement.appendChild(promoButton);

const wizardModal = document.getElementById("ramenWizard");
const wizardStep = document.getElementById("wizardStep");
const wizardTitle = document.getElementById("wizardTitle");
const wizardBack = document.getElementById("wizardBack");
const wizardNext = document.getElementById("wizardNext");
const closeWizard = document.getElementById("closeWizard");

function formatPrice(value) {
  return `$${value.toFixed(0)}`;
}

function getMenuByCategory(category) {
  return state.menu.filter((item) => item.category === category);
}

function getProductById(id) {
  return state.menu.find((item) => item.id === id);
}

function setStatus(message) {
  orderStatus.textContent = message;
  setTimeout(() => {
    if (orderStatus.textContent === message) {
      orderStatus.textContent = "";
    }
  }, 3000);
}

function renderCategories() {
  categoryButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.category === state.activeCategory);
  });
  categoryTitle.textContent = categoryTitles[state.activeCategory];
}

function renderProducts() {
  productGrid.innerHTML = "";
  const products = getMenuByCategory(state.activeCategory);

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const image = document.createElement("img");
    image.src = `assets/menu/${product.image}`;
    image.alt = product.name;

    const name = document.createElement("h3");
    name.textContent = product.name;

    const price = document.createElement("p");
    price.className = "price";
    if (product.prices) {
      price.textContent = `M ${formatPrice(product.prices.M)} / G ${formatPrice(product.prices.G)}`;
    } else {
      price.textContent = formatPrice(product.price || 0);
    }

    card.append(image, name, price);

    if (product.category === "ramen") {
      const button = document.createElement("button");
      button.className = "primary";
      button.textContent = "Configurar";
      button.addEventListener("click", () => openWizard(product));
      card.appendChild(button);
    } else {
      const qtyControl = buildQtyControl(product.id, getCartQty(product.id));
      card.appendChild(qtyControl);
    }

    productGrid.appendChild(card);
  });
}

function buildQtyControl(productId, qty) {
  const wrapper = document.createElement("div");
  wrapper.className = "qty-control";

  const minus = document.createElement("button");
  minus.textContent = "-";
  minus.addEventListener("click", () => adjustCartItem(productId, -1));

  const count = document.createElement("span");
  count.textContent = qty;

  const plus = document.createElement("button");
  plus.textContent = "+";
  plus.addEventListener("click", () => adjustCartItem(productId, 1));

  wrapper.append(minus, count, plus);
  return wrapper;
}

function getCartQty(productId) {
  const item = state.cart.find((entry) => entry.productId === productId && !entry.meta);
  return item ? item.qty : 0;
}

function adjustCartItem(productId, delta) {
  const product = getProductById(productId);
  if (!product) return;

  let item = state.cart.find((entry) => entry.productId === productId && !entry.meta);
  if (!item && delta > 0) {
    item = {
      id: `cart-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      productId: product.id,
      name: product.name,
      qty: 0,
      unitPrice: product.price || 0
    };
    state.cart.push(item);
  }

  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      state.cart = state.cart.filter((entry) => entry !== item);
    }
  }

  renderProducts();
  renderCart();
}

function renderCart() {
  cartItems.innerHTML = "";

  if (state.cart.length === 0) {
    cartItems.innerHTML = "<p>No hay items aún.</p>";
  }

  state.cart.forEach((item) => {
    const wrapper = document.createElement("div");
    wrapper.className = "cart-item";

    const header = document.createElement("div");
    header.className = "cart-item-header";

    const title = document.createElement("strong");
    title.textContent = item.name;

    const price = document.createElement("span");
    price.textContent = formatPrice(item.unitPrice * item.qty);

    header.append(title, price);

    if (item.meta) {
      const detail = document.createElement("small");
      detail.textContent = buildRamenDetail(item.meta);

      const removeBtn = document.createElement("button");
      removeBtn.className = "ghost";
      removeBtn.textContent = "Quitar";
      removeBtn.addEventListener("click", () => removeCartItem(item.id));

      wrapper.append(header, detail, removeBtn);
    } else {
      const controls = buildQtyControl(item.productId, item.qty);
      wrapper.append(header, controls);
    }

    cartItems.appendChild(wrapper);
  });

  const totals = calculateTotals();
  subtotalEl.textContent = formatPrice(totals.subtotal);
  const totalToShow = typeof totals.totalFinal === "number" ? totals.totalFinal : totals.total;
  totalEl.textContent = formatPrice(totalToShow);
}

function removeCartItem(id) {
  state.cart = state.cart.filter((item) => item.id !== id);
  renderCart();
  renderProducts();
}

function calculateTotals() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const promoDiscount = calculatePromoDiscountForCart();
  const total = subtotal;
  const totalFinal = promoDiscount > 0 ? Math.max(total - promoDiscount, 0) : total;
  return {
    subtotal,
    total,
    promoDiscount,
    totalFinal
  };
}

function calculatePromoDiscountForCart() {
  if (!state.promo.promoActive) {
    return 0;
  }
  const prices = [];
  state.cart.forEach((item) => {
    if (typeof item.unitPrice !== "number" || typeof item.qty !== "number") {
      return;
    }
    const product = getProductById(item.productId);
    if (!product || product.category !== "ramen") {
      return;
    }
    for (let i = 0; i < item.qty; i += 1) {
      prices.push(item.unitPrice);
    }
  });
  prices.sort((a, b) => b - a);
  let discount = 0;
  for (let i = 1; i < prices.length; i += 2) {
    discount += prices[i];
  }
  return discount;
}

function buildRamenDetail(meta) {
  const extras = meta.extras && meta.extras.length
    ? ` | Extras: ${meta.extras.map((extra) => `${extra.name} x${extra.qty}`).join(", ")}`
    : "";
  return `Tamaño ${meta.size} · Picante ${meta.spicy}${extras}`;
}

function openWizard(ramen) {
  state.wizard.open = true;
  state.wizard.step = 0;
  state.wizard.ramen = {
    base: ramen,
    size: null,
    spicy: null,
    extras: {}
  };
  wizardTitle.textContent = ramen.name;
  wizardModal.classList.remove("hidden");
  renderWizardStep();
}

function closeWizardModal() {
  state.wizard.open = false;
  wizardModal.classList.add("hidden");
}

function renderWizardStep() {
  const { ramen, step } = state.wizard;
  wizardStep.innerHTML = "";
  wizardBack.disabled = step === 0;

  if (!ramen) return;

  if (step === 0) {
    wizardStep.innerHTML = `
      <h3>1. Elige tamaño</h3>
      <div class="option-grid">
        ${["M", "G"].map((size) => `
          <div class="option-card ${ramen.size === size ? "selected" : ""}" data-size="${size}">
            <h4>${size === "M" ? "Mediano" : "Grande"}</h4>
            <p class="price">${formatPrice(ramen.base.prices[size])}</p>
          </div>
        `).join("")}
      </div>
    `;
    wizardNext.textContent = "Siguiente";
  }

  if (step === 1) {
    const spicyOptions = getMenuByCategory("spicy");
    wizardStep.innerHTML = `
      <h3>2. Elige picante</h3>
      <div class="option-grid">
        ${spicyOptions.map((option) => `
          <div class="option-card ${ramen.spicy === Number(option.id.split("_")[1]) ? "selected" : ""}" data-spicy="${option.id}">
            <img src="assets/menu/${option.image}" alt="${option.name}" />
            <h4>${option.name}</h4>
          </div>
        `).join("")}
      </div>
    `;
    wizardNext.textContent = "Siguiente";
  }

  if (step === 2) {
    const extras = getMenuByCategory("extras");
    wizardStep.innerHTML = `
      <h3>3. Agrega extras</h3>
      <div class="option-grid">
        ${extras.map((extra) => {
          const qty = ramen.extras[extra.id] || 0;
          return `
            <div class="option-card">
              <img src="assets/menu/${extra.image}" alt="${extra.name}" />
              <h4>${extra.name}</h4>
              <p class="price">${formatPrice(extra.price)}</p>
              <div class="qty-control" data-extra="${extra.id}">
                <button class="extra-minus">-</button>
                <span>${qty}</span>
                <button class="extra-plus">+</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
    wizardNext.textContent = "Siguiente";
  }

  if (step === 3) {
    const extrasList = Object.entries(ramen.extras)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const extra = getProductById(id);
        return `${extra.name} x${qty}`;
      });

    wizardStep.innerHTML = `
      <h3>4. Confirmar ramen</h3>
      <p><strong>Tamaño:</strong> ${ramen.size === "M" ? "Mediano" : "Grande"}</p>
      <p><strong>Picante:</strong> ${ramen.spicy}</p>
      <p><strong>Extras:</strong> ${extrasList.length ? extrasList.join(", ") : "Sin extras"}</p>
    `;
    wizardNext.textContent = "Agregar al carrito";
  }
}

wizardStep.addEventListener("click", (event) => {
  const sizeCard = event.target.closest(".option-card[data-size]");
  const spicyCard = event.target.closest(".option-card[data-spicy]");

  if (sizeCard && state.wizard.step === 0) {
    state.wizard.ramen.size = sizeCard.dataset.size;
    renderWizardStep();
  }

  if (spicyCard && state.wizard.step === 1) {
    const level = Number(spicyCard.dataset.spicy.split("_")[1]);
    state.wizard.ramen.spicy = level;
    renderWizardStep();
  }

  if (state.wizard.step === 2) {
    const extraControl = event.target.closest(".qty-control");
    if (extraControl) {
      const extraId = extraControl.dataset.extra;
      if (event.target.classList.contains("extra-plus")) {
        state.wizard.ramen.extras[extraId] = (state.wizard.ramen.extras[extraId] || 0) + 1;
      }
      if (event.target.classList.contains("extra-minus")) {
        state.wizard.ramen.extras[extraId] = Math.max((state.wizard.ramen.extras[extraId] || 0) - 1, 0);
      }
      renderWizardStep();
    }
  }
});

wizardBack.addEventListener("click", () => {
  if (state.wizard.step > 0) {
    state.wizard.step -= 1;
    renderWizardStep();
  }
});

wizardNext.addEventListener("click", () => {
  const { step, ramen } = state.wizard;

  if (step === 0 && !ramen.size) {
    return setStatus("Selecciona un tamaño.");
  }

  if (step === 1 && !ramen.spicy) {
    return setStatus("Selecciona nivel de picante.");
  }

  if (step < 3) {
    state.wizard.step += 1;
    renderWizardStep();
    return;
  }

  addRamenToCart();
  closeWizardModal();
});

closeWizard.addEventListener("click", closeWizardModal);

function addRamenToCart() {
  const ramen = state.wizard.ramen;
  if (!ramen) return;

  const extras = Object.entries(ramen.extras)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const extra = getProductById(id);
      return {
        productId: extra.id,
        name: extra.name,
        qty,
        unitPrice: extra.price
      };
    });

  const extrasTotal = extras.reduce((sum, extra) => sum + extra.unitPrice * extra.qty, 0);
  const basePrice = ramen.base.prices[ramen.size];

  state.cart.push({
    id: `ramen-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    productId: ramen.base.id,
    name: ramen.base.name,
    qty: 1,
    unitPrice: basePrice + extrasTotal,
    meta: {
      size: ramen.size,
      spicy: ramen.spicy,
      extras
    }
  });

  renderCart();
}

async function sendOrder() {
  if (state.cart.length === 0) {
    setStatus("Agrega productos antes de enviar.");
    return;
  }
  const totals = calculateTotals();
  const payload = {
    items: state.cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      meta: item.meta || {}
    })),
    totals: {
      subtotal: totals.subtotal,
      total: totals.total
    }
  };

  try {
    const response = await fetch(`${window.DEKU_CONFIG.baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Error al enviar la orden");
    }

    state.cart = [];
    renderCart();
    renderProducts();
    setStatus("Orden enviada a cocina.");
  } catch (error) {
    console.error(error);
    setStatus("No se pudo enviar. Revisa conexión.");
  }
}

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.activeCategory = button.dataset.category;
    renderCategories();
    renderProducts();
  });
});

saveBackend.addEventListener("click", () => {
  const value = backendInput.value.trim();
  if (value) {
    localStorage.setItem("DEKU_BACKEND_URL", value);
    window.DEKU_CONFIG.baseUrl = value;
    setStatus("URL backend guardada.");
    loadPromoStatus();
  }
});

backendInput.value = window.DEKU_CONFIG.baseUrl;

function updatePromoButton() {
  if (state.promo.isThursday) {
    promoButton.textContent = "2x1 AUTO";
    promoButton.disabled = true;
    return;
  }
  promoButton.disabled = false;
  if (state.promo.manualOverrideEnabled) {
    promoButton.textContent = "2x1 ON";
  } else {
    promoButton.textContent = "2x1 OFF";
  }
}

async function loadPromoStatus() {
  try {
    const response = await fetch(`${window.DEKU_CONFIG.baseUrl}/api/promo`);
    if (!response.ok) {
      throw new Error("No se pudo cargar promo");
    }
    const data = await response.json();
    state.promo = {
      isThursday: Boolean(data.isThursday),
      manualOverrideEnabled: Boolean(data.manualOverrideEnabled),
      promoActive: Boolean(data.promoActive)
    };
  } catch (error) {
    console.error(error);
    state.promo = {
      isThursday: false,
      manualOverrideEnabled: false,
      promoActive: false
    };
  }
  updatePromoButton();
  renderCart();
}

async function updatePromoOverride(enabled) {
  try {
    const response = await fetch(`${window.DEKU_CONFIG.baseUrl}/api/promo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manualOverrideEnabled: enabled })
    });
    if (!response.ok) {
      throw new Error("No se pudo actualizar promo");
    }
    const data = await response.json();
    state.promo = {
      isThursday: Boolean(data.isThursday),
      manualOverrideEnabled: Boolean(data.manualOverrideEnabled),
      promoActive: Boolean(data.promoActive)
    };
  } catch (error) {
    console.error(error);
    setStatus("No se pudo actualizar promo.");
  }
  updatePromoButton();
  renderCart();
}

promoButton.addEventListener("click", async () => {
  if (state.promo.isThursday) {
    return;
  }
  if (!state.promo.manualOverrideEnabled) {
    const confirmed = confirm(
      "⚠️ Estás activando 2x1 fuera de jueves. Esto quedará registrado. ¿Continuar?"
    );
    if (!confirmed) {
      return;
    }
    await updatePromoOverride(true);
  } else {
    await updatePromoOverride(false);
  }
});

async function init() {
  try {
    const response = await fetch(`${window.DEKU_CONFIG.baseUrl}/api/menu`);
    const data = await response.json();
    state.menu = data.products || [];
    renderCategories();
    renderProducts();
    renderCart();
  } catch (error) {
    console.error(error);
    setStatus("No se pudo cargar menú.");
  }
  await loadPromoStatus();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((error) => console.error(error));
  }
}

init();

document.getElementById("sendOrder").addEventListener("click", sendOrder);
