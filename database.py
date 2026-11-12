"""
CREDI AVANZA - Módulo de Base de Datos y Persistencia Segura
Incluye auditoría de seguridad, gestión criptográfica de sesiones, RBAC y optimización WAL.
"""

import sqlite3
import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from security import (
    hash_password,
    verify_password,
    is_hash_pbkdf2,
    generate_secure_token,
    hash_token,
    SESSION_EXPIRATION_HOURS
)

DB_PATH = os.path.join(os.path.dirname(__file__), "crediavanza.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Optimizaciones de rendimiento y seguridad en SQLite
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Tabla de solicitudes de préstamos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS solicitudes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        monto REAL NOT NULL,
        plazo INTEGER NOT NULL,
        finalidad TEXT NOT NULL,
        cuota_estimada REAL NOT NULL,
        nombres TEXT NOT NULL,
        apellidos TEXT NOT NULL,
        tipo_documento TEXT NOT NULL,
        numero_documento TEXT NOT NULL,
        fecha_nacimiento TEXT NOT NULL,
        telefono TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        email TEXT NOT NULL,
        departamento TEXT NOT NULL,
        provincia TEXT NOT NULL,
        distrito TEXT NOT NULL,
        direccion TEXT NOT NULL,
        situacion_laboral TEXT NOT NULL,
        ingresos_mensuales REAL NOT NULL,
        acepta_politica INTEGER NOT NULL DEFAULT 1,
        autoriza_contacto INTEGER NOT NULL DEFAULT 1,
        estado TEXT NOT NULL DEFAULT 'PENDIENTE',
        notas_asesor TEXT DEFAULT '',
        ip_cliente TEXT DEFAULT '',
        creado_en TEXT NOT NULL,
        actualizado_en TEXT NOT NULL
    );
    """)

    # Índices para búsquedas seguras y rápidas
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_solicitudes_codigo ON solicitudes(codigo);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_solicitudes_doc ON solicitudes(numero_documento);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON solicitudes(creado_en);")

    # 2. Tabla de configuraciones del sistema
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS configuraciones (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL,
        descripcion TEXT
    );
    """)

    # 3. Tabla de sesiones administrativas activas (con almacenamiento de hashes SHA-256)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sesiones_admin (
        token_hash TEXT PRIMARY KEY,
        rol TEXT NOT NULL DEFAULT 'asesor',
        ip_creacion TEXT,
        user_agent TEXT,
        creado_en TEXT NOT NULL,
        expira_en TEXT NOT NULL,
        ultimo_acceso TEXT NOT NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones_admin(expira_en);")

    # 4. Tabla de registro de auditoría y eventos de ciberseguridad
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS auditoria_seguridad (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        evento TEXT NOT NULL,
        ip TEXT,
        usuario_rol TEXT,
        detalles TEXT,
        severidad TEXT NOT NULL DEFAULT 'INFO'
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_seguridad(fecha);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_auditoria_evento ON auditoria_seguridad(evento);")

    # 5. Configuraciones iniciales por defecto
    default_configs = [
        ("tea_referencial", "28.50", "Tasa Efectiva Anual (TEA) referencial estimada en porcentaje (%)"),
        ("tasa_seguro_desgravamen", "0.075", "Tasa mensual referencial de seguro de desgravamen (%)"),
        ("razon_social", "Credi Avanza Servicios Financieros S.A.C.", "Razón Social de la empresa en Perú"),
        ("ruc", "20609205572", "Número de RUC de la empresa"),
        ("direccion_fiscal", "Av. Víctor Andrés Belaúnde 147, San Isidro, Lima - Perú", "Domicilio fiscal de la empresa"),
        ("telefono_atencion", "+51 1 700 8920", "Teléfono de atención al cliente"),
        ("whatsapp_atencion", "+51 987 654 321", "WhatsApp de atención oficial"),
        ("email_contacto", "contacto@crediavanza.pe", "Correo electrónico de contacto y soporte"),
        ("horario_atencion", "Lunes a Viernes de 8:30 a.m. a 6:30 p.m. | Sábados de 9:00 a.m. a 1:00 p.m.", "Horario de atención a usuarios"),
        ("admin_pin", hash_password("crediavanza2026"), "Clave PBKDF2 del rol Administrador"),
        ("asesor_pin", hash_password("asesor2026"), "Clave PBKDF2 del rol Asesor Comercial"),
        ("modo_mantenimiento", "0", "Activar modo mantenimiento (0=No, 1=Sí)")
    ]

    for clave, valor, desc in default_configs:
        cursor.execute("""
        INSERT OR IGNORE INTO configuraciones (clave, valor, descripcion)
        VALUES (?, ?, ?)
        """, (clave, valor, desc))

    # Migración transparente de contraseñas: asegurar que las contraseñas existentes se encuentren hasheadas
    cursor.execute("SELECT clave, valor FROM configuraciones WHERE clave IN ('admin_pin', 'asesor_pin')")
    for row in cursor.fetchall():
        clave, val = row["clave"], row["valor"]
        if not is_hash_pbkdf2(val):
            hashed = hash_password(val)
            cursor.execute("UPDATE configuraciones SET valor = ? WHERE clave = ?", (hashed, clave))

    conn.commit()
    conn.close()

# -------------------------------------------------------------
# FUNCIONES DE CONSULTA Y CONFIGURACIÓN
# -------------------------------------------------------------

def get_all_config() -> Dict[str, str]:
    """Retorna las configuraciones públicas (excluyendo contraseñas y hashes sensibles)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT clave, valor FROM configuraciones WHERE clave NOT LIKE '%pin%' AND clave NOT LIKE '%secret%'")
    rows = cursor.fetchall()
    conn.close()
    return {row["clave"]: row["valor"] for row in rows}

def get_internal_config_value(clave: str) -> Optional[str]:
    """Retorna el valor interno de una clave de configuración específica."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT valor FROM configuraciones WHERE clave = ?", (clave,))
    row = cursor.fetchone()
    conn.close()
    return row["valor"] if row else None

