import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "crediavanza.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Tabla de solicitudes de préstamos
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
    )
    """)

    # Tabla de configuración de la plataforma
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS configuraciones (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL,
        descripcion TEXT
    )
    """)

    # Configuración inicial predeterminada
    default_configs = [
        ("tea_referencial", "28.50", "Tasa Efectiva Anual (TEA) referencial estimada en porcentaje (%)"),
        ("tasa_seguro_desgravamen", "0.075", "Tasa mensual referencial de seguro de desgravamen (%)"),
        ("razon_social", "Credi Avanza Servicios Financieros S.A.C.", "Razón Social de la empresa en Perú"),
        ("ruc", "20608945123", "Número de RUC de la empresa"),
        ("direccion_fiscal", "Av. Víctor Andrés Belaúnde 147, San Isidro, Lima - Perú", "Domicilio fiscal de la empresa"),
        ("telefono_atencion", "+51 1 700 8920", "Teléfono de atención al cliente"),
        ("whatsapp_atencion", "+51 987 654 321", "WhatsApp de atención oficial"),
        ("email_contacto", "contacto@crediavanza.pe", "Correo electrónico de contacto y soporte"),
        ("horario_atencion", "Lunes a Viernes de 8:30 a.m. a 6:30 p.m. | Sábados de 9:00 a.m. a 1:00 p.m.", "Horario de atención a usuarios"),
        ("admin_pin", "crediavanza2026", "Clave de acceso al panel privado de asesores"),
        ("modo_mantenimiento", "0", "Activar modo mantenimiento (0=No, 1=Sí)")
    ]

    for clave, valor, desc in default_configs:
        cursor.execute("""
        INSERT OR IGNORE INTO configuraciones (clave, valor, descripcion)
        VALUES (?, ?, ?)
        """, (clave, valor, desc))

    conn.commit()
    conn.close()

def get_all_config():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT clave, valor FROM configuraciones")
    rows = cursor.fetchall()
    conn.close()
    return {row["clave"]: row["valor"] for row in rows}

def update_config(clave, valor):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE configuraciones 
    SET valor = ?
    WHERE clave = ?
    """, (valor, clave))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Base de datos inicializada correctamente.")
