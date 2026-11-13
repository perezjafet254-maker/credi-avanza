/**
 * CREDI AVANZA - Panel de Asesores Administrativo Blindado
 * Implementa autenticación basada en tokens criptográficos con headers Authorization: Bearer,
 * control de acceso por roles (RBAC), sanitización contra XSS y auto-cierre por inactividad.
 */

// Utilizar sessionStorage para evitar persistencia indebida de sesión tras cerrar navegador
let ADMIN_TOKEN = sessionStorage.getItem("credi_admin_token") || localStorage.getItem("credi_admin_token") || "";
let CURRENT_USER_ROLE = sessionStorage.getItem("credi_admin_role") || "asesor";
let solicitudesList = [];
let inactivityTimer = null;

// Escapar caracteres peligrosos para prevención rigurosa de XSS
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Headers de autenticación estándar RFC 6750 (evita filtración de tokens en query strings)
function getAuthHeaders(contentType = "application/json") {
  const headers = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (ADMIN_TOKEN) headers["Authorization"] = `Bearer ${ADMIN_TOKEN}`;
  return headers;
}

// Detector de inactividad: cierra la sesión tras 30 minutos sin interacción
function reiniciarInactividad() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    alert("Tu sesión ha expirado por inactividad por razones de seguridad.");
    ejecutarLogout();
  }, 30 * 60 * 1000); // 30 minutos
}

["mousemove", "keydown", "click", "scroll"].forEach(ev => {
  window.addEventListener(ev, reiniciarInactividad, { passive: true });
});

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
      // Si el rol es asesor, no permitir acceso a configuración
      if (CURRENT_USER_ROLE !== "admin") {
        alert("Acceso restringido: Se requiere rol de Administrador para editar datos legales y de contacto.");
        return;
      }
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

  const pinInput = document.getElementById("admin-pin-input");
  if (pinInput) {
    pinInput.value = "";
    pinInput.setAttribute("autocomplete", "new-password");
  }

  if (ADMIN_TOKEN) {
    verificarSesion();
  } else {
    mostrarLogin();
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pinVal = pinInput ? pinInput.value : "";
      if (pinInput) pinInput.value = "";
      await intentarLogin(pinVal);
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", ejecutarLogout);
  }

  if (filterEstado) {
    filterEstado.addEventListener("change", aplicarFiltros);
  }

  if (searchInput) {
    searchInput.addEventListener("input", aplicarFiltros);
  }

  if (btnExportar) {
    btnExportar.addEventListener("click", exportarCSV);
  }

  if (configForm) {
    configForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await guardarConfiguracion();
    });
  }
});

function aplicarControlesRBAC(rol) {
  CURRENT_USER_ROLE = rol;
  sessionStorage.setItem("credi_admin_role", rol);

  const badge = document.getElementById("admin-user-role-badge");
  const tabConfig = document.getElementById("tab-btn-config");
  const btnExport = document.getElementById("btn-exportar-csv");

  if (badge) {
    if (rol === "admin") {
      badge.textContent = "Rol: Administrador (Acceso Total)";
      badge.className = "bg-emerald-950 text-emerald-300 text-xs font-bold px-3 py-1 rounded-lg border border-emerald-700 shadow-sm";
    } else {
      badge.textContent = "Rol: Asesor Comercial";
      badge.className = "bg-blue-950 text-blue-200 text-xs font-semibold px-3 py-1 rounded-lg border border-blue-800 shadow-sm";
    }
  }

  if (rol !== "admin") {
    // Si es asesor, ocultar la pestaña de configuración del sitio y bloquear exportación masiva
    if (tabConfig) tabConfig.classList.add("hidden");
    if (btnExport) {
      btnExport.classList.add("opacity-50", "cursor-not-allowed");
      btnExport.title = "Exportación reservada para el rol Administrador";
    }
  } else {
    if (tabConfig) tabConfig.classList.remove("hidden");
    if (btnExport) {
      btnExport.classList.remove("opacity-50", "cursor-not-allowed");
      btnExport.title = "Descargar registro completo";
    }
  }
}

