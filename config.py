"""
Configuración y parámetros para CREDI AVANZA
Plataforma fintech de evaluación de préstamos en Perú
"""
from typing import List, Dict

MONTOS_DISPONIBLES: List[float] = [
    500.0,
    1000.0,
    2000.0,
    3000.0,
    4000.0,
    5000.0,
    10000.0,
    15000.0,
    20000.0,
    25000.0,
    30000.0
]

PLAZOS_DISPONIBLES: List[int] = [
    6,
    12,
    24,
    36,
    48,
    60,
    72,
    84
]

FINALIDADES_PRESTAMO: List[Dict[str, str]] = [
    {"id": "consolidacion", "nombre": "Consolidación de deudas"},
    {"id": "negocio", "nombre": "Capital de trabajo / Emprendimiento"},
    {"id": "hogar", "nombre": "Mejora o refacción del hogar"},
    {"id": "salud", "nombre": "Salud y gastos médicos"},
    {"id": "educacion", "nombre": "Estudios y capacitación"},
    {"id": "vehiculo", "nombre": "Mantenimiento o compra de vehículo"},
    {"id": "personal", "nombre": "Libre disponibilidad personal"},
    {"id": "otro", "nombre": "Otro proyecto personal"}
]

SITUACIONES_LABORALES: List[Dict[str, str]] = [
    {"id": "dependiente", "nombre": "Empleado dependiente (Planilla / 5ta categoría)"},
    {"id": "independiente", "nombre": "Trabajador independiente (Honorarios / 4ta categoría)"},
    {"id": "empresario", "nombre": "Empresario / Negocio propio (RUC 10 o 20 / 3ra categoría)"},
    {"id": "jubilado", "nombre": "Jubilado / Pensionista"},
    {"id": "otro", "nombre": "Otro tipo de ingresos"}
]

def calcular_cuota_referencial(monto: float, plazo_meses: int, tea_anual_pct: float = 28.5, desgravamen_mensual_pct: float = 0.075) -> float:
    """
    Calcula la cuota mensual referencial usando el método francés
    TEA: Tasa Efectiva Anual (ej. 28.5%)
    Desgravamen: Seguro referencial mensual sobre saldo (ej. 0.075%)
    """
    if monto <= 0 or plazo_meses <= 0:
        return 0.0
    
    # Tasa Efectiva Mensual (TEM) a partir de la TEA
    tea_decimal = tea_anual_pct / 100.0
    tem = ((1.0 + tea_decimal) ** (1.0 / 12.0)) - 1.0
    
    # Cuota francesa = P * (i / (1 - (1+i)^-n))
    if tem > 0:
        factor = (tem * ((1.0 + tem) ** plazo_meses)) / (((1.0 + tem) ** plazo_meses) - 1.0)
        cuota_capital_interes = monto * factor
    else:
        cuota_capital_interes = monto / plazo_meses
        
    # Seguro de desgravamen promedio referencial sobre saldo
    seguro_desgravamen_promedio = monto * (desgravamen_mensual_pct / 100.0) * 0.55
    
    cuota_total = cuota_capital_interes + seguro_desgravamen_promedio
    return round(cuota_total, 2)
