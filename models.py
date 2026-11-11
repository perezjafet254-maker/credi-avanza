import re
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from config import MONTOS_DISPONIBLES, PLAZOS_DISPONIBLES

class SimulacionRequest(BaseModel):
    monto: float = Field(..., description="Monto en soles a simular")
    plazo: int = Field(..., description="Plazo en meses")

    @field_validator("monto")
    @classmethod
    def validar_monto(cls, v):
        if v < 500 or v > 30000:
            raise ValueError("El monto debe estar comprendido entre S/ 500 y S/ 30,000.")
        return v

    @field_validator("plazo")
    @classmethod
    def validar_plazo(cls, v):
        if v not in PLAZOS_DISPONIBLES:
            raise ValueError(f"El plazo seleccionado no es válido. Opciones: {PLAZOS_DISPONIBLES}")
        return v

class SolicitudPrestamoCreate(BaseModel):
    # Paso 1: Información del préstamo
    monto: float = Field(..., ge=500, le=30000, description="Monto en Soles (S/)")
    plazo: int = Field(..., description="Plazo de financiamiento en meses")
    finalidad: str = Field(..., min_length=2, max_length=100, description="Finalidad del préstamo")
    
    # Paso 2: Información personal
    nombres: str = Field(..., min_length=2, max_length=80, description="Nombres completos")
    apellidos: str = Field(..., min_length=2, max_length=80, description="Apellidos completos")
    tipo_documento: str = Field(..., description="Tipo de documento: DNI, PASAPORTE o CE")
    numero_documento: str = Field(..., description="Número del documento de identidad")
    fecha_nacimiento: str = Field(..., description="Fecha de nacimiento en formato AAAA-MM-DD")
    telefono: str = Field(..., description="Número de teléfono celular (9 dígitos peruanos)")
    whatsapp: str = Field(..., description="Número de WhatsApp")
    email: str = Field(..., description="Correo electrónico válido")
    departamento: str = Field(..., min_length=2, max_length=50, description="Departamento de residencia")
    provincia: str = Field(..., min_length=2, max_length=60, description="Provincia de residencia")
    distrito: str = Field(..., min_length=2, max_length=60, description="Distrito de residencia")
    direccion: str = Field(..., min_length=5, max_length=150, description="Dirección domiciliaria")
    situacion_laboral: str = Field(..., min_length=2, max_length=60, description="Situación laboral")
    ingresos_mensuales: float = Field(..., ge=300, le=100000, description="Ingresos mensuales aproximados")
    
    # Paso 3: Aceptación y autorizaciones
    acepta_politica: bool = Field(..., description="Acepta Política de Privacidad y Ley 29733")
    autoriza_contacto: bool = Field(..., description="Autoriza contacto por WhatsApp/Teléfono/Email")
    
    # Campo trampa anti-spam (honeypot)
    website_antispam: Optional[str] = Field(default="", description="Honeypot para bots. Debe estar vacío.")

    @field_validator("monto")
    @classmethod
    def validar_monto(cls, v):
        if v not in MONTOS_DISPONIBLES and not (500 <= v <= 30000):
            raise ValueError("Monto fuera del rango permitido (S/ 500 a S/ 30,000).")
        return round(float(v), 2)

    @field_validator("plazo")
    @classmethod
    def validar_plazo(cls, v):
        if v not in PLAZOS_DISPONIBLES:
            raise ValueError(f"El plazo debe ser uno de los autorizados: {PLAZOS_DISPONIBLES} meses.")
        return v

    @field_validator("nombres", "apellidos")
    @classmethod
    def validar_nombres(cls, v):
        v = v.strip()
        if not re.match(r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$", v):
            raise ValueError("Solo se permiten letras, tildes y espacios.")
        return v

    @field_validator("tipo_documento")
    @classmethod
    def validar_tipo_doc(cls, v):
        tipos_validos = ["DNI", "PASAPORTE", "CE"]
        v_upper = v.strip().upper()
        if v_upper not in tipos_validos:
            raise ValueError(f"Tipo de documento inválido. Opciones: {', '.join(tipos_validos)}")
        return v_upper

    @field_validator("numero_documento")
    @classmethod
    def validar_numero_doc(cls, v, info):
        v = v.strip().replace(" ", "")
        tipo = info.data.get("tipo_documento", "DNI")
        if tipo == "DNI":
            if not re.match(r"^\d{8}$", v):
                raise ValueError("El DNI peruano debe contener exactamente 8 dígitos numéricos.")
        elif tipo == "CE":
            if not re.match(r"^[a-zA-Z0-9]{9,12}$", v):
                raise ValueError("El Carné de Extranjería (CE) debe tener entre 9 y 12 caracteres alfanuméricos.")
        elif tipo == "PASAPORTE":
            if not re.match(r"^[a-zA-Z0-9]{6,12}$", v):
                raise ValueError("El Pasaporte debe tener entre 6 y 12 caracteres alfanuméricos.")
        return v

    @field_validator("fecha_nacimiento")
    @classmethod
    def validar_edad(cls, v):
        try:
            fn = datetime.strptime(v.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("Formato de fecha inválido. Utilice el formato AAAA-MM-DD.")
        
        hoy = date.today()
        edad = hoy.year - fn.year - ((hoy.month, hoy.day) < (fn.month, fn.day))
        if edad < 18:
            raise ValueError("Debes ser mayor de 18 años para solicitar un préstamo.")
        if edad > 85:
            raise ValueError("La edad excede el límite máximo para la solicitud (85 años).")
        return v

    @field_validator("telefono", "whatsapp")
    @classmethod
    def validar_celular_peru(cls, v):
        v_clean = re.sub(r"[^\d+]", "", v)
        # Quitar prefijo +51 si viene incluido
        if v_clean.startswith("+51"):
            v_clean = v_clean[3:]
        elif v_clean.startswith("51") and len(v_clean) == 11:
            v_clean = v_clean[2:]
        
        if not re.match(r"^9\d{8}$", v_clean):
            raise ValueError("El número celular peruano debe constar de 9 dígitos y comenzar con el número 9.")
        return v_clean

    @field_validator("email")
    @classmethod
    def validar_email(cls, v):
        v = v.strip().lower()
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", v):
            raise ValueError("Ingresa una dirección de correo electrónico válida.")
        return v

    @field_validator("acepta_politica")
    @classmethod
    def validar_politica(cls, v):
        if not v:
            raise ValueError("Es obligatorio aceptar la Política de Privacidad y el tratamiento de datos conforme a la Ley N.º 29733.")
        return v

    @field_validator("autoriza_contacto")
    @classmethod
    def validar_autoriza(cls, v):
        if not v:
            raise ValueError("Es necesario autorizar el contacto para gestionar la evaluación de tu préstamo.")
        return v

    @field_validator("website_antispam")
    @classmethod
    def check_honeypot(cls, v):
        if v and len(v.strip()) > 0:
            raise ValueError("Solicitud bloqueada por filtros de seguridad automatizados.")
        return ""

class ActualizarEstadoRequest(BaseModel):
    estado: str = Field(..., description="Nuevo estado: PENDIENTE, EN_EVALUACION, APROBADO, OBSERVADO, RECHAZADO, CONTACTADO")
    notas_asesor: Optional[str] = Field(default="", description="Anotaciones internas del asesor")

class LoginAdminRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=50)

class ActualizarConfiguracionRequest(BaseModel):
    tea_referencial: Optional[str] = None
    telefono_atencion: Optional[str] = None
    whatsapp_atencion: Optional[str] = None
    email_contacto: Optional[str] = None
    horario_atencion: Optional[str] = None
    razon_social: Optional[str] = None
    ruc: Optional[str] = None
    direccion_fiscal: Optional[str] = None
