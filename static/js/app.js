/**
 * CREDI AVANZA - Frontend Application Logic
 * Solicitud de préstamos personales - Mercado Peruano
 */

// Estado global de la aplicación
const AppState = {
  monto: 5000,
  plazo: 24,
  finalidad: "Libre disponibilidad personal",
  cuotaEstimada: 0,
  teaReferencial: 28.5,
  desgravamenMensual: 0.075,
  currentStep: 1,
  config: {},
  datosFormulario: {}
};

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Cargar configuraciones del backend
  await cargarConfiguracion();

  // 2. Inicializar Ubigeo
  inicializarUbigeo();

  // 3. Inicializar selector de montos y plazos
  inicializarSelectorMontos();
  inicializarSelectorPlazos();

  // 4. Inicializar simulador
  actualizarSimulador();

  // 5. Vincular eventos de formulario y botones
  configurarEventosFormulario();

  // 6. Configurar modales y navegación móvil
  configurarModales();
  configurarNavegacionMovil();
});

/**
 * Carga la configuración del backend
 */
async function cargarConfiguracion() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      AppState.config = data;
      if (data.tea_referencial) {
        AppState.teaReferencial = parseFloat(data.tea_referencial);
      }
      if (data.tasa_seguro_desgravamen) {
        AppState.desgravamenMensual = parseFloat(data.tasa_seguro_desgravamen);
      }
      
      // Actualizar datos de contacto dinámicos en la interfaz si existen los elementos
      actualizarTextosContacto(data);
    }
  } catch (error) {
    console.warn("Utilizando valores predeterminados para la configuración referencial.", error);
  }
}

function actualizarTextosContacto(data) {
  const telElements = document.querySelectorAll(".cfg-telefono");
  telElements.forEach(el => el.textContent = data.telefono_atencion || "+51 1 700 8920");

  const wspElements = document.querySelectorAll(".cfg-whatsapp");
  wspElements.forEach(el => el.textContent = data.whatsapp_atencion || "+51 987 654 321");

  const emailElements = document.querySelectorAll(".cfg-email");
  emailElements.forEach(el => el.textContent = data.email_contacto || "crediavanzape@gmail.com");

  const horarioElements = document.querySelectorAll(".cfg-horario");
  horarioElements.forEach(el => el.textContent = data.horario_atencion || "Lunes a Viernes 8:30 a.m. - 6:30 p.m.");

  const rucElements = document.querySelectorAll(".cfg-ruc");
  rucElements.forEach(el => el.textContent = data.ruc || "20608945123");

  const razonElements = document.querySelectorAll(".cfg-razon");
  razonElements.forEach(el => el.textContent = data.razon_social || "Credi Avanza Servicios Financieros S.A.C.");

  const dirElements = document.querySelectorAll(".cfg-direccion");
  dirElements.forEach(el => el.textContent = data.direccion_fiscal || "San Isidro, Lima - Perú");

  const teaElements = document.querySelectorAll(".cfg-tea");
  teaElements.forEach(el => el.textContent = `${AppState.teaReferencial.toFixed(2)}%`);

  // Actualizar enlaces interactivos de WhatsApp, Teléfono y Correo
  const numWsp = (data.whatsapp_atencion || "987654321").replace(/\D/g, "");
  const wspLink = `https://wa.me/51${numWsp}?text=${encodeURIComponent("Hola Credi Avanza, deseo información sobre un préstamo personal.")}`;
  document.querySelectorAll(".cfg-whatsapp-link").forEach(el => {
    el.href = wspLink;
    el.target = "_blank";
  });

  const numTel = (data.telefono_atencion || "017008920").replace(/[^\d+]/g, "");
  document.querySelectorAll(".cfg-tel-link").forEach(el => {
    el.href = `tel:${numTel}`;
  });

  const emailVal = data.email_contacto || "crediavanzape@gmail.com";
  document.querySelectorAll(".cfg-email-link").forEach(el => {
    el.href = `mailto:${emailVal}`;
  });
}

/**
 * Inicializa el selector de tarjetas de monto
 */