function mostrarLogin() {
  document.getElementById("admin-login-screen").classList.remove("hidden");
  document.getElementById("admin-dashboard-screen").classList.add("hidden");
  const pinInput = document.getElementById("admin-pin-input");
  if (pinInput) {
    pinInput.value = "";
    pinInput.focus();
  }
}

function mostrarDashboard() {
  document.getElementById("admin-login-screen").classList.add("hidden");
  document.getElementById("admin-dashboard-screen").classList.remove("hidden");
  reiniciarInactividad();
  cargarSolicitudes();
  if (CURRENT_USER_ROLE === "admin") {
    cargarConfiguracionAdmin();
  }
}

async function intentarLogin(pin) {
  const errBox = document.getElementById("login-error-msg");
  const pinInput = document.getElementById("admin-pin-input");
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
      sessionStorage.setItem("credi_admin_token", ADMIN_TOKEN);
      localStorage.removeItem("credi_admin_token"); // Eliminar de persistente inseguro
      aplicarControlesRBAC(data.rol || "asesor");
      mostrarDashboard();
    } else if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      errBox.textContent = data.detail || "Demasiados intentos fallidos. Por seguridad, el acceso ha sido bloqueado temporalmente durante 15 minutos.";
      errBox.classList.remove("hidden");
    } else {
      errBox.textContent = "Clave de acceso incorrecta. Verifique sus credenciales autorizadas.";
      errBox.classList.remove("hidden");
    }
  } catch (err) {
    errBox.textContent = "Error de conexión segura con el servidor.";
    errBox.classList.remove("hidden");
  } finally {
    if (pinInput) {
      pinInput.value = "";
    }
  }
}

async function verificarSesion() {
  try {
    const res = await fetch("/api/admin/verificar", {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      aplicarControlesRBAC(data.rol || "asesor");
      mostrarDashboard();
    } else {
      ejecutarLogout();
    }
  } catch {
    ejecutarLogout();
  }
}

async function ejecutarLogout() {
  try {
    if (ADMIN_TOKEN) {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: getAuthHeaders()
      }).catch(() => {});
    }
  } finally {
    sessionStorage.removeItem("credi_admin_token");
    sessionStorage.removeItem("credi_admin_role");
    localStorage.removeItem("credi_admin_token");
    ADMIN_TOKEN = "";
    CURRENT_USER_ROLE = "asesor";
    if (inactivityTimer) clearTimeout(inactivityTimer);
    mostrarLogin();
  }
}

