const API = '';
let currentPromo = null;
let selectedCurrency = 'RUB';
let catalogData = [];
let currentFilter = '';

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'API error');
  return data;
}

async function loadCatalog() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/catalog');
    catalogData = data.products;
    renderProducts(catalogData);
  } catch (e) {
    grid.innerHTML = '<div class="loading">Ошибка загрузки каталога</div>';
  }
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  const icons = { topup: '&#128176;', key: '&#128273;', subscription: '&#128196;', giftcard: '&#127873;' };
  const typeLabels = { topup: 'Пополнение', key: 'Ключ', subscription: 'Подписка', giftcard: 'Гифт карта' };

  grid.innerHTML = products.map(p => `
    <div class="product-card" data-sku="${p.sku}">
      <div class="product-image">${icons[p.type] || '&#128196;'}</div>
      <div class="product-info">
        <div class="product-name" title="${p.name}">${p.name}</div>
        <div class="product-bottom">
          <span class="product-price">${formatPrice(p.price)}</span>
          <span class="product-type">${typeLabels[p.type] || p.type}</span>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openPurchaseModal(card.dataset.sku));
  });
}

function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
}

// Banner Carousel
let currentSlide = 0;
function initCarousel() {
  const dots = document.querySelectorAll('.dot');
  const slides = document.querySelectorAll('.banner-slide');
  function goTo(n) {
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    currentSlide = (n + 3) % 3;
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
  }
  document.getElementById('bannerPrev').addEventListener('click', () => goTo(currentSlide - 1));
  document.getElementById('bannerNext').addEventListener('click', () => goTo(currentSlide + 1));
  dots.forEach(d => d.addEventListener('click', () => goTo(+d.dataset.index)));
  setInterval(() => goTo(currentSlide + 1), 5000);
}

// Catalog Dropdown
function initCatalogDropdown() {
  const btn = document.getElementById('catalogBtn');
  const dd = document.getElementById('catalogDropdown');
  btn.addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
  document.addEventListener('click', e => {
    if (!dd.contains(e.target) && !btn.contains(e.target)) dd.classList.remove('open');
  });
  dd.querySelectorAll('[data-filter]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      filterProducts(link.dataset.filter);
      dd.classList.remove('open');
    });
  });
}

// Category tabs
function initCategoryTabs() {
  const tabs = document.querySelectorAll('.header-cat');
  tabs.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterProducts(tab.dataset.filter);
    });
  });
  document.getElementById('showAll').addEventListener('click', e => {
    e.preventDefault();
    tabs.forEach(t => t.classList.remove('active'));
    tabs[0].classList.add('active');
    filterProducts('');
  });
}

function filterProducts(type) {
  currentFilter = type;
  const filtered = type ? catalogData.filter(p => p.type === type) : catalogData;
  renderProducts(filtered);
}

// Currency Switcher
function initCurrencySwitcher() {
  const btns = document.querySelectorAll('.currency-btn');
  const symbols = { RUB: '₽', USD: '$', KZT: '₸' };
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCurrency = btn.dataset.currency;
      document.querySelectorAll('.topup-currency').forEach(el => el.textContent = symbols[selectedCurrency]);
    });
  });
}

// Topup Amounts
function initTopupAmounts() {
  const amounts = document.querySelectorAll('.topup-amount');
  const buyBtn = document.querySelector('.topup-buy-btn');
  amounts.forEach(a => {
    a.addEventListener('click', () => {
      amounts.forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      buyBtn.dataset.sku = a.dataset.sku;
    });
  });
  buyBtn.addEventListener('click', () => openPurchaseModal(buyBtn.dataset.sku));
}

// Purchase Modal
async function openPurchaseModal(sku) {
  const product = catalogData.find(p => p.sku === sku);
  if (!product) return;
  const icons = { topup: '&#128176;', key: '&#128273;', subscription: '&#128196;', giftcard: '&#127873;' };
  const modal = document.getElementById('modal');
  const content = document.getElementById('modalContent');

  content.innerHTML = `
    <h3>Покупка товара</h3>
    <div class="modal-product-info">
      <div class="modal-product-icon">${icons[product.type] || '&#128196;'}</div>
      <div class="modal-product-details">
        <div class="modal-product-name">${product.name}</div>
        <div class="modal-product-price" id="modalPrice">${formatPrice(product.price)}</div>
      </div>
    </div>
    <div class="promo-section">
      <div class="promo-row">
        <input type="text" class="promo-input" id="promoInput" placeholder="Промокод">
        <button class="promo-apply-btn" id="promoApplyBtn">Применить</button>
      </div>
      <div class="promo-result" id="promoResult"></div>
      <div class="promo-summary" id="promoSummary" style="display:none">
        <span>Скидка: <span class="discount" id="promoDiscount">-0 ₽</span></span>
        <span class="total" id="promoTotal">${formatPrice(product.price)}</span>
      </div>
    </div>
    <div class="payment-actions">
      <button class="pay-success-btn" id="paySuccessBtn">Оплатить (успех)</button>
      <button class="pay-fail-btn" id="payFailBtn">Оплатить (неуспех)</button>
    </div>
    <div id="orderResult"></div>
  `;

  modal.classList.add('open');
  currentPromo = null;

  document.getElementById('promoApplyBtn').addEventListener('click', async () => {
    const code = document.getElementById('promoInput').value.trim();
    if (!code) return;
    try {
      const result = await api('POST', '/promocodes/validate', { code, amount: product.price, currency: product.currency });
      const el = document.getElementById('promoResult');
      if (result.valid) {
        el.className = 'promo-result success';
        el.textContent = `Промокод применён: -${formatPrice(result.discount)}`;
        document.getElementById('promoSummary').style.display = 'flex';
        document.getElementById('promoDiscount').textContent = '-' + formatPrice(result.discount);
        document.getElementById('promoTotal').textContent = formatPrice(result.finalAmount);
        document.getElementById('modalPrice').textContent = formatPrice(result.finalAmount);
        currentPromo = { code: result.code, discount: result.discount, finalAmount: result.finalAmount };
      } else {
        el.className = 'promo-result error';
        el.textContent = result.error;
        document.getElementById('promoSummary').style.display = 'none';
        currentPromo = null;
      }
    } catch (e) {
      const el = document.getElementById('promoResult');
      el.className = 'promo-result error';
      el.textContent = e.message;
    }
  });

  document.getElementById('paySuccessBtn').addEventListener('click', () => handlePayment(product, true));
  document.getElementById('payFailBtn').addEventListener('click', () => handlePayment(product, false));
}

async function handlePayment(product, success) {
  const resultDiv = document.getElementById('orderResult');
  const btns = document.querySelectorAll('.pay-success-btn, .pay-fail-btn');
  btns.forEach(b => b.disabled = true);

  try {
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div> Создание заказа...</div>';
    const order = await api('POST', '/orders', { sku: product.sku });
    resultDiv.innerHTML = `<div class="order-id">Заказ: ${order.orderId}</div>`;

    if (currentPromo) {
      await api('POST', '/promocodes/apply', { code: currentPromo.code });
    }

    resultDiv.innerHTML += '<div class="loading"><div class="spinner"></div> Обработка оплаты...</div>';
    const eventId = 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await api('POST', '/webhook/payment', {
      event_id: eventId,
      order_id: order.orderId,
      status: success ? 'paid' : 'failed',
      amount: currentPromo ? currentPromo.finalAmount : product.price,
      currency: product.currency,
      created_at: new Date().toISOString()
    });

    if (!success) {
      resultDiv.innerHTML = `
        <div class="order-status">
          <div class="order-status-icon">&#10060;</div>
          <h3>Оплата не прошла</h3>
          <p>Заказ отменён</p>
          <div class="order-id">${order.orderId}</div>
          <button class="order-status-btn" onclick="closeModal()">Закрыть</button>
        </div>`;
      return;
    }

    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div> Выдача ключа...</div>';
    const delivery = await api('POST', `/delivery/${order.orderId}`);

    if (delivery.status === 'delivered') {
      resultDiv.innerHTML = `
        <div class="order-status">
          <div class="order-status-icon">&#9989;</div>
          <h3>Заказ выполнен!</h3>
          <p>Ваш ключ:</p>
          <div class="order-key">${delivery.code}</div>
          <div class="order-id">${order.orderId}</div>
          <button class="order-status-btn" onclick="closeModal()">Закрыть</button>
        </div>`;
    } else if (delivery.status === 'out_of_stock') {
      resultDiv.innerHTML = `
        <div class="order-status">
          <div class="order-status-icon">&#9888;</div>
          <h3>Нет в наличии</h3>
          <p>Ключи закончились. Обратитесь к администратору.</p>
          <div class="order-id">${order.orderId}</div>
          <button class="order-status-btn" onclick="closeModal()">Закрыть</button>
        </div>`;
    } else {
      resultDiv.innerHTML = `
        <div class="order-status">
          <div class="order-status-icon">&#10060;</div>
          <h3>Ошибка выдачи</h3>
          <p>Попробуйте позже или обратитесь к администратору.</p>
          <div class="order-id">${order.orderId}</div>
          <button class="order-status-btn" onclick="closeModal()">Закрыть</button>
        </div>`;
    }
  } catch (e) {
    resultDiv.innerHTML = `<div class="order-status"><div class="order-status-icon">&#10060;</div><h3>Ошибка</h3><p>${e.message}</p></div>`;
  }
  btns.forEach(b => b.disabled = false);
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  currentPromo = null;
}