function inicializarSelectorMontos() {
  const cards = document.querySelectorAll(".amount-card");
  const slider = document.getElementById("slider-monto");

  cards.forEach(card => {
    card.addEventListener("click", () => {
      const valor = parseFloat(card.dataset.monto);
      setMonto(valor);
    });
  });

  if (slider) {
    slider.addEventListener("input", (e) => {
      const valor = parseFloat(e.target.value);
      setMonto(valor, false);
    });
  }
}

/**
 * Inicializa el selector de botones de plazo
 */
function inicializarSelectorPlazos() {
  const pills = document.querySelectorAll(".term-pill");
  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      const meses = parseInt(pill.dataset.plazo);
      setPlazo(meses);
    });
  });
}

function setMonto(valor, actualizarSlider = true) {
  AppState.monto = valor;

  // Actualizar tarjetas activas
  document.querySelectorAll(".amount-card").forEach(c => {
    if (parseFloat(c.dataset.monto) === valor) {
      c.classList.add("active");
    } else {
      c.classList.remove("active");
    }
  });

  // Actualizar slider
  const slider = document.getElementById("slider-monto");
  if (slider && actualizarSlider) {
    slider.value = valor;
  }

  // Actualizar campos de texto
  const displayMonto = document.querySelectorAll(".display-monto");
  displayMonto.forEach(el => {
    el.textContent = `S/ ${formatearNumero(valor)}`;
  });

  const inputFormMonto = document.getElementById("form-monto");
  if (inputFormMonto) {
    inputFormMonto.value = valor;
  }

  actualizarSimulador();
}

function setPlazo(meses) {
  AppState.plazo = meses;

  document.querySelectorAll(".term-pill").forEach(p => {
    if (parseInt(p.dataset.plazo) === meses) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });

  const displayPlazo = document.querySelectorAll(".display-plazo");
  displayPlazo.forEach(el => {
    el.textContent = `${meses} meses`;
  });

  const selectFormPlazo = document.getElementById("form-plazo");
  if (selectFormPlazo) {
    selectFormPlazo.value = meses;
  }

  actualizarSimulador();
}

/**
 * Calcula la cuota mensual referencial bajo el método francés
 */
function actualizarSimulador() {
  const monto = AppState.monto;
  const n = AppState.plazo;
  const tea = AppState.teaReferencial / 100.0;
  const desgravamen = AppState.desgravamenMensual / 100.0;

  // Tasa efectiva mensual
  const tem = Math.pow(1.0 + tea, 1.0 / 12.0) - 1.0;

  let cuotaBase = 0;
  if (tem > 0 && n > 0) {
    const factor = (tem * Math.pow(1.0 + tem, n)) / (Math.pow(1.0 + tem, n) - 1.0);
    cuotaBase = monto * factor;
  } else {
    cuotaBase = monto / n;
  }

  // Seguro de desgravamen referencial
  const seguroMensual = monto * desgravamen * 0.55;
  const cuotaTotal = Math.round((cuotaBase + seguroMensual) * 100) / 100;
  AppState.cuotaEstimada = cuotaTotal;

  // Actualizar en interfaz
  const elements = document.querySelectorAll(".display-cuota");
  elements.forEach(el => {
    el.textContent = `S/ ${formatearNumero(cuotaTotal)}`;
  });

  const elCuotaForm = document.getElementById("resumen-cuota-estimada");
  if (elCuotaForm) {
    elCuotaForm.textContent = `S/ ${formatearNumero(cuotaTotal)}`;
  }
}

/**
 * Inicializa las cascadas de Ubigeo Peruano (Departamento -> Provincia -> Distrito)
 */