async function cargarSolicitudes() {
  try {
    const res = await fetch("/api/admin/solicitudes", {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      solicitudesList = await res.json();
      actualizarMetricas(solicitudesList);
      renderTabla(solicitudesList);
    } else if (res.status === 401) {
      ejecutarLogout();
    }
  } catch (err) {
    console.error("Error seguro al cargar solicitudes:", err);
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
    
    let badgeClass = "bg-amber-100 text-amber-800";
    if (s.estado === "APROBADO") badgeClass = "bg-emerald-100 text-emerald-800";
    else if (s.estado === "RECHAZADO") badgeClass = "bg-red-100 text-red-800";
    else if (s.estado === "EN_EVALUACION") badgeClass = "bg-blue-100 text-blue-800";
    else if (s.estado === "CONTACTADO") badgeClass = "bg-purple-100 text-purple-800";

    const codigoSafe = escapeHTML(s.codigo);
    const nombresSafe = escapeHTML(s.nombres);
    const apellidosSafe = escapeHTML(s.apellidos);
    const tipoDocSafe = escapeHTML(s.tipo_documento);
    const numDocSafe = escapeHTML(s.numero_documento);
    const distritoSafe = escapeHTML(s.distrito);
    const dptoSafe = escapeHTML(s.departamento);
    const telSafe = escapeHTML(s.telefono);
    const estadoSafe = escapeHTML(s.estado);
    const montoFormatted = Number(s.monto || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 });
    const plazoFormatted = Number(s.plazo || 0);

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-semibold text-emerald-900">${codigoSafe}</td>
      <td class="py-3 px-4">
        <div class="font-medium text-slate-900">${nombresSafe} ${apellidosSafe}</div>
        <div class="text-xs text-slate-500">${tipoDocSafe}: ${numDocSafe}</div>
      </td>
      <td class="py-3 px-4 font-semibold text-slate-900">S/ ${montoFormatted}</td>
      <td class="py-3 px-4 text-slate-600">${plazoFormatted} meses</td>
      <td class="py-3 px-4 text-xs text-slate-600">
        <div>${distritoSafe}, ${dptoSafe}</div>
        <div class="font-mono text-slate-500 font-semibold">${telSafe}</div>
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeClass}">
          ${estadoSafe}
        </span>
      </td>
      <td class="py-3 px-4 text-right">
        <button 
          type="button"
          onclick="verDetalleSolicitud('${codigoSafe}')"
          class="btn-emerald-outline text-xs px-3 py-1.5"
        >
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

  // Botón enlace directo a WhatsApp para el asesor (sanitizado contra caracteres peligrosos)
  const btnWspAsesor = document.getElementById("btn-contactar-wsp");
  if (btnWspAsesor) {
    const numClean = (item.whatsapp || "").replace(/\D/g, "");
    const msg = encodeURIComponent(`Hola ${item.nombres}, te saludamos de Credi Avanza respecto a tu solicitud de préstamo personal ${item.codigo}. ¿Podemos coordinar para darte más detalles?`);
    btnWspAsesor.href = `https://wa.me/51${numClean}?text=${msg}`;
  }

  modal.classList.remove("hidden");
};

async function actualizarEstadoSolicitud(codigo) {
  const nuevoEstado = document.getElementById("modal-sol-estado-select").value;
  const nuevasNotas = document.getElementById("modal-sol-notas").value;

  try {
    const res = await fetch(`/api/admin/solicitudes/${encodeURIComponent(codigo)}/estado`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        estado: nuevoEstado,
        notas_asesor: nuevasNotas
      })
    });

    if (res.ok) {
      alert("Ficha actualizada correctamente y evento auditado.");
      document.getElementById("modal-detalle-solicitud").classList.add("hidden");
      await cargarSolicitudes();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`No se pudo actualizar el estado: ${err.mensaje || err.detail || "Error"}`);
    }
  } catch (err) {
    alert("Error de red al actualizar estado.");
  }
}

async function exportarCSV() {
  if (CURRENT_USER_ROLE !== "admin") {
    alert("Operación denegada: La exportación masiva está reservada para el rol Administrador.");
    return;
  }

  try {
    const res = await fetch("/api/admin/solicitudes/export", {
      headers: getAuthHeaders()
    });

    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `solicitudes_crediavanza_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else if (res.status === 403) {
      alert("Acceso denegado: Tu rol actual no tiene autorización para exportar datos.");
    } else {
      alert("No fue posible exportar las solicitudes.");
    }
  } catch (err) {
    alert("Error al descargar el archivo de solicitudes.");
  }
}

async function cargarConfiguracionAdmin() {
  if (CURRENT_USER_ROLE !== "admin") return;
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
  if (CURRENT_USER_ROLE !== "admin") {
    alert("Acceso denegado: Se requiere rol de Administrador para modificar los datos de la empresa.");
    return;
  }

  const btnGuardar = document.getElementById("btn-guardar-cfg");
  const alertSuccess = document.getElementById("config-success-alert");
  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<span>Guardando de forma segura...</span>`;
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
    if (pinVal.length < 6) {
      alert("La nueva clave de acceso debe tener al menos 6 caracteres.");
      if (btnGuardar) btnGuardar.disabled = false;
      return;
    }
    payload.admin_pin = pinVal;
  }

  try {
    const res = await fetch("/api/admin/configuracion", {
      method: "POST",
      headers: getAuthHeaders(),
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
      alert(`Error al actualizar la configuración: ${err.mensaje || err.detail || "Verifica tu sesión"}`);
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
