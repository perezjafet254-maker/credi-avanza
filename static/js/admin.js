/**
 * CREDI AVANZA - Panel de Asesores Administrativo
 */

let ADMIN_TOKEN = localStorage.getItem("credi_admin_token") || "";
let solicitudesList = [];

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("admin-login-form");
  const btnLogout = document.getElementById("btn-logout");
  const filterEstado = document.getElementById("filter-estado");
  const searchInput = document.getElementById("search-input");
  const btnExportar = document.getElementById("btn-exportar-csv");
  const configForm = document.getElementById("admin-config-form");
  const tabBtnSolicitudes = document.getElementById("tab-btn-solicitudes");
  const tabBtnConfig = document.getElementById("tab-btn-config");
  const viewSolicitudes = document.getElementById("view-solicitudes");
  const viewConfiguracion = document.getElementById("view-configuracion");
  const btnCancelarConfig = document.getElementById("btn-cancelar-config");

  function activarTab(tab) {
    if (!viewSolicitudes || !viewConfiguracion) return;
    if (tab === "solicitudes") {
      viewSolicitudes.classList.remove("hidden");
      viewConfiguracion.classList.add("hidden");
      if (tabBtnSolicitudes) tabBtnSolicitudes.className = "px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition cursor-pointer";
      if (tabBtnConfig) tabBtnConfig.className = "px-5 py-2.5 rounded-xl font-bold text-xs bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer shadow-sm";
    } else {
      viewSolicitudes.classList.add("hidden");
      viewConfiguracion.classList.remove("hidden");
      if (tabBtnConfig) tabBtnConfig.className = "px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition cursor-pointer";
      if (tabBtnSolicitudes) tabBtnSolicitudes.className = "px-5 py-2.5 rounded-xl font-bold text-xs bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer shadow-sm";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (tabBtnSolicitudes) tabBtnSolicitudes.addEventListener("click", () => activarTab("solicitudes"));
  if (tabBtnConfig) tabBtnConfig.addEventListener("click", () => activarTab("config"));
  if (btnCancelarConfig) btnCancelarConfig.addEventListener("click", () => cargarConfiguracionAdmin());

  if (ADMIN_TOKEN) {
    verificarSesion();
  } else {
    mostrarLogin();
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pin = document.getElementById("admin-pin-input").value;
      await intentarLogin(pin);
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("credi_admin_token");
      ADMIN_TOKEN = "";
      mostrarLogin();
    });
  }

  if (filterEstado) {
    filterEstado.addEventListener("change", aplicarFiltros);
  }

  if (searchInput) {
    searchInput.addEventListener("input", aplicarFiltros);
  }

  if (btnExportar) {
    btnExportar.addEventListener("click", () => {
      window.location.href = `/api/admin/solicitudes/export?token=${encodeURIComponent(ADMIN_TOKEN)}`;
    });
  }

  if (configForm) {
    configForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await guardarConfiguracion();
    });
  }
});

function mostrarLogin() {
  document.getElementById("admin-login-screen").classList.remove("hidden");
  document.getElementById("admin-dashboard-screen").classList.add("hidden");
}

function mostrarDashboard() {
  document.getElementById("admin-login-screen").classList.add("hidden");
  document.getElementById("admin-dashboard-screen").classList.remove("hidden");
  cargarSolicitudes();
  cargarConfiguracionAdmin();
}

async function intentarLogin(pin) {
  const errBox = document.getElementById("login-error-msg");
  errBox.classList.add("hidden");

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin })
    });

    if (res.ok) {
      const data = await res.json();
      ADMIN_TOKEN = data.token;
      localStorage.setItem("credi_admin_token", ADMIN_TOKEN);
      mostrarDashboard();
    } else {
      errBox.textContent = "Clave de acceso incorrecta. Por favor verifique sus credenciales.";
      errBox.classList.remove("hidden");
    }
  } catch (err) {
    errBox.textContent = "Error de conexión con el servidor.";
    errBox.classList.remove("hidden");
  }
}

async function verificarSesion() {
  try {
    const res = await fetch(`/api/admin/verificar?token=${encodeURIComponent(ADMIN_TOKEN)}`);
    if (res.ok) {
      mostrarDashboard();
    } else {
      mostrarLogin();
    }
  } catch {
    mostrarLogin();
  }
}

async function cargarSolicitudes() {
  try {
    const res = await fetch(`/api/admin/solicitudes?token=${encodeURIComponent(ADMIN_TOKEN)}`);
    if (res.ok) {
      solicitudesList = await res.json();
      actualizarMetricas(solicitudesList);
      renderTabla(solicitudesList);
    }
  } catch (err) {
    console.error("Error al cargar solicitudes:", err);
  }
}

