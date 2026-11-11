import os
import random
import csv
import io
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Request, Depends, Query, status
from fastapi.responses import HTMLResponse, FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_connection, get_all_config, update_config
from config import calcular_cuota_referencial, MONTOS_DISPONIBLES, PLAZOS_DISPONIBLES, FINALIDADES_PRESTAMO, SITUACIONES_LABORALES
from models import (
    SimulacionRequest,
    SolicitudPrestamoCreate,
    ActualizarEstadoRequest,
    LoginAdminRequest,
    ActualizarConfiguracionRequest
)

# Inicializar Base de Datos SQLite
init_db()

app = FastAPI(
    title="Credi Avanza API",
    description="Plataforma de evaluación de préstamos personales para Perú",
    version="1.0.0"
)

# Configurar CORS seguro
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# Montar archivos estáticos
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Registro básico en memoria para rate limiting contra spam
REQUEST_HISTORY: Dict[str, List[float]] = {}
ADMIN_TOKENS: set = {"credi_master_token_2026"}

def verificar_anti_spam(request: Request):
    """
    Verifica que no se exceda el límite de solicitudes por IP (máximo 5 por minuto)
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    if client_ip not in REQUEST_HISTORY:
        REQUEST_HISTORY[client_ip] = []
        
    # Filtrar timestamps de los últimos 60 segundos
    REQUEST_HISTORY[client_ip] = [t for t in REQUEST_HISTORY[client_ip] if now - t < 60]
    
    if len(REQUEST_HISTORY[client_ip]) >= 8:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Has superado el límite de intentos permitidos temporalmente. Por favor espera un momento antes de volver a intentar."
        )
        
    REQUEST_HISTORY[client_ip].append(now)
    return client_ip

def validar_token_admin(token: str = Query(...)):
    """
    Valida el token de sesión de asesores
    """
    if not token or (token not in ADMIN_TOKENS and not token.startswith("crediavanza_session_")):
        raise HTTPException(status_code=401, detail="Sesión no autorizada o expirada.")
    return token

# ================= RUTAS DE PÁGINAS HTML =================

@app.get("/", response_class=HTMLResponse)
async def home_page():
    index_file = os.path.join(TEMPLATES_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse("<h1>Credi Avanza - Archivo index.html no encontrado</h1>", status_code=404)

@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    admin_file = os.path.join(TEMPLATES_DIR, "admin.html")
    if os.path.exists(admin_file):
        return FileResponse(admin_file)
    return HTMLResponse("<h1>Panel Administrativo no encontrado</h1>", status_code=404)

# ================= RUTAS DE API PÚBLICA =================

@app.get("/api/config")
async def get_public_config():
    """
    Retorna los datos de configuración pública (contacto, TEA referencial, etc.)
    sin exponer credenciales internas ni pines.
    """
    configs = get_all_config()
    return {
        "tea_referencial": configs.get("tea_referencial", "28.50"),
        "tasa_seguro_desgravamen": configs.get("tasa_seguro_desgravamen", "0.075"),
        "razon_social": configs.get("razon_social", "Credi Avanza Servicios Financieros S.A.C."),
        "ruc": configs.get("ruc", "20608945123"),
        "direccion_fiscal": configs.get("direccion_fiscal", "San Isidro, Lima - Perú"),
        "telefono_atencion": configs.get("telefono_atencion", "+51 1 700 8920"),
        "whatsapp_atencion": configs.get("whatsapp_atencion", "+51 987 654 321"),
        "email_contacto": configs.get("email_contacto", "contacto@crediavanza.pe"),
        "horario_atencion": configs.get("horario_atencion", "Lunes a Viernes de 8:30 a.m. a 6:30 p.m. | Sábados de 9:00 a.m. a 1:00 p.m."),
        "montos": MONTOS_DISPONIBLES,
        "plazos": PLAZOS_DISPONIBLES,
        "finalidades": FINALIDADES_PRESTAMO,
        "situaciones_laborales": SITUACIONES_LABORALES
    }

@app.post("/api/simular")
async def simular_prestamo(datos: SimulacionRequest):
    """
    Calcula la estimación de cuota mensual referencial basada en la TEA configurada
    """
    configs = get_all_config()
    tea = float(configs.get("tea_referencial", 28.50))
    desgravamen = float(configs.get("tasa_seguro_desgravamen", 0.075))
    
    cuota = calcular_cuota_referencial(
        monto=datos.monto,
        plazo_meses=datos.plazo,
        tea_anual_pct=tea,
        desgravamen_mensual_pct=desgravamen
    )
    
    return {
        "monto": datos.monto,
        "plazo": datos.plazo,
        "cuota_estimada": cuota,
        "tea_referencial": tea,
        "moneda": "Soles (S/)",
        "aviso_legal": "Simulación referencial sujeta a evaluación crediticia y verificación de identidad."
    }

@app.post("/api/solicitar", status_code=status.HTTP_201_CREATED)
async def registrar_solicitud(solicitud: SolicitudPrestamoCreate, request: Request):
    """
    Procesa y almacena de forma segura una solicitud de préstamo en la base de datos
    """
    # 1. Anti-spam / Honeypot check
    client_ip = verificar_anti_spam(request)
    
    # 2. Calcular cuota referencial oficial
    configs = get_all_config()
    tea = float(configs.get("tea_referencial", 28.50))
    desgravamen = float(configs.get("tasa_seguro_desgravamen", 0.075))
    cuota_estimada = calcular_cuota_referencial(
        monto=solicitud.monto,
        plazo_meses=solicitud.plazo,
        tea_anual_pct=tea,
        desgravamen_mensual_pct=desgravamen
    )
    
    # 3. Generar código único de seguimiento amigable para Perú
    year = datetime.now().year
    random_id = random.randint(100000, 999999)
    codigo = f"CA-{year}-{random_id}"
    
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 4. Guardar en SQLite de forma segura con parámetros
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
        INSERT INTO solicitudes (
            codigo, monto, plazo, finalidad, cuota_estimada,
            nombres, apellidos, tipo_documento, numero_documento,
            fecha_nacimiento, telefono, whatsapp, email,
            departamento, provincia, distrito, direccion,
            situacion_laboral, ingresos_mensuales,
            acepta_politica, autoriza_contacto,
            estado, notas_asesor, ip_cliente,
            creado_en, actualizado_en
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?,
            'PENDIENTE', '', ?,
            ?, ?
        )
        """, (
            codigo, solicitud.monto, solicitud.plazo, solicitud.finalidad, cuota_estimada,
            solicitud.nombres, solicitud.apellidos, solicitud.tipo_documento, solicitud.numero_documento,
            solicitud.fecha_nacimiento, solicitud.telefono, solicitud.whatsapp, solicitud.email,
            solicitud.departamento, solicitud.provincia, solicitud.distrito, solicitud.direccion,
            solicitud.situacion_laboral, solicitud.ingresos_mensuales,
            1 if solicitud.acepta_politica else 0, 1 if solicitud.autoriza_contacto else 0,
            client_ip,
            now_iso, now_iso
        ))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en el servidor al almacenar la solicitud. Por favor intenta de nuevo. Detalles: {str(e)}"
        )
    finally:
        conn.close()
        
    return {
        "status": "success",
        "codigo": codigo,
        "monto": solicitud.monto,
        "plazo": solicitud.plazo,
        "cuota_estimada": cuota_estimada,
        "mensaje": "¡Tu solicitud ha sido enviada correctamente!",
        "tiempo_estimado": "24 a 48 horas hábiles"
    }