// Admin Panel
function initAdmin() {
  document.getElementById('adminBtn').addEventListener('click', () => {
    document.getElementById('adminOverlay').classList.add('open');
    loadStuckOrders();
  });
  document.getElementById('adminClose').addEventListener('click', () => {
    document.getElementById('adminOverlay').classList.remove('open');
  });
  document.getElementById('adminOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'stuck') loadStuckOrders();
      else loadAuditTrail();
    });
  });
}

async function loadStuckOrders() {
  const el = document.getElementById('adminTabContent');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/stuck-orders?minutes=0');
    if (!data.length) { el.innerHTML = '<div class="admin-empty">Нет заказов с проблемами</div>'; return; }
    el.innerHTML = `<table class="admin-table"><thead><tr><th>Заказ</th><th>Товар</th><th>Статус</th><th></th></tr></thead><tbody>${data.map(o => `<tr><td>${o.orderId}</td><td>${o.sku}</td><td>${o.status}</td><td><button class="admin-recover-btn" data-order="${o.orderId}">Восстановить</button></td></tr>`).join('')}</tbody></table>`;
    el.querySelectorAll('.admin-recover-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = '...';
        try { await api('POST', '/delivery/' + btn.dataset.order); loadStuckOrders(); }
        catch { btn.textContent = 'Ошибка'; }
      });
    });
  } catch { el.innerHTML = '<div class="admin-empty">Ошибка загрузки</div>'; }
}

async function loadAuditTrail() {
  const el = document.getElementById('adminTabContent');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/audit-trail?limit=50');
    if (!data.trail.length) { el.innerHTML = '<div class="admin-empty">Журнал пуст</div>'; return; }
    el.innerHTML = `<table class="admin-table"><thead><tr><th>Событие</th><th>Заказ</th><th>Статус</th><th>Сумма</th><th>Время</th></tr></thead><tbody>${data.trail.map(p => `<tr><td>${p.eventId}</td><td>${p.orderId}</td><td>${p.status}</td><td>${formatPrice(p.amount)}</td><td>${new Date(p.processedAt).toLocaleString('ru-RU')}</td></tr>`).join('')}</tbody></table>`;
  } catch { el.innerHTML = '<div class="admin-empty">Ошибка загрузки</div>'; }
}

// Modal Close
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadCatalog();
  initCarousel();
  initCatalogDropdown();
  initCategoryTabs();
  initCurrencySwitcher();
  initTopupAmounts();
  initAdmin();
});
