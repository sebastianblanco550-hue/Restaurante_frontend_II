// --- CONFIGURACIÓN DE DESPLIEGUE ---
// Cambia esto por tu URL de Render cuando subas el backend (Ej: "https://mi-api-restaurante.onrender.com")
const BACKEND_DOMAIN = "sistema-restaurante-ii.onrender.com"; 
const isLocalBackend = BACKEND_DOMAIN.includes("localhost") || BACKEND_DOMAIN.includes("127.0.0.1");
const PROTOCOL_HTTP = isLocalBackend ? "http://" : "https://";
const PROTOCOL_WS = isLocalBackend ? "ws://" : "wss://";

const API_BASE = `${PROTOCOL_HTTP}${BACKEND_DOMAIN}/api`;

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("session_token");
    if(token) {
        options.headers = options.headers || {};
        options.headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, options);
}
const WS_BASE = `${PROTOCOL_WS}${BACKEND_DOMAIN}/ws/kitchen`;

let RESTAURANT_ID = localStorage.getItem("session_rest_id") || "";

// Formateador de moneda COP
const formatCOP = (amount) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
};

// --- UTILIDADES GLOBALES Y TEMA ---
function initTheme() {
    const savedTheme = localStorage.getItem('saas_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}
initTheme(); // Ejecutar al cargar la página

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('saas_theme', next);
    
    // Actualizar icono del botón si existe
    const btn = document.getElementById('theme-btn');
    if(btn) btn.innerText = next === 'dark' ? '☀️' : '🌙';
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

function checkSession(requiredRole) {
    const role = localStorage.getItem("session_role");
    const rest = localStorage.getItem("session_rest_id");
    
    // Si no hay sesión, al login
    if (!rest || !role) {
        window.location.href = 'login.html';
        return;
    }
    
    // Asignar dinámicamente si no estaba seteado en la recarga
    RESTAURANT_ID = rest;

    // Si requiere un rol específico, validar. El Admin tiene pase libre a todo.
    if (requiredRole && role !== requiredRole && role !== 'admin') {
        alert("Acceso denegado. Este panel es exclusivo para " + requiredRole);
        window.location.href = 'login.html';
    }
}

function addAdminBackButton() {
    const role = localStorage.getItem("session_role");
    if (role === 'admin') {
        const btn = document.createElement('button');
        btn.innerText = "🔙 Volver al Panel Admin";
        btn.className = "btn";
        btn.style.position = "fixed";
        btn.style.bottom = "20px";
        btn.style.left = "20px";
        btn.style.zIndex = "1000";
        btn.style.boxShadow = "0 10px 25px rgba(0,0,0,0.3)";
        btn.onclick = () => window.location.href = 'admin.html';
        document.body.appendChild(btn);
    }
}

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// --- LÓGICA DE ADMINISTRADOR ---

// TABS & DASHBOARD LÓGICA
function switchTab(tabId) {
    document.querySelectorAll('.section-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`tab-${tabId}`).classList.add('active');
    event.currentTarget.classList.add('active');
}

async function loadDashboard() {
    const dashEarnings = document.getElementById('dash-earnings');
    const dashOrders = document.getElementById('dash-orders');
    const dashTicket = document.getElementById('dash-ticket');
    const dashTopItems = document.getElementById('dash-top-items');
    const dashAlerts = document.getElementById('dash-alerts');
    const dashHistory = document.getElementById('dash-history');
    if(!dashEarnings) return;

    try {
        const res = await apiFetch(`${API_BASE}/dashboard/${RESTAURANT_ID}`);
        if(res.ok) {
            const data = await res.json();
            dashEarnings.innerText = formatCOP(data.today_earnings);
            dashOrders.innerText = data.today_orders;
            if(dashTicket) dashTicket.innerText = formatCOP(data.average_ticket || 0);
            
            if(dashTopItems && data.top_items) {
                if(data.top_items.length === 0) {
                    dashTopItems.innerHTML = `<p style="color:var(--text-muted)">No hay ventas registradas hoy.</p>`;
                } else {
                    dashTopItems.innerHTML = data.top_items.map((i, idx) => `
                        <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                            <span><strong>#${idx+1}</strong> ${i.item_name}</span>
                            <span style="color:var(--success); font-weight:bold;">${i.total_sold} unds</span>
                        </div>
                    `).join("");
                }
            }
            
            if(data.low_stock_items && data.low_stock_items.length > 0) {
                dashAlerts.innerHTML = data.low_stock_items.map(i => 
                    `<div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                        <span>${i.name}</span>
                        <strong style="color:var(--danger)">Quedan ${i.stock}</strong>
                    </div>`
                ).join("");
            } else {
                dashAlerts.innerHTML = `<p style="color:var(--success); font-weight:600;">INVENTARIO SALUDABLE</p>`;
            }

            if(dashHistory && data.recent_orders) {
                dashHistory.innerHTML = "";
                if(data.recent_orders.length === 0) dashHistory.innerHTML = "<tr><td colspan='4'>No hay órdenes recientes</td></tr>";
                data.recent_orders.forEach(o => {
                    const statusClass = o.status === 'completed' ? 'success' : (o.status === 'ready' ? 'warning' : 'danger');
                    dashHistory.innerHTML += `
                        <tr>
                            <td>#${o.id.substring(0,6)}</td>
                            <td>${o.table_name}</td>
                            <td>${formatCOP(o.total_amount)}</td>
                            <td><span class="badge ${statusClass}">${o.status}</span></td>
                        </tr>
                    `;
                });
            }
        }
    } catch(e) {
        console.error("Dashboard no cargado. Actualiza el backend.");
    }
}

// MENÚ
async function loadMenuAdmin() {
    const list = document.getElementById('menu-list');
    if(!list) return;
    try {
        const res = await apiFetch(`${API_BASE}/menu/${RESTAURANT_ID}`);
        const data = await res.json();
        list.innerHTML = "";
        if(data.length === 0) list.innerHTML = "<tr><td colspan='5'>No hay productos</td></tr>";
        
        data.forEach(i => {
            list.innerHTML += `
                <tr>
                    <td style="font-weight:600;">${i.name}</td>
                    <td>${i.category}</td>
                    <td>${formatCOP(i.price)}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap: 0.5rem;">
                            <input type="number" id="stock-${i.id}" value="${i.stock || 0}" class="input-field" style="width: 70px; padding: 0.4rem;">
                            <button class="btn btn-outline" style="padding: 0.3rem 0.5rem;" onclick="updateStock('${i.id}')">GUARDAR</button>
                        </div>
                    </td>
                    <td>
                        <button class="btn danger" style="padding: 0.3rem 0.5rem;" onclick="deleteMenuItem('${i.id}')">ELIMINAR</button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

async function updateStock(itemId) {
    const stockVal = document.getElementById(`stock-${itemId}`).value;
    try {
        const res = await apiFetch(`${API_BASE}/menu/${itemId}/stock`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({stock: parseInt(stockVal) || 0})
        });
        if(res.ok) {
            showToast("Stock actualizado");
            loadMenuAdmin(); // Refrescar la lista de menú
            loadDashboard(); // Refrescar alertas
        } else {
            const errText = await res.text();
            alert(`Error ${res.status} al guardar stock: ${errText}`);
        }
    } catch(e) {
        alert("Error de conexión al actualizar el stock: " + e.message);
    }
}

async function deleteMenuItem(itemId) {
    if(!confirm("¿Seguro que deseas eliminar este producto?")) return;
    try {
        const res = await apiFetch(`${API_BASE}/menu/${itemId}`, { method: 'DELETE' });
        if(res.ok) {
            showToast("Producto eliminado");
            loadMenuAdmin();
            loadDashboard();
        }
    } catch(e) {}
}

async function addProduct() {
    const name = document.getElementById('p_name').value;
    const price = parseFloat(document.getElementById('p_price').value);
    const cat = document.getElementById('p_cat').value;
    const stock = document.getElementById('p_stock') ? parseInt(document.getElementById('p_stock').value) : 0;
    
    if(!name || !price) return alert("Completa los campos");

    try {
        const res = await apiFetch(`${API_BASE}/menu/${RESTAURANT_ID}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, price, category: cat, stock: stock || 0})
        });
        if(res.ok) {
            showToast("Producto agregado");
            document.getElementById('p_name').value = "";
            document.getElementById('p_price').value = "";
            if(document.getElementById('p_stock')) document.getElementById('p_stock').value = "";
            loadMenuAdmin();
        }
    } catch(e) { console.error(e); }
}

// MESAS
async function loadTablesAdmin() {
    const list = document.getElementById('tables-list');
    if(!list) return;
    try {
        const res = await apiFetch(`${API_BASE}/tables/${RESTAURANT_ID}`);
        const data = await res.json();
        list.innerHTML = "";
        if(data.length === 0) list.innerHTML = "<p>No hay mesas configuradas.</p>";
        
        data.forEach(t => {
            list.innerHTML += `
                <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size: 1.1rem;">${t.name}</strong>
                    <div style="display:flex; align-items:center; gap: 0.5rem;">
                        <span class="badge success">ACTIVA</span>
                        <button class="btn danger" style="padding: 0.3rem 0.5rem;" onclick="deleteTable('${t.id}')">ELIMINAR</button>
                    </div>
                </div>
            `;
        });
    } catch(e) { console.error(e); }
}

async function deleteTable(tableId) {
    if(!confirm("¿Seguro que deseas eliminar esta mesa?")) return;
    try {
        const res = await apiFetch(`${API_BASE}/tables/${tableId}`, { method: 'DELETE' });
        if(res.ok) {
            showToast("Mesa eliminada");
            loadTablesAdmin();
        } else {
            const errText = await res.text();
            alert(`Error ${res.status} al eliminar mesa: ${errText}`);
        }
    } catch(e) {
        alert("Error de red: " + e.message);
    }
}

async function addTable() {
    const name = document.getElementById('t_name').value;
    if(!name) return alert("Ingresa el nombre de la mesa");
    try {
        const res = await apiFetch(`${API_BASE}/tables/${RESTAURANT_ID}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name})
        });
        if(res.ok) {
            showToast("Mesa agregada");
            document.getElementById('t_name').value = "";
            loadTablesAdmin();
        }
    } catch(e) { console.error(e); }
}

// PERSONAL / STAFF
async function loadStaffAdmin() {
    const list = document.getElementById('staff-list');
    if(!list) return;
    try {
        const res = await apiFetch(`${API_BASE}/staff/${RESTAURANT_ID}`);
        const data = await res.json();
        list.innerHTML = "";
        if(data.length === 0) list.innerHTML = "<tr><td colspan='4'>No hay empleados</td></tr>";
        
        data.forEach(s => {
            list.innerHTML += `
                <tr>
                    <td style="font-weight:600;">${s.name}</td>
                    <td>${s.username}</td>
                    <td><span class="badge ${s.role === 'mesero' ? 'ready' : 'pending'}">${s.role}</span></td>
                    <td>
                        <button class="btn danger" style="padding: 0.3rem 0.5rem;" onclick="deleteStaff('${s.id}')">ELIMINAR</button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

async function deleteStaff(staffId) {
    if(!confirm("¿Seguro que deseas eliminar a este empleado? Perderá acceso inmediatamente.")) return;
    try {
        const res = await apiFetch(`${API_BASE}/staff/${staffId}`, { method: 'DELETE' });
        if(res.ok) {
            showToast("Empleado eliminado");
            loadStaffAdmin();
        }
    } catch(e) {}
}

async function addStaff() {
    const name = document.getElementById('s_name').value;
    const user = document.getElementById('s_user').value;
    const pwd = document.getElementById('s_pwd').value;
    const role = document.getElementById('s_role').value;
    
    if(!name || !user || !pwd) return alert("Llena todos los campos");
    
    try {
        const res = await apiFetch(`${API_BASE}/staff/${RESTAURANT_ID}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, username: user, password: pwd, role})
        });
        const data = await res.json();
        if(res.ok) {
            showToast("Empleado agregado");
            document.getElementById('s_name').value = "";
            document.getElementById('s_user').value = "";
            document.getElementById('s_pwd').value = "";
            loadStaffAdmin();
        } else {
            alert(data.detail);
        }
    } catch(e) { console.error(e); }
}

// CAJA / TURNOS (ADMIN)
let CURRENT_SHIFT_ID = null;

async function loadShiftAdmin() {
    const container = document.getElementById('shift-status-container');
    const openForm = document.getElementById('shift-open-form');
    const closeForm = document.getElementById('shift-close-form');
    if(!container) return;
    
    try {
        const res = await apiFetch(`${API_BASE}/shifts/${RESTAURANT_ID}/current`);
        
        if (!res.ok) {
            throw new Error("Backend no disponible");
        }
        
        const data = await res.json();
        
        if (data.success && data.shift) {
            CURRENT_SHIFT_ID = data.shift.id;
            container.innerHTML = `
                <span class="badge success" style="font-size:1rem; padding:0.5rem 1rem; margin-bottom: 0.5rem;">TURNO ABIERTO</span>
                <p style="margin-top:0.5rem; font-size:0.9rem;">Abierto por: <strong>${data.shift.opened_by}</strong></p>
                <p style="font-size:0.9rem; color:var(--text-muted)">Base: ${formatCOP(data.shift.opening_balance)}</p>
            `;
            openForm.style.display = "none";
            closeForm.style.display = "flex";
        } else {
            CURRENT_SHIFT_ID = null;
            container.innerHTML = `
                <span class="badge danger" style="font-size:1rem; padding:0.5rem 1rem; margin-bottom: 0.5rem;">CAJA CERRADA</span>
                <p style="margin-top:0.5rem; font-size:0.9rem; color:var(--text-muted)">Debes realizar apertura de turno para facturar.</p>
            `;
            openForm.style.display = "flex";
            closeForm.style.display = "none";
        }
    } catch(e) { 
        console.error("Error cargando turno:", e);
        // Fallback silente: Mostrar caja cerrada
        CURRENT_SHIFT_ID = null;
        container.innerHTML = `
            <span class="badge danger" style="font-size:1rem; padding:0.5rem 1rem; margin-bottom: 0.5rem;">CAJA CERRADA</span>
            <p style="margin-top:0.5rem; font-size:0.9rem; color:var(--text-muted)">Abre un turno para poder facturar (Modo Offline / Error de red).</p>
        `;
        openForm.style.display = "flex";
        closeForm.style.display = "none";
    }
}

async function openShift() {
    const bal = document.getElementById('opening_balance').value;
    if(!bal) return alert("Ingresa la base de la caja");
    
    const userName = localStorage.getItem("session_user_name") || "Administrador";
    
    try {
        const res = await apiFetch(`${API_BASE}/shifts/${RESTAURANT_ID}/open`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({opened_by: userName, opening_balance: parseFloat(bal)})
        });
        if(res.ok) {
            showToast("Turno abierto exitosamente");
            document.getElementById('opening_balance').value = "";
            loadShiftAdmin();
        } else {
            alert("Error al abrir turno");
        }
    } catch(e) {}
}

async function closeShift() {
    const bal = document.getElementById('closing_balance').value;
    if(!bal) return alert("Ingresa el efectivo final");
    if(!CURRENT_SHIFT_ID) return;
    
    if(!confirm("¿Estás seguro de cerrar la caja (Corte Z)?")) return;
    
    try {
        const res = await apiFetch(`${API_BASE}/shifts/${RESTAURANT_ID}/close/${CURRENT_SHIFT_ID}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({closing_balance: parseFloat(bal)})
        });
        if(res.ok) {
            showToast("Turno cerrado correctamente (Corte Z)");
            document.getElementById('closing_balance').value = "";
            loadShiftAdmin();
        }
    } catch(e) {}
}

// --- LÓGICA DE MESERO (CARRITO) ---
let cart = [];
let fullMenu = [];
let currentSubtotal = 0;
let currentTip = 0;

async function loadMenuWaiter() {
    const container = document.getElementById('menu-buttons');
    if(!container) return;
    try {
        const res = await apiFetch(`${API_BASE}/menu/${RESTAURANT_ID}`);
        fullMenu = await res.json();
        
        container.innerHTML = "";
        if(fullMenu.length === 0) container.innerHTML = "<p>Menú vacío.</p>";
        
        fullMenu.forEach(item => {
            const stockColor = item.stock <= 10 ? 'var(--danger)' : 'var(--success)';
            container.innerHTML += `
                <button class="btn menu-item-btn" data-name="${item.name}" onclick="addToCart('${item.id}')" style="background:var(--card-bg); color:var(--text-main); border:1px solid var(--border-color); display:flex; flex-direction:column; align-items:center; padding:15px; position:relative;">
                    <div style="position:absolute; top:5px; right:5px; font-size:0.7rem; font-weight:bold; background:${stockColor}; color:#fff; padding:2px 5px; border-radius:4px;">
                        ${item.stock || 0}
                    </div>
                    <strong style="font-size:1rem; text-align:center; margin-top:5px;">${item.name}</strong>
                    <span style="color:var(--primary); font-weight:600; margin-top:5px;">${formatCOP(item.price)}</span>
                </button>
            `;
        });
    } catch(e) { console.error(e); }
}

async function loadTablesGrid() {
    const container = document.getElementById('tables-grid');
    if(!container) return;
    try {
        let res = await apiFetch(`${API_BASE}/tables/${RESTAURANT_ID}/status`);
        let tables = [];
        
        // Fallback: Si el usuario aún no actualiza el backend en Render, buscar tablas normales
        if (!res.ok) {
            res = await apiFetch(`${API_BASE}/tables/${RESTAURANT_ID}`);
            tables = await res.json();
            tables = tables.map(t => ({ ...t, is_occupied: false })); // Asumir libres
        } else {
            tables = await res.json();
        }

        container.innerHTML = "";
        if(tables.length === 0) container.innerHTML = "<p>No hay mesas</p>";
        
        tables.forEach(t => {
            const isOccupied = t.is_occupied;
            const btnClass = isOccupied ? 'table-occupied' : 'table-free';
            const statusText = isOccupied ? 'Ocupada' : 'Libre';
            
            container.innerHTML += `
                <div class="table-btn ${btnClass}" id="table-btn-${t.name}" onclick="selectTable('${t.name}')">
                    <span>${t.name}</span>
                    <span style="font-size: 0.75rem; font-weight: 400; opacity: 0.9;">${statusText}</span>
                </div>
            `;
        });
    } catch(e) { console.error(e); }
}

function selectTable(tableName) {
    document.getElementById('mesa').value = tableName;
    document.querySelectorAll('.table-btn').forEach(btn => btn.classList.remove('table-selected'));
    document.getElementById(`table-btn-${tableName}`).classList.add('table-selected');
}

function filterMenu() {
    const term = document.getElementById('menu-search').value.toLowerCase();
    const buttons = document.querySelectorAll('.menu-item-btn');
    buttons.forEach(btn => {
        const name = btn.getAttribute('data-name').toLowerCase();
        if(name.includes(term)) btn.style.display = 'flex';
        else btn.style.display = 'none';
    });
}

function addToCart(itemId) {
    const item = fullMenu.find(i => i.id === itemId);
    if(!item) return;
    const existing = cart.find(c => c.id === itemId);
    if(existing) existing.quantity += 1;
    else cart.push({ ...item, quantity: 1, notes: "" });
    renderCart();
}

function updateCartNotes(itemId, val) {
    const existing = cart.find(c => c.id === itemId);
    if(existing) existing.notes = val;
}

function updateTip(percentage) {
    if(currentSubtotal === 0) return;
    currentTip = currentSubtotal * (percentage / 100);
    renderCart(); // Re-render to show updated tip total
}

function renderCart() {
    const div = document.getElementById('cart-items');
    const subDiv = document.getElementById('cart-subtotal');
    const tipDiv = document.getElementById('cart-tip');
    const totalDiv = document.getElementById('cart-total');
    
    div.innerHTML = "";
    if(cart.length === 0) {
        div.innerHTML = "<p style='color:var(--text-muted)'>El carrito está vacío</p>";
        if(subDiv) subDiv.innerText = formatCOP(0);
        if(tipDiv) tipDiv.innerText = formatCOP(0);
        if(totalDiv) totalDiv.innerText = formatCOP(0);
        document.getElementById("btn-send").disabled = true;
        return;
    }
    
    document.getElementById("btn-send").disabled = false;
    currentSubtotal = 0;
    
    cart.forEach(item => {
        currentSubtotal += item.price * item.quantity;
        div.innerHTML += `
            <div style="background:var(--input-bg); padding:10px; border-radius:8px; margin-bottom:10px; border: 1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                    <strong style="font-size: 0.95rem;">${item.quantity}x ${item.name}</strong>
                    <span style="font-weight: 500;">${formatCOP(item.price * item.quantity)}</span>
                </div>
                <div style="display:flex; gap: 5px;">
                    <button class="btn danger" style="padding: 2px 8px; font-size: 0.8rem;" onclick="removeFromCart('${item.id}')">X</button>
                    <input type="text" placeholder="Notas (opcional)" class="input-field" style="padding:4px 8px; font-size:0.8rem;" onchange="updateCartNotes('${item.id}', this.value)" value="${item.notes}">
                </div>
            </div>
        `;
    });
    
    if(subDiv) subDiv.innerText = formatCOP(currentSubtotal);
    if(tipDiv) tipDiv.innerText = formatCOP(currentTip);
    if(totalDiv) totalDiv.innerText = formatCOP(currentSubtotal + currentTip);
}

function removeFromCart(itemId) {
    cart = cart.filter(c => c.id !== itemId);
    renderCart();
}

function openPaymentModal() {
    const mesa = document.getElementById("mesa").value;
    if(cart.length === 0 || !mesa) return alert("Selecciona mesa y agrega productos");
    
    document.getElementById("payment-total-display").innerText = formatCOP(currentSubtotal + currentTip);
    document.getElementById("cash-received").value = "";
    document.getElementById("change-display").innerText = "$0";
    document.getElementById("payment-modal").style.display = "flex";
}

function closePaymentModal() {
    document.getElementById("payment-modal").style.display = "none";
}

function calculateChange() {
    const total = currentSubtotal + currentTip;
    const received = parseFloat(document.getElementById("cash-received").value) || 0;
    const change = received - total;
    document.getElementById("change-display").innerText = change >= 0 ? formatCOP(change) : "$0";
}

async function sendOrder() {
    const mesa = document.getElementById("mesa").value;
    if(cart.length === 0 || !mesa) return alert("Selecciona mesa y productos");
    closePaymentModal();

    const payload = {
        restaurant_id: RESTAURANT_ID,
        table_name: mesa,
        waiter_name: localStorage.getItem("session_user_name") || "Mesero",
        items: cart.map(c => ({ item_name: c.name, quantity: c.quantity, price: c.price, notes: c.notes }))
    };

    const btn = document.getElementById("btn-send");
    btn.innerText = "Enviando..."; btn.disabled = true;

    try {
        const response = await apiFetch(`${API_BASE}/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if(response.ok) {
            showToast("✅ Orden enviada a cocina");
            showInvoice(data.order, currentSubtotal, currentTip);
            cart = [];
            currentTip = 0;
            renderCart();
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión");
    } finally {
        btn.innerText = "Generar Factura y Enviar a Cocina";
        btn.disabled = false;
    }
}

// --- FACTURACIÓN (TICKET SIMPLIFICADO) ---
function showInvoice(order, subtotal, tip) {
    const modal = document.getElementById("invoice-modal");
    if(!modal) return;
    
    let html = `
        <div style="font-family:'Courier New', Courier, monospace; font-size: 0.95rem; line-height: 1.4; color: #000; background: #fff; padding: 20px; text-align: left;">
            <div style="text-align:center; margin-bottom:15px;">
                <h2 style="margin:0; font-size:1.2rem; text-transform:uppercase;">${localStorage.getItem("session_rest_name") || "TICKET"}</h2>
                <div>Mesa: ${order.table_name}</div>
                <div>Ord: #${order.id.substring(0,6)} | Mesero: ${order.waiter_name}</div>
            </div>
            <div style="border-bottom: 1px dashed #000; margin-bottom:10px;"></div>
    `;
    
    order.items.forEach(it => {
        html += `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <div style="flex:1;">${it.quantity}x ${it.item_name}</div>
                <div>${formatCOP(it.quantity * it.price)}</div>
            </div>
        `;
    });
    
    html += `
            <div style="border-top: 1px dashed #000; margin-top:10px; padding-top:10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>Subtotal:</span>
                    <span>${formatCOP(subtotal)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>Propina sugerida:</span>
                    <span>${formatCOP(tip)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:8px; font-weight:bold; font-size:1.1rem;">
                    <span>TOTAL:</span>
                    <span>${formatCOP(subtotal + tip)}</span>
                </div>
            </div>
            <div style="text-align:center; margin-top:20px; font-size:0.8rem;">
                ¡Gracias por su visita!
            </div>
        </div>
    `;
    
    document.getElementById("invoice-content").innerHTML = html;
    modal.style.display = "flex";
}

function closeInvoice() {
    document.getElementById("invoice-modal").style.display = "none";
}

function printInvoice() {
    const content = document.getElementById("invoice-content").innerHTML;
    const printWindow = window.open('', '', 'width=350,height=600');
    printWindow.document.write(`
        <html><head><title>Ticket</title>
        <style>body{margin:0; padding:10px; background:#fff;}</style>
        </head><body>${content}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// --- LÓGICA DE LA COCINA (KDS) ---
let ws;
async function initKitchen() {
    const ordersDiv = document.getElementById("kitchen-orders");
    if (!ordersDiv) return;

    ordersDiv.innerHTML = "<p>Sincronizando órdenes...</p>";
    
    try {
        const res = await apiFetch(`${API_BASE}/orders/${RESTAURANT_ID}`);
        const orders = await res.json();
        ordersDiv.innerHTML = "";
        if(orders.length === 0) ordersDiv.innerHTML = "<div style='grid-column: 1/-1; text-align:center;'><p>No hay órdenes pendientes</p></div>";
        else orders.reverse().forEach(o => renderOrderCard(o, ordersDiv, false));
    } catch(e) { console.error("Error sincronizando", e); }

    ws = new WebSocket(`${WS_BASE}/${RESTAURANT_ID}`);
    ws.onopen = () => showToast("KDS En línea 🟢");
    ws.onmessage = function(event) {
        const message = JSON.parse(event.data);
        if(message.type === "NEW_ORDER") {
            if(ordersDiv.innerHTML.includes("No hay órdenes")) ordersDiv.innerHTML = "";
            renderOrderCard(message.data, ordersDiv, true);
        }
    };
    ws.onclose = () => {
        showToast("Desconectado 🔴. Reintentando...");
        setTimeout(initKitchen, 5000);
    };
}

function renderOrderCard(order, container, isNew) {
    if(document.getElementById(`order-${order.id}`)) return;
    
    let itemsHtml = order.items.map(item => `
        <li style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed var(--glass-border);">
            <strong>${item.quantity}x ${item.item_name}</strong>
            ${item.notes ? `<br><span style="font-size:0.9em; color:var(--warning);">Nota: ${item.notes}</span>` : ''}
        </li>
    `).join("");
    
    const orderCard = document.createElement('div');
    orderCard.className = "card";
    if(isNew) orderCard.style.animation = "slideIn 0.5s ease";
    orderCard.id = `order-${order.id}`;
    
    let badgeClass = order.status === 'ready' ? 'ready' : 'pending';
    let badgeText = order.status === 'ready' ? 'Lista' : 'Nueva';
    
    orderCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
            <h3 class="card-title">${order.table_name}</h3>
            <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        <p style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 15px;">
            Mesero: ${order.waiter_name}
        </p>
        <ul style="list-style: none; margin-bottom: 15px;">${itemsHtml}</ul>
        ${order.status !== 'ready' ? `<button class="btn success" style="width:100%" onclick="markOrderReady('${order.id}', this)">Marcar Lista</button>` : `<button class="btn" style="width:100%; background:var(--text-muted)" onclick="markOrderCompleted('${order.id}', this)">Archivar (Entregada)</button>`}
    `;
    
    container.prepend(orderCard);
}

async function markOrderReady(orderId, buttonElement) {
    buttonElement.innerText = "...";
    buttonElement.disabled = true;
    try {
        const response = await apiFetch(`${API_BASE}/orders/${orderId}/ready?restaurant_id=${RESTAURANT_ID}`, { method: "PUT" });
        if (response.ok) {
            const card = document.getElementById(`order-${orderId}`);
            card.querySelector('.badge').className = "badge ready";
            card.querySelector('.badge').innerText = "Lista";
            buttonElement.outerHTML = `<button class="btn" style="width:100%; background:var(--text-muted)" onclick="markOrderCompleted('${orderId}', this)">Archivar (Entregada)</button>`;
            showToast("Orden lista");
        }
    } catch (e) {}
}

async function markOrderCompleted(orderId, buttonElement) {
    buttonElement.innerText = "...";
    try {
        const response = await apiFetch(`${API_BASE}/orders/${orderId}/completed?restaurant_id=${RESTAURANT_ID}`, { method: "PUT" });
        if (response.ok) {
            document.getElementById(`order-${orderId}`).remove();
        }
    } catch (e) {}
}