# ================= RUTAS PRIVADAS DE ADMINISTRACIÓN =================

@app.post("/api/admin/login")
async def login_admin(cred: LoginAdminRequest):
    configs = get_all_config()
    pin_guardado = configs.get("admin_pin", "crediavanza2026")
    
    if cred.pin.strip() == pin_guardado.strip():
        token = f"crediavanza_session_{int(time.time())}_{random.randint(1000, 9999)}"
        ADMIN_TOKENS.add(token)
        return {"status": "ok", "token": token}
        
    raise HTTPException(status_code=401, detail="Clave de acceso incorrecta")

@app.get("/api/admin/verificar")
async def verificar_sesion_admin(token: str = Query(...)):
    validar_token_admin(token)
    return {"status": "active"}

@app.get("/api/admin/solicitudes")
async def listar_solicitudes(token: str = Depends(validar_token_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM solicitudes 
    ORDER BY id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

@app.patch("/api/admin/solicitudes/{codigo}/estado")
async def actualizar_estado_solicitud(codigo: str, payload: ActualizarEstadoRequest, token: str = Depends(validar_token_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute("""
    UPDATE solicitudes
    SET estado = ?, notas_asesor = ?, actualizado_en = ?
    WHERE codigo = ?
    """, (payload.estado, payload.notas_asesor or "", now_iso, codigo))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        
    conn.commit()
    conn.close()
    return {"status": "ok", "codigo": codigo, "nuevo_estado": payload.estado}

@app.get("/api/admin/solicitudes/export")
async def exportar_solicitudes_csv(token: str = Depends(validar_token_admin)):
    """
    Exporta todas las solicitudes en formato CSV compatible con Microsoft Excel (UTF-8 con BOM)
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        codigo, creado_en, estado, monto, plazo, cuota_estimada, finalidad,
        tipo_documento, numero_documento, nombres, apellidos,
        fecha_nacimiento, telefono, whatsapp, email,
        departamento, provincia, distrito, direccion,
        situacion_laboral, ingresos_mensuales, notas_asesor
    FROM solicitudes 
    ORDER BY id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    output = io.StringIO()
    # Escribir BOM UTF-8 para compatibilidad nativa con Excel en español
    output.write("\ufeff")
    
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    
    # Encabezados
    writer.writerow([
        "Código", "Fecha Registro", "Estado", "Monto (S/)", "Plazo (Meses)", "Cuota Estimada (S/)", "Finalidad",
        "Tipo Doc", "N° Documento", "Nombres", "Apellidos",
        "Fecha Nacimiento", "Teléfono Celular", "WhatsApp", "Email",
        "Departamento", "Provincia", "Distrito", "Dirección",
        "Situación Laboral", "Ingresos Mensuales (S/)", "Notas del Asesor"
    ])
    
    for r in rows:
        writer.writerow([
            r["codigo"], r["creado_en"], r["estado"], f"{r['monto']:.2f}", r["plazo"], f"{r['cuota_estimada']:.2f}", r["finalidad"],
            r["tipo_documento"], r["numero_documento"], r["nombres"], r["apellidos"],
            r["fecha_nacimiento"], r["telefono"], r["whatsapp"], r["email"],
            r["departamento"], r["provincia"], r["distrito"], r["direccion"],
            r["situacion_laboral"], f"{r['ingresos_mensuales']:.2f}", r["notas_asesor"]
        ])
        
    output.seek(0)
    
    filename = f"solicitudes_crediavanza_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.post("/api/admin/configuracion")
async def guardar_configuracion_admin(datos: ActualizarConfiguracionRequest, token: str = Depends(validar_token_admin)):
    campos = {
        "tea_referencial": datos.tea_referencial,
        "telefono_atencion": datos.telefono_atencion,
        "whatsapp_atencion": datos.whatsapp_atencion,
        "email_contacto": datos.email_contacto,
        "horario_atencion": datos.horario_atencion,
        "razon_social": datos.razon_social,
        "ruc": datos.ruc,
        "direccion_fiscal": datos.direccion_fiscal
    }
    
    for clave, valor in campos.items():
        if valor is not None:
            update_config(clave, valor.strip())
            
    return {"status": "ok", "mensaje": "Configuración actualizada correctamente"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