function actualizarMetricas(lista) {
  const total = lista.length;
  const pendientes = lista.filter(s => s.estado === "PENDIENTE").length;
  const enEvaluacion = lista.filter(s => s.estado === "EN_EVALUACION").length;
  const aprobados = lista.filter(s => s.estado === "APROBADO").length;
  const montoTotal = lista.reduce((sum, s) => sum + s.monto, 0);

  const statTotal = document.getElementById("stat-total");
  const badgeTotal = document.getElementById("badge-total-solicitudes");
  if (statTotal) statTotal.textContent = total;
  if (badgeTotal) badgeTotal.textContent = total;

  const statPendientes = document.getElementById("stat-pendientes");
  if (statPendientes) statPendientes.textContent = pendientes;

  const statEvaluacion = document.getElementById("stat-evaluacion");
  if (statEvaluacion) statEvaluacion.textContent = enEvaluacion;

  const statAprobados = document.getElementById("stat-aprobados");
  if (statAprobados) statAprobados.textContent = aprobados;

  const statMonto = document.getElementById("stat-monto-total");
  if (statMonto) statMonto.textContent = `S/ ${montoTotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

function aplicarFiltros() {
  const estado = document.getElementById("filter-estado").value;
  const search = document.getElementById("search-input").value.toLowerCase().trim();

  const filtrados = solicitudesList.filter(s => {
    const cumpleEstado = !estado || s.estado === estado;
    const textoCompleto = `${s.codigo} ${s.nombres} ${s.apellidos} ${s.numero_documento} ${s.telefono} ${s.email} ${s.distrito} ${s.departamento}`.toLowerCase();
    const cumpleSearch = !search || textoCompleto.includes(search);
    return cumpleEstado && cumpleSearch;
  });

  renderTabla(filtrados);
}

function renderTabla(lista) {
  const tbody = document.getElementById("solicitudes-tbody");
  tbody.innerHTML = "";

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-slate-500 font-medium">
          No se encontraron solicitudes registradas con los criterios seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  lista.forEach(s => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-200 text-sm";
    
    // Badge de estado
    let badgeClass = "bg-amber-100 text-amber-800";
    if (s.estado === "APROBADO") badgeClass = "bg-emerald-100 text-emerald-800";
    else if (s.estado === "RECHAZADO") badgeClass = "bg-red-100 text-red-800";
    else if (s.estado === "EN_EVALUACION") badgeClass = "bg-blue-100 text-blue-800";
    else if (s.estado === "CONTACTADO") badgeClass = "bg-purple-100 text-purple-800";

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-semibold text-emerald-900">${s.codigo}</td>
      <td class="py-3 px-4">
        <div class="font-medium text-slate-900">${s.nombres} ${s.apellidos}</div>
        <div class="text-xs text-slate-500">${s.tipo_documento}: ${s.numero_documento}</div>
      </td>
      <td class="py-3 px-4 font-semibold text-slate-900">S/ ${s.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
      <td class="py-3 px-4 text-slate-600">${s.plazo} meses</td>
      <td class="py-3 px-4">
        <div class="text-slate-800">${s.distrito}, ${s.departamento}</div>
        <div class="text-xs text-slate-500">Cel: ${s.telefono}</div>
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}">
          ${s.estado}
        </span>
      </td>
      <td class="py-3 px-4 text-right">
        <button onclick="verDetalleSolicitud('${s.codigo}')" class="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-1.5 px-3 rounded-lg shadow-sm transition">
          Ver Ficha
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.verDetalleSolicitud = function(codigo) {
  const item = solicitudesList.find(s => s.codigo === codigo);
  if (!item) return;

  const modal = document.getElementById("modal-detalle-solicitud");
  document.getElementById("modal-sol-codigo").textContent = item.codigo;
  document.getElementById("modal-sol-fecha").textContent = item.creado_en;
  
  document.getElementById("modal-sol-monto").textContent = `S/ ${item.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
  document.getElementById("modal-sol-plazo").textContent = `${item.plazo} meses`;
  document.getElementById("modal-sol-cuota").textContent = `S/ ${item.cuota_estimada.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
  document.getElementById("modal-sol-finalidad").textContent = item.finalidad;

  document.getElementById("modal-sol-titular").textContent = `${item.nombres} ${item.apellidos}`;
  document.getElementById("modal-sol-documento").textContent = `${item.tipo_documento}: ${item.numero_documento}`;
  document.getElementById("modal-sol-nacimiento").textContent = item.fecha_nacimiento;
  document.getElementById("modal-sol-telefono").textContent = item.telefono;
  document.getElementById("modal-sol-whatsapp").textContent = item.whatsapp;
  document.getElementById("modal-sol-email").textContent = item.email;

  document.getElementById("modal-sol-ubicacion").textContent = `${item.distrito}, ${item.provincia}, ${item.departamento}`;
  document.getElementById("modal-sol-direccion").textContent = item.direccion;
  document.getElementById("modal-sol-laboral").textContent = item.situacion_laboral;
  document.getElementById("modal-sol-ingresos").textContent = `S/ ${item.ingresos_mensuales.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

  // Estado y notas
  document.getElementById("modal-sol-estado-select").value = item.estado;
  document.getElementById("modal-sol-notas").value = item.notas_asesor || "";

  // Botón guardar cambios en el modal
  const btnGuardarEstado = document.getElementById("btn-guardar-estado-solicitud");
  btnGuardarEstado.onclick = async () => {
    await actualizarEstadoSolicitud(item.codigo);
  };

  // Botón enlace directo a WhatsApp para el asesor
  const btnWspAsesor = document.getElementById("btn-contactar-wsp");
  if (btnWspAsesor) {
    const numClean = item.whatsapp.replace(/\D/g, "");
    const msg = encodeURIComponent(`Hola ${item.nombres}, te saludamos de Credi Avanza respecto a tu solicitud de préstamo personal ${item.codigo}. ¿Podemos coordinar para darte más detalles?`);
    btnWspAsesor.href = `https://wa.me/51${numClean}?text=${msg}`;
  }

  modal.classList.remove("hidden");
};

async function actualizarEstadoSolicitud(codigo) {
  const nuevoEstado = document.getElementById("modal-sol-estado-select").value;
  const nuevasNotas = document.getElementById("modal-sol-notas").value;

  try {
    const res = await fetch(`/api/admin/solicitudes/${codigo}/estado?token=${encodeURIComponent(ADMIN_TOKEN)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: nuevoEstado,
        notas_asesor: nuevasNotas
      })
    });

    if (res.ok) {
      alert("Ficha actualizada correctamente.");
      document.getElementById("modal-detalle-solicitud").classList.add("hidden");
      await cargarSolicitudes();
    } else {
      alert("No se pudo actualizar el estado.");
    }
  } catch (err) {
    alert("Error de red al actualizar estado.");
  }
}

async function cargarConfiguracionAdmin() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const cfg = await res.json();
      document.getElementById("cfg-tea").value = cfg.tea_referencial || "28.50";
      document.getElementById("cfg-tel").value = cfg.telefono_atencion || "";
      document.getElementById("cfg-wsp").value = cfg.whatsapp_atencion || "";
      document.getElementById("cfg-email").value = cfg.email_contacto || "";
      document.getElementById("cfg-horario").value = cfg.horario_atencion || "";
      document.getElementById("cfg-razon").value = cfg.razon_social || "";
      document.getElementById("cfg-ruc").value = cfg.ruc || "";
      document.getElementById("cfg-dir").value = cfg.direccion_fiscal || "";
    }
  } catch (err) {
    console.error("Error al cargar config admin:", err);
  }
}

async function guardarConfiguracion() {
  const btnGuardar = document.getElementById("btn-guardar-cfg");
  const alertSuccess = document.getElementById("config-success-alert");
  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<span>Guardando cambios...</span>`;
  }

  const pinInput = document.getElementById("cfg-pin");
  const pinVal = pinInput ? pinInput.value.trim() : "";

  const payload = {
    tea_referencial: document.getElementById("cfg-tea").value,
    telefono_atencion: document.getElementById("cfg-tel").value,
    whatsapp_atencion: document.getElementById("cfg-wsp").value,
    email_contacto: document.getElementById("cfg-email").value,
    horario_atencion: document.getElementById("cfg-horario").value,
    razon_social: document.getElementById("cfg-razon").value,
    ruc: document.getElementById("cfg-ruc").value,
    direccion_fiscal: document.getElementById("cfg-dir").value
  };

  if (pinVal) {
    payload.admin_pin = pinVal;
  }

  try {
    const res = await fetch(`/api/admin/configuracion?token=${encodeURIComponent(ADMIN_TOKEN)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      if (alertSuccess) {
        alertSuccess.classList.remove("hidden");
        alertSuccess.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => alertSuccess.classList.add("hidden"), 8000);
      } else {
        alert("¡Parámetros de Credi Avanza actualizados exitosamente!");
      }
      if (pinInput) pinInput.value = "";
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Error al actualizar la configuración: ${err.detail || "Verifica tu sesión"}`);
    }
  } catch (err) {
    alert("Error de conexión al comunicarse con el servidor.");
  } finally {
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
        <span>Guardar y Aplicar Cambios en la Web</span>
      `;
    }
  }
}
