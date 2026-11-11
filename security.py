"""
CREDI AVANZA - Módulo de Seguridad y Criptografía
Implementación integral de ciberseguridad, hashing, mitigación OWASP y defensa en profundidad.
"""

import hashlib
import hmac
import secrets
import time
import re
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, List
from collections import defaultdict
import threading

# Iteraciones recomendadas por OWASP para PBKDF2-HMAC-SHA256
PBKDF2_ITERATIONS = 200_000
SESSION_EXPIRATION_HOURS = 2

# Locks para concurrencia segura en memoria
_rate_limit_lock = threading.Lock()
_login_lock = threading.Lock()

# -------------------------------------------------------------
# 1. HASHING Y VERIFICACIÓN SEGURA DE CONTRASEÑAS
# -------------------------------------------------------------

def hash_password(password: str) -> str:
    """
    Genera un hash criptográfico robusto utilizando PBKDF2-HMAC-SHA256 con salt de 16 bytes.
    Formato retornado: pbkdf2_sha256$<iteraciones>$<salt_hex>$<hash_hex>
    """
    if not password:
        raise ValueError("La contraseña no puede estar vacía.")
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${key.hex()}"

def verify_password(plain_password: str, stored_hash: str) -> bool:
    """
    Verifica una contraseña contra su hash almacenado usando comparación en tiempo constante
    (hmac.compare_digest) para evitar ataques de temporización (timing attacks).
    Soporta migración automática transparente si el hash previo era texto plano.
    """
    if not plain_password or not stored_hash:
        return False

    # Caso 1: Hash con formato PBKDF2
    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            parts = stored_hash.split("$")
            if len(parts) != 4:
                return False
            iterations = int(parts[1])
            salt = bytes.fromhex(parts[2])
            expected_key = bytes.fromhex(parts[3])

            computed_key = hashlib.pbkdf2_hmac(
                "sha256",
                plain_password.encode("utf-8"),
                salt,
                iterations
            )
            return hmac.compare_digest(computed_key, expected_key)
        except Exception:
            return False

    # Caso 2: Compatibilidad de migración con texto plano previo
    return hmac.compare_digest(plain_password.strip(), stored_hash.strip())

def is_hash_pbkdf2(hash_str: str) -> bool:
    """Verifica si la cadena ya es un hash PBKDF2 seguro."""
    return bool(hash_str and hash_str.startswith("pbkdf2_sha256$"))

# -------------------------------------------------------------
# 2. GESTIÓN CRIPTOGRÁFICA DE SESIONES Y TOKENS
# -------------------------------------------------------------

def generate_secure_token() -> str:
    """Genera un token de 256 bits criptográficamente aleatorio (43 caracteres urlsafe)."""
    return secrets.token_urlsafe(32)

def hash_token(token: str) -> str:
    """
    Genera el hash SHA-256 del token para almacenamiento en base de datos.
    De este modo, si la base de datos se filtra, los tokens activos no son utilizables.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

# -------------------------------------------------------------
# 3. RATE LIMITING EN MEMORIA CON LIMPIEZA AUTOMÁTICA
# -------------------------------------------------------------

class InMemoryRateLimiter:
    """
    Limitador de velocidad con ventana deslizante (sliding window) por dirección IP.
    Totalmente thread-safe con bloqueo y recolección automática de registros expirados.
    """
    def __init__(self):
        self._requests: Dict[str, List[float]] = defaultdict(list)
        self._last_clean = time.time()

    def check_limit(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Verifica si la clave (ej. IP) puede realizar una solicitud.
        Retorna (permitido, segundos_para_reset).
        """
        now = time.time()
        with _rate_limit_lock:
            # Limpieza periódica cada 3 minutos
            if now - self._last_clean > 180:
                self._cleanup(now)

            timestamps = self._requests[key]
            # Filtrar timestamps fuera de la ventana
            cutoff = now - window_seconds
            valid_timestamps = [t for t in timestamps if t > cutoff]
            self._requests[key] = valid_timestamps

            if len(valid_timestamps) >= max_requests:
                oldest = valid_timestamps[0]
                retry_after = max(1, int(oldest + window_seconds - now))
                return False, retry_after

            # Registrar solicitud actual
            valid_timestamps.append(now)
            return True, 0

    def _cleanup(self, now: float):
        """Elimina entradas obsoletas para prevenir consumo innecesario de memoria."""
        cutoff = now - 3600
        keys_to_delete = []
        for k, ts in self._requests.items():
            self._requests[k] = [t for t in ts if t > cutoff]
            if not self._requests[k]:
                keys_to_delete.append(k)
        for k in keys_to_delete:
            del self._requests[k]
        self._last_clean = now