def update_config(clave: str, valor: str):
    """Actualiza una clave de configuración de forma parametrizada y segura."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO configuraciones (clave, valor)
    VALUES (?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
    """, (clave, valor))
    conn.commit()
    conn.close()

# -------------------------------------------------------------
# GESTIÓN SEGURA DE SESIONES ADMINISTRATIVAS
# -------------------------------------------------------------

def crear_sesion(rol: str = "asesor", ip: str = "", user_agent: str = "") -> str:
    """
    Crea una sesión segura generando un token criptográfico de 256 bits.
    Guarda en base de datos únicamente el hash SHA-256 del token.
    Retorna el token en texto claro para entregarlo al cliente autenticado.
    """
    raw_token = generate_secure_token()
    token_h = hash_token(raw_token)
    now = datetime.now()
    expira = now + timedelta(hours=SESSION_EXPIRATION_HOURS)
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO sesiones_admin (token_hash, rol, ip_creacion, user_agent, creado_en, expira_en, ultimo_acceso)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        token_h,
        rol,
        ip,
        user_agent[:255] if user_agent else "",
        now.strftime("%Y-%m-%d %H:%M:%S"),
        expira.strftime("%Y-%m-%d %H:%M:%S"),
        now.strftime("%Y-%m-%d %H:%M:%S")
    ))
    conn.commit()
    conn.close()
    return raw_token

def obtener_sesion(raw_token: str) -> Optional[Dict[str, Any]]:
    """
    Valida un token contra el hash en base de datos y comprueba su fecha de expiración.
    Si la sesión expiró, la elimina automáticamente y retorna None.
    """
    if not raw_token:
        return None
    token_h = hash_token(raw_token)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sesiones_admin WHERE token_hash = ?", (token_h,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return None

    # Verificar si ya expiró
    if row["expira_en"] < now_str:
        cursor.execute("DELETE FROM sesiones_admin WHERE token_hash = ?", (token_h,))
        conn.commit()
        conn.close()
        return None

    # Renovar fecha de último acceso
    cursor.execute("UPDATE sesiones_admin SET ultimo_acceso = ? WHERE token_hash = ?", (now_str, token_h))
    conn.commit()
    conn.close()
    return dict(row)

def cerrar_sesion(raw_token: str):
    """Revoca una sesión eliminando su registro de la base de datos."""
    if not raw_token:
        return
    token_h = hash_token(raw_token)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sesiones_admin WHERE token_hash = ?", (token_h,))
    conn.commit()
    conn.close()

def limpiar_sesiones_expiradas():
    """Limpia periódicamente todas las sesiones cuya fecha de expiración haya vencido."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sesiones_admin WHERE expira_en < ?", (now_str,))
    conn.commit()
    conn.close()

# -------------------------------------------------------------
# AUDITORÍA DE SEGURIDAD
# -------------------------------------------------------------

def registrar_auditoria(evento: str, ip: str = "", usuario_rol: str = "", detalles: str = "", severidad: str = "INFO"):
    """
    Registra eventos críticos de seguridad en la tabla auditoria_seguridad.
    Eventos: LOGIN_EXITOSO, LOGIN_FALLIDO, BLOQUEO_BRUTE_FORCE, CAMBIO_CONFIG, EXPORT_CSV, CAMBIO_ESTADO, ACCESO_DENEGADO
    """
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO auditoria_seguridad (fecha, evento, ip, usuario_rol, detalles, severidad)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (now_str, evento, ip, usuario_rol, detalles[:500] if detalles else "", severidad))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error al registrar auditoría: {e}")

# -------------------------------------------------------------
# AUTENTICACIÓN MULTI-ROL (RBAC)
# -------------------------------------------------------------

def autenticar_usuario(pin_ingresado: str) -> Optional[str]:
    """
    Comprueba si el PIN ingresado corresponde a un 'admin' o 'asesor'.
    Retorna el rol ('admin' o 'asesor') si es válido, o None si es incorrecto.
    """
    if not pin_ingresado:
        return None

    admin_hash = get_internal_config_value("admin_pin")
    if admin_hash and verify_password(pin_ingresado, admin_hash):
        # Auto-migrar si aún no era PBKDF2
        if not is_hash_pbkdf2(admin_hash):
            update_config("admin_pin", hash_password(pin_ingresado))
        return "admin"

    asesor_hash = get_internal_config_value("asesor_pin")
    if asesor_hash and verify_password(pin_ingresado, asesor_hash):
        if not is_hash_pbkdf2(asesor_hash):
            update_config("asesor_pin", hash_password(pin_ingresado))
        return "asesor"

    return None

def cambiar_pin_rol(rol: str, nuevo_pin: str):
    """Actualiza la clave de acceso de un rol utilizando hashing PBKDF2."""
    if len(nuevo_pin) < 6:
        raise ValueError("La clave de acceso debe tener al menos 6 caracteres.")
    clave = "admin_pin" if rol == "admin" else "asesor_pin"
    hashed = hash_password(nuevo_pin)
    update_config(clave, hashed)

if __name__ == "__main__":
    init_db()
    print("Base de datos blindada e inicializada correctamente.")