function inicializarUbigeo() {
  const selDep = document.getElementById("form-departamento");
  const selProv = document.getElementById("form-provincia");
  const selDist = document.getElementById("form-distrito");

  if (!selDep || !selProv || !selDist || typeof UBIGEO_PERU === "undefined") return;

  // Poblar Departamentos
  selDep.innerHTML = '<option value="">Selecciona Departamento...</option>';
  Object.keys(UBIGEO_PERU).sort().forEach(dep => {
    const opt = document.createElement("option");
    opt.value = dep;
    opt.textContent = dep;
    selDep.appendChild(opt);
  });

  selDep.addEventListener("change", () => {
    const depVal = selDep.value;
    selProv.innerHTML = '<option value="">Selecciona Provincia...</option>';
    selDist.innerHTML = '<option value="">Selecciona Distrito...</option>';
    selProv.disabled = !depVal;
    selDist.disabled = true;

    if (depVal && UBIGEO_PERU[depVal]) {
      Object.keys(UBIGEO_PERU[depVal]).sort().forEach(prov => {
        const opt = document.createElement("option");
        opt.value = prov;
        opt.textContent = prov;
        selProv.appendChild(opt);
      });
    }
  });

  selProv.addEventListener("change", () => {
    const depVal = selDep.value;
    const provVal = selProv.value;
    selDist.innerHTML = '<option value="">Selecciona Distrito...</option>';
    selDist.disabled = !provVal;

    if (depVal && provVal && UBIGEO_PERU[depVal] && UBIGEO_PERU[depVal][provVal]) {
      UBIGEO_PERU[depVal][provVal].sort().forEach(dist => {
        const opt = document.createElement("option");
        opt.value = dist;
        opt.textContent = dist;
        selDist.appendChild(opt);
      });
    }
  });
}

/**
 * Vinculación de eventos para el formulario de 3 pasos
 */