# Instancias globales de rate limiting
solicitud_limiter = InMemoryRateLimiter()  # Máx 5 solicitudes por 10 min por IP
general_api_limiter = InMemoryRateLimiter()  # Máx 120 peticiones por minuto por IP

# -------------------------------------------------------------
# 4. PROTECCIÓN CONTRA FUERZA BRUTA EN LOGIN
# -------------------------------------------------------------

class LoginBruteForceProtector:
    """
    Protección contra ataques de fuerza bruta y credential stuffing.
    Bloquea la IP tras 5 intentos fallidos consecutivos durante 15 minutos.
    """
    MAX_ATTEMPTS = 5
    LOCKOUT_SECONDS = 900  # 15 minutos

    def __init__(self):
        self._failures: Dict[str, List[float]] = defaultdict(list)
        self._lockouts: Dict[str, float] = {}

    def is_locked(self, ip: str) -> Tuple[bool, int]:
        """Comprueba si la IP está bloqueada y cuánto tiempo resta."""
        now = time.time()
        with _login_lock:
            if ip in self._lockouts:
                locked_until = self._lockouts[ip]
                if now < locked_until:
                    return True, int(locked_until - now)
                else:
                    # Desbloquear
                    del self._lockouts[ip]
                    self._failures[ip] = []
            return False, 0

    def record_failure(self, ip: str) -> Tuple[int, int]:
        """
        Registra un intento fallido para la IP.
        Retorna (intentos_actuales, segundos_bloqueo_restantes).
        """
        now = time.time()
        with _login_lock:
            cutoff = now - self.LOCKOUT_SECONDS
            self._failures[ip] = [t for t in self._failures[ip] if t > cutoff]
            self._failures[ip].append(now)

            if len(self._failures[ip]) >= self.MAX_ATTEMPTS:
                self._lockouts[ip] = now + self.LOCKOUT_SECONDS
                return len(self._failures[ip]), self.LOCKOUT_SECONDS

            return len(self._failures[ip]), 0

    def record_success(self, ip: str):
        """Limpia los intentos fallidos tras un login exitoso."""
        with _login_lock:
            if ip in self._failures:
                del self._failures[ip]
            if ip in self._lockouts:
                del self._lockouts[ip]

login_protector = LoginBruteForceProtector()

# -------------------------------------------------------------
# 5. SANITIZACIÓN DE INYECCIÓN CSV / FORMULA INJECTION (CWE-1236)
# -------------------------------------------------------------

def sanitize_csv_cell(value) -> str:
    """
    Sanitiza valores exportados a CSV para prevenir ejecución de fórmulas o macros
    al ser abiertos en Microsoft Excel, LibreOffice Calc o Google Sheets.
    Si el texto inicia con '=', '+', '-', '@', '\\t' o '\\r', antepone un apóstrofe.
    """
    if value is None:
        return ""
    text = str(value)
    # Eliminar caracteres nulos
    text = text.replace("\x00", "").strip()
    
    # Detectar prefijos peligrosos de fórmulas
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{text}"
    return text

# -------------------------------------------------------------
# 6. SANITIZACIÓN DE ENTRADAS GENERALES
# -------------------------------------------------------------

_DANGEROUS_HTML_PATTERN = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
_CONTROL_CHARS_PATTERN = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")

def sanitize_input_text(text: Optional[str], max_length: int = 500) -> str:
    """
    Sanitiza texto de entrada eliminando scripts, caracteres de control no imprimibles
    y truncando al límite máximo seguro.
    """
    if not text:
        return ""
    clean = _DANGEROUS_HTML_PATTERN.sub("", text)
    clean = _CONTROL_CHARS_PATTERN.sub("", clean)
    clean = clean.strip()
    if len(clean) > max_length:
        clean = clean[:max_length]
    return clean

# -------------------------------------------------------------
# 7. CABECERAS DE SEGURIDAD HTTP ESTÁNDAR
# -------------------------------------------------------------

SECURITY_HEADERS = {
    # Evita que el navegador interprete archivos con tipos MIME diferentes a los declarados
    "X-Content-Type-Options": "nosniff",
    # Previene Clickjacking impidiendo que la web sea incrustada en iframes externos
    "X-Frame-Options": "DENY",
    # Política de contenido estricta (permite fuentes de Google y Tailwind oficial)
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://fonts.googleapis.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    ),
    # Fuerza conexiones HTTPS durante 1 año incluyendo subdominios
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    # Restringe información de referencia enviada a sitios de terceros
    "Referrer-Policy": "strict-origin-when-cross-origin",
    # Desactiva APIs innecesarias del navegador (cámara, micrófono, geolocalización)
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
    # Cache control para evitar almacenamiento en proxies de respuestas sensibles
    "X-XSS-Protection": "1; mode=block"
}