function configurarEventosFormulario() {
  // Botones de inicio / CTA hacia el formulario
  document.querySelectorAll(".btn-ir-solicitud").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      irAStep(1);
      const seccionForm = document.getElementById("solicitud-wizard");
      if (seccionForm) {
        seccionForm.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // Checkbox: "Mi WhatsApp es el mismo que mi celular"
  const chkMismoWsp = document.getElementById("form-mismo-wsp");
  const telInput = document.getElementById("form-telefono");
  const wspInput = document.getElementById("form-whatsapp");
  if (chkMismoWsp && telInput && wspInput) {
    chkMismoWsp.addEventListener("change", () => {
      if (chkMismoWsp.checked) {
        wspInput.value = telInput.value;
        wspInput.disabled = true;
        limpiarError(wspInput);
      } else {
        wspInput.disabled = false;
      }
    });

    telInput.addEventListener("input", () => {
      if (chkMismoWsp.checked) {
        wspInput.value = telInput.value;
      }
    });
  }

  // Cambio dinámico de tipo de documento para actualizar placeholder y validación
  const selTipoDoc = document.getElementById("form-tipo-documento");
  const numDocInput = document.getElementById("form-numero-documento");
  if (selTipoDoc && numDocInput) {
    selTipoDoc.addEventListener("change", () => {
      const tipo = selTipoDoc.value;
      limpiarError(numDocInput);
      if (tipo === "DNI") {
        numDocInput.placeholder = "8 dígitos numéricos (ej. 45678912)";
        numDocInput.maxLength = 8;
      } else if (tipo === "CE") {
        numDocInput.placeholder = "9 a 12 caracteres (Carné de Extranjería)";
        numDocInput.maxLength = 12;
      } else {
        numDocInput.placeholder = "Número de pasaporte";
        numDocInput.maxLength = 12;
      }
    });
  }

  // Botón Continuar Paso 1 -> Paso 2
  const btnPaso1Siguiente = document.getElementById("btn-paso1-siguiente");
  if (btnPaso1Siguiente) {
    btnPaso1Siguiente.addEventListener("click", () => {
      if (validarPaso1()) {
        irAStep(2);
      }
    });
  }

  // Botón Volver Paso 2 -> Paso 1
  const btnPaso2Atras = document.getElementById("btn-paso2-atras");
  if (btnPaso2Atras) {
    btnPaso2Atras.addEventListener("click", () => {
      irAStep(1);
    });
  }

  // Botón Continuar Paso 2 -> Paso 3
  const btnPaso2Siguiente = document.getElementById("btn-paso2-siguiente");
  if (btnPaso2Siguiente) {
    btnPaso2Siguiente.addEventListener("click", () => {
      if (validarPaso2()) {
        generarResumenPaso3();
        irAStep(3);
      }
    });
  }

  // Botón Volver Paso 3 -> Paso 2
  const btnPaso3Atras = document.getElementById("btn-paso3-atras");
  if (btnPaso3Atras) {
    btnPaso3Atras.addEventListener("click", () => {
      irAStep(2);
    });
  }

  // Envío final del formulario (Paso 3)
  const formSolicitud = document.getElementById("form-solicitud");
  if (formSolicitud) {
    formSolicitud.addEventListener("submit", async (e) => {
      e.preventDefault();
      await enviarSolicitud();
    });
  }

  // Botón Volver al inicio tras éxito
  const btnVolverInicio = document.getElementById("btn-volver-inicio");
  if (btnVolverInicio) {
    btnVolverInicio.addEventListener("click", () => {
      // Reiniciar formulario limpiamente
      if (formSolicitud) formSolicitud.reset();
      setMonto(5000);
      setPlazo(24);
      irAStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

/**
 * Control del Wizard de Pasos
 */
function irAStep(step) {
  AppState.currentStep = step;

  // Ocultar contenedores de pasos
  document.querySelectorAll(".step-panel").forEach(panel => {
    panel.classList.add("hidden");
  });

  const panelActual = document.getElementById(`step-panel-${step}`);
  if (panelActual) {
    panelActual.classList.remove("hidden");
  }

  // Actualizar indicadores de la barra superior
  const indicators = document.querySelectorAll(".step-item");
  indicators.forEach(item => {
    const s = parseInt(item.dataset.step);
    item.classList.remove("active", "completed", "pending");
    if (s === step) {
      item.classList.add("active");
    } else if (s < step) {
      item.classList.add("completed");
    } else {
      item.classList.add("pending");
    }
  });

  // Desplazar al encabezado del wizard
  const wizardEl = document.getElementById("solicitud-wizard");
  if (wizardEl) {
    wizardEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Validación de Paso 1: Préstamo
 */
function validarPaso1() {
  const montoInput = document.getElementById("form-monto");
  const plazoSelect = document.getElementById("form-plazo");
  const finalidadSelect = document.getElementById("form-finalidad");

  let valido = true;
  let primerInvalido = null;

  const monto = parseFloat(montoInput ? montoInput.value : 5000);
  if (isNaN(monto) || monto < 500 || monto > 30000) {
    if (montoInput) mostrarError(montoInput, "Selecciona un monto entre S/ 500 y S/ 30,000.");
    valido = false;
    if (!primerInvalido) primerInvalido = montoInput;
  } else {
    if (montoInput) limpiarError(montoInput);
    AppState.monto = monto;
  }

  const plazo = parseInt(plazoSelect ? plazoSelect.value : 24);
  if (isNaN(plazo) || plazo <= 0) {
    if (plazoSelect) mostrarError(plazoSelect, "Selecciona un plazo válido.");
    valido = false;
    if (!primerInvalido) primerInvalido = plazoSelect;
  } else {
    if (plazoSelect) limpiarError(plazoSelect);
    AppState.plazo = plazo;
  }

  const finalidadVal = finalidadSelect ? finalidadSelect.value : "";
  if (!finalidadVal) {
    if (finalidadSelect) {
      finalidadSelect.value = "Libre disponibilidad personal";
      AppState.finalidad = "Libre disponibilidad personal";
      limpiarError(finalidadSelect);
    }
  } else {
    if (finalidadSelect) limpiarError(finalidadSelect);
    AppState.finalidad = finalidadVal;
  }

  if (!valido && primerInvalido) {
    primerInvalido.scrollIntoView({ behavior: "smooth", block: "center" });
    try { primerInvalido.focus(); } catch (e) {}
  }

  actualizarSimulador();
  return valido;
}

/**
 * Validación de Paso 2: Información Personal
 */
function validarPaso2() {
  let valido = true;
  let primerInvalido = null;

  function setInvalido(inputEl, msg) {
    if (!inputEl) return;
    mostrarError(inputEl, msg);
    valido = false;
    if (!primerInvalido) primerInvalido = inputEl;
  }

  // Nombres
  const nombresInput = document.getElementById("form-nombres");
  if (!nombresInput || !nombresInput.value.trim() || nombresInput.value.trim().length < 2) {
    setInvalido(nombresInput, "Ingresa tus nombres completos.");
  } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(nombresInput.value.trim())) {
    setInvalido(nombresInput, "Ingresa únicamente caracteres alfabéticos válidos.");
  } else {
    limpiarError(nombresInput);
  }

  // Apellidos
  const apellidosInput = document.getElementById("form-apellidos");
  if (!apellidosInput || !apellidosInput.value.trim() || apellidosInput.value.trim().length < 2) {
    setInvalido(apellidosInput, "Ingresa tus apellidos completos.");
  } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(apellidosInput.value.trim())) {
    setInvalido(apellidosInput, "Ingresa únicamente caracteres alfabéticos válidos.");
  } else {
    limpiarError(apellidosInput);
  }

  // Tipo y Número de Documento
  const selTipoDoc = document.getElementById("form-tipo-documento");
  const tipoDoc = selTipoDoc ? selTipoDoc.value : "DNI";
  const numDocInput = document.getElementById("form-numero-documento");
  const docVal = numDocInput ? numDocInput.value.trim().replace(/\s/g, "") : "";

  if (tipoDoc === "DNI") {
    if (!/^\d{8}$/.test(docVal)) {
      setInvalido(numDocInput, "El DNI peruano debe tener exactamente 8 dígitos numéricos.");
    } else {
      if (numDocInput) limpiarError(numDocInput);
    }
  } else if (tipoDoc === "CE") {
    if (!/^[a-zA-Z0-9]{9,12}$/.test(docVal)) {
      setInvalido(numDocInput, "El Carné de Extranjería debe tener entre 9 y 12 caracteres alfanuméricos.");
    } else {
      if (numDocInput) limpiarError(numDocInput);
    }
  } else {
    if (!/^[a-zA-Z0-9]{6,12}$/.test(docVal)) {
      setInvalido(numDocInput, "El documento debe tener entre 6 y 12 caracteres.");
    } else {
      if (numDocInput) limpiarError(numDocInput);
    }
  }

  // Fecha de Nacimiento (Mayor de 18 años)
  const fnInput = document.getElementById("form-fecha-nacimiento");
  if (!fnInput || !fnInput.value) {
    setInvalido(fnInput, "Ingresa tu fecha de nacimiento.");
  } else {
    const fn = new Date(fnInput.value);
    const hoy = new Date();
    let edad = hoy.getFullYear() - fn.getFullYear();
    const m = hoy.getMonth() - fn.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) {
      edad--;
    }

    if (isNaN(edad) || edad < 18) {
      setInvalido(fnInput, "Debes ser mayor de 18 años para solicitar un préstamo.");
    } else if (edad > 85) {
      setInvalido(fnInput, "La edad máxima de evaluación es 85 años.");
    } else {
      limpiarError(fnInput);
    }
  }

  // Teléfono Celular (9 dígitos peruanos)
  const telInput = document.getElementById("form-telefono");
  const telVal = telInput ? telInput.value.trim().replace(/\s/g, "") : "";
  if (!/^9\d{8}$/.test(telVal)) {
    setInvalido(telInput, "El celular debe tener 9 dígitos y empezar con 9 (ej. 987654321).");
  } else {
    if (telInput) limpiarError(telInput);
  }

  // WhatsApp
  const wspInput = document.getElementById("form-whatsapp");
  const wspVal = wspInput ? wspInput.value.trim().replace(/\s/g, "") : "";
  if (!/^9\d{8}$/.test(wspVal)) {
    setInvalido(wspInput, "El WhatsApp debe tener 9 dígitos y empezar con 9.");
  } else {
    if (wspInput) limpiarError(wspInput);
  }

  // Email
  const emailInput = document.getElementById("form-email");
  const emailVal = emailInput ? emailInput.value.trim() : "";
  if (!/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(emailVal)) {
    setInvalido(emailInput, "Ingresa un correo electrónico válido (ej. juan@gmail.com).");
  } else {
    if (emailInput) limpiarError(emailInput);
  }

  // Ubicación: Departamento, Provincia, Distrito
  const depSelect = document.getElementById("form-departamento");
  const provSelect = document.getElementById("form-provincia");
  const distSelect = document.getElementById("form-distrito");

  if (!depSelect || !depSelect.value) {
    setInvalido(depSelect, "Selecciona tu departamento de residencia.");
  } else {
    limpiarError(depSelect);
  }

  if (!provSelect || !provSelect.value) {
    setInvalido(provSelect, "Selecciona tu provincia.");
  } else {
    limpiarError(provSelect);
  }

  if (!distSelect || !distSelect.value) {
    setInvalido(distSelect, "Selecciona tu distrito.");
  } else {
    limpiarError(distSelect);
  }

  // Dirección
  const dirInput = document.getElementById("form-direccion");
  if (!dirInput || !dirInput.value.trim() || dirInput.value.trim().length < 4) {
    setInvalido(dirInput, "Ingresa tu dirección domiciliaria completa.");
  } else {
    limpiarError(dirInput);
  }

  // Situación laboral
  const labSelect = document.getElementById("form-situacion-laboral");
  if (!labSelect || !labSelect.value) {
    setInvalido(labSelect, "Selecciona tu situación laboral actual.");
  } else {
    limpiarError(labSelect);
  }

  // Ingresos mensuales
  const ingInput = document.getElementById("form-ingresos");
  const ingVal = ingInput ? parseFloat(ingInput.value) : 0;
  if (isNaN(ingVal) || ingVal < 300) {
    setInvalido(ingInput, "Indica tus ingresos mensuales netos aproximados (mínimo S/ 300).");
  } else {
    if (ingInput) limpiarError(ingInput);
  }

  if (!valido && primerInvalido) {
    primerInvalido.scrollIntoView({ behavior: "smooth", block: "center" });
    try { primerInvalido.focus(); } catch (e) {}
  }

  return valido;
}

/**
 * Genera el resumen visual en el Paso 3 para revisión del usuario
 */
function generarResumenPaso3() {
  function safeSet(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  const monto = AppState.monto || 5000;
  const plazo = AppState.plazo || 24;
  const cuota = AppState.cuotaEstimada || 0;

  const finalidadSelect = document.getElementById("form-finalidad");
  const finalidadTexto = finalidadSelect && finalidadSelect.selectedIndex >= 0
    ? (finalidadSelect.options[finalidadSelect.selectedIndex]?.text || finalidadSelect.value)
    : (AppState.finalidad || "Libre disponibilidad personal");

  const nombres = document.getElementById("form-nombres")?.value.trim() || "";
  const apellidos = document.getElementById("form-apellidos")?.value.trim() || "";
  const tipoDoc = document.getElementById("form-tipo-documento")?.value || "DNI";
  const numDoc = document.getElementById("form-numero-documento")?.value.trim() || "";
  const fechaNac = document.getElementById("form-fecha-nacimiento")?.value || "";
  const telefono = document.getElementById("form-telefono")?.value.trim() || "";
  const whatsapp = document.getElementById("form-whatsapp")?.value.trim() || "";
  const email = document.getElementById("form-email")?.value.trim() || "";
  
  const dep = document.getElementById("form-departamento")?.value || "";
  const prov = document.getElementById("form-provincia")?.value || "";
  const dist = document.getElementById("form-distrito")?.value || "";
  const direccion = document.getElementById("form-direccion")?.value.trim() || "";

  const labSelect = document.getElementById("form-situacion-laboral");
  const laboralTexto = labSelect && labSelect.selectedIndex >= 0
    ? (labSelect.options[labSelect.selectedIndex]?.text || labSelect.value)
    : "";
  const ingresosVal = parseFloat(document.getElementById("form-ingresos")?.value || 0);

  // Inyectar en elementos de resumen con protección total contra null
  safeSet("resumen-monto", `S/ ${formatearNumero(monto)}`);
  safeSet("resumen-plazo", `${plazo} meses`);
  safeSet("resumen-cuota", `S/ ${formatearNumero(cuota)} / mes*`);
  safeSet("resumen-finalidad", finalidadTexto);

  safeSet("resumen-titular", `${nombres} ${apellidos}`);
  safeSet("resumen-documento", `${tipoDoc}: ${numDoc}`);
  safeSet("resumen-fecha-nac", fechaNac);
  safeSet("resumen-contacto", `Cel: ${telefono} | WhatsApp: ${whatsapp}`);
  safeSet("resumen-email", email);
  safeSet("resumen-ubicacion", `${dist}, ${prov}, ${dep}`);
  safeSet("resumen-direccion", direccion);
  safeSet("resumen-laboral", laboralTexto);
  safeSet("resumen-ingresos", `S/ ${formatearNumero(ingresosVal)} / mes`);
}

/**
 * Envío al backend de la solicitud
 */
async function enviarSolicitud() {
  const btnEnviar = document.getElementById("btn-enviar-solicitud");
  const chkPolitica = document.getElementById("form-acepta-politica");
  const chkAutoriza = document.getElementById("form-autoriza-contacto");
  const errorContainer = document.getElementById("envio-error-msg");

  if (errorContainer) errorContainer.classList.add("hidden");

  // Validar checkboxes obligatorios
  if (!chkPolitica.checked) {
    alert("Debes aceptar la Política de Privacidad y Tratamiento de Datos Personales conforme a la Ley N.º 29733 para continuar.");
    chkPolitica.focus();
    return;
  }

  if (!chkAutoriza.checked) {
    alert("Debes autorizar el contacto para que nuestros asesores puedan evaluar y gestionar tu solicitud de financiamiento.");
    chkAutoriza.focus();
    return;
  }

  // Recopilar payload
  const payload = {
    monto: AppState.monto,
    plazo: AppState.plazo,
    finalidad: document.getElementById("form-finalidad").value,
    nombres: document.getElementById("form-nombres").value.trim(),
    apellidos: document.getElementById("form-apellidos").value.trim(),
    tipo_documento: document.getElementById("form-tipo-documento").value,
    numero_documento: document.getElementById("form-numero-documento").value.trim(),
    fecha_nacimiento: document.getElementById("form-fecha-nacimiento").value,
    telefono: document.getElementById("form-telefono").value.trim(),
    whatsapp: document.getElementById("form-whatsapp").value.trim(),
    email: document.getElementById("form-email").value.trim(),
    departamento: document.getElementById("form-departamento").value,
    provincia: document.getElementById("form-provincia").value,
    distrito: document.getElementById("form-distrito").value,
    direccion: document.getElementById("form-direccion").value.trim(),
    situacion_laboral: document.getElementById("form-situacion-laboral").value,
    ingresos_mensuales: parseFloat(document.getElementById("form-ingresos").value),
    acepta_politica: chkPolitica.checked,
    autoriza_contacto: chkAutoriza.checked,
    website_antispam: document.getElementById("form-antispam") ? document.getElementById("form-antispam").value : ""
  };

  // Bloquear botón y mostrar spinner elegante
  const textoOriginalBtn = btnEnviar.innerHTML;
  btnEnviar.disabled = true;
  btnEnviar.innerHTML = `
    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Enviando solicitud segura al servidor...
  `;

  try {
    const res = await fetch("/api/solicitar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      // Manejar error sin perder datos del usuario
      let msg = data.detail || "Ocurrió un error al procesar tu solicitud. Por favor verifica tus datos e inténtalo de nuevo.";
      if (Array.isArray(data.detail)) {
        msg = data.detail.map(d => d.msg || d).join(". ");
      }
      mostrarErrorEnvio(msg);
      btnEnviar.disabled = false;
      btnEnviar.innerHTML = textoOriginalBtn;
      return;
    }

    // ¡ÉXITO REAL CONFIRMADO POR EL SERVIDOR!
    mostrarPantallaConfirmacion(data);

  } catch (err) {
    console.error("Error de conexión:", err);
    mostrarErrorEnvio("No se pudo conectar con el servidor de Credi Avanza. Por favor revisa tu conexión a internet y vuelve a pulsar 'ENVIAR MI SOLICITUD'. Tus datos están guardados.");
    btnEnviar.disabled = false;
    btnEnviar.innerHTML = textoOriginalBtn;
  }
}

/**
 * Muestra la pantalla de confirmación (Sección 7)
 */
function mostrarPantallaConfirmacion(data) {
  // Ocultar formulario
  document.getElementById("seccion-formulario-wrapper").classList.add("hidden");

  // Mostrar contenedor de confirmación
  const exitoCont = document.getElementById("seccion-confirmacion-exito");
  exitoCont.classList.remove("hidden");

  // Asignar código de seguimiento
  const codigoEl = document.getElementById("confirmacion-codigo-solicitud");
  if (codigoEl) {
    codigoEl.textContent = data.codigo || "CA-2026-REGISTRADA";
  }

  // Scroll suave al inicio de la pantalla de confirmación
  exitoCont.scrollIntoView({ behavior: "smooth", block: "center" });
}

function mostrarErrorEnvio(mensaje) {
  const errBox = document.getElementById("envio-error-msg");
  if (errBox) {
    errBox.textContent = mensaje;
    errBox.classList.remove("hidden");
    errBox.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    alert(mensaje);
  }
}

/**
 * Funciones de ayuda UI
 */
function mostrarError(inputEl, mensaje) {
  inputEl.classList.add("is-invalid");
  let err = inputEl.parentElement.querySelector(".error-text");
  if (!err) {
    err = document.createElement("p");
    err.className = "error-text";
    inputEl.parentElement.appendChild(err);
  }
  err.innerHTML = `
    <svg class="w-4 h-4 inline shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
    </svg>
    <span>${mensaje}</span>
  `;
}

function limpiarError(inputEl) {
  inputEl.classList.remove("is-invalid");
  const err = inputEl.parentElement.querySelector(".error-text");
  if (err) {
    err.remove();
  }
}

function formatearNumero(num) {
  return Number(num).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Modales de Política de Privacidad y Reclamaciones
 */
function configurarModales() {
  const modalPolitica = document.getElementById("modal-politica");
  const modalTerminos = document.getElementById("modal-terminos");
  const modalReclamaciones = document.getElementById("modal-reclamaciones");

  // Abrir Política
  document.querySelectorAll(".btn-abrir-politica").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (modalPolitica) modalPolitica.classList.remove("hidden");
    });
  });

  // Abrir Términos
  document.querySelectorAll(".btn-abrir-terminos").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (modalTerminos) modalTerminos.classList.remove("hidden");
    });
  });

  // Abrir Libro de Reclamaciones
  document.querySelectorAll(".btn-abrir-reclamaciones").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (modalReclamaciones) modalReclamaciones.classList.remove("hidden");
    });
  });

  // Botones de cierre general
  document.querySelectorAll(".btn-cerrar-modal").forEach(btn => {
    btn.addEventListener("click", () => {
      if (modalPolitica) modalPolitica.classList.add("hidden");
      if (modalTerminos) modalTerminos.classList.add("hidden");
      if (modalReclamaciones) modalReclamaciones.classList.add("hidden");
    });
  });
}

function configurarNavegacionMovil() {
  const btnMenu = document.getElementById("btn-menu-movil");
  const menuMovil = document.getElementById("menu-movil-desplegable");

  if (btnMenu && menuMovil) {
    btnMenu.addEventListener("click", () => {
      menuMovil.classList.toggle("hidden");
    });

    menuMovil.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        menuMovil.classList.add("hidden");
      });
    });
  }
}
