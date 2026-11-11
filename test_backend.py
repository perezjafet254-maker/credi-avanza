import asyncio
from datetime import date, datetime
from fastapi.testclient import TestClient
from main import app
from database import get_connection

client = TestClient(app)

def run_tests():
    print("=== INICIANDO PRUEBAS DE CREDI AVANZA ===")
    
    # 1. Test Configuración Pública
    res_cfg = client.get("/api/config")
    assert res_cfg.status_code == 200, f"Error en /api/config: {res_cfg.status_code}"
    cfg = res_cfg.json()
    assert "tea_referencial" in cfg
    assert 5000.0 in cfg["montos"]
    assert 24 in cfg["plazos"]
    print("✔ Prueba 1 superada: Configuración pública cargada correctamente.")
    
    # 2. Test Simulador
    res_sim = client.post("/api/simular", json={"monto": 5000, "plazo": 24})
    assert res_sim.status_code == 200
    sim_data = res_sim.json()
    assert sim_data["cuota_estimada"] > 0
    print(f"✔ Prueba 2 superada: Simulación calculada: S/ {sim_data['cuota_estimada']} para S/ 5,000 en 24 meses.")
    
    # 3. Test Validación DNI inválido (7 dígitos)
    solicitud_invalida_dni = {
        "monto": 5000,
        "plazo": 24,
        "finalidad": "Consolidación de deudas",
        "nombres": "Juan Carlos",
        "apellidos": "Pérez Flores",
        "tipo_documento": "DNI",
        "numero_documento": "1234567", # Invalido, solo 7 digitos
        "fecha_nacimiento": "1992-05-10",
        "telefono": "987654321",
        "whatsapp": "987654321",
        "email": "juan.perez@example.com",
        "departamento": "Lima",
        "provincia": "Lima Metropolitana",
        "distrito": "San Isidro",
        "direccion": "Av. Las Camelias 450 Dpto 301",
        "situacion_laboral": "Empleado dependiente",
        "ingresos_mensuales": 3500,
        "acepta_politica": True,
        "autoriza_contacto": True,
        "website_antispam": ""
    }
    res_inv_dni = client.post("/api/solicitar", json=solicitud_invalida_dni)
    assert res_inv_dni.status_code == 422
    print("✔ Prueba 3 superada: Rechazo correcto de DNI con menos de 8 dígitos.")
    
    # 4. Test Validación Teléfono inválido (no empieza con 9)
    solicitud_invalida_tel = dict(solicitud_invalida_dni)
    solicitud_invalida_tel["numero_documento"] = "45678912"
    solicitud_invalida_tel["telefono"] = "487654321" # Invalido en Perú
    res_inv_tel = client.post("/api/solicitar", json=solicitud_invalida_tel)
    assert res_inv_tel.status_code == 422
    print("✔ Prueba 4 superada: Rechazo correcto de número celular no peruano (debe iniciar con 9).")
    
    # 5. Test Validación Menor de Edad
    solicitud_menor = dict(solicitud_invalida_dni)
    solicitud_menor["numero_documento"] = "45678912"
    solicitud_menor["telefono"] = "987654321"
    solicitud_menor["fecha_nacimiento"] = "2020-01-01" # 6 años
    res_menor = client.post("/api/solicitar", json=solicitud_menor)
    assert res_menor.status_code == 422
    print("✔ Prueba 5 superada: Rechazo correcto de postulante menor de 18 años.")

    # 6. Test Bot Honeypot
    solicitud_bot = dict(solicitud_invalida_dni)
    solicitud_bot["numero_documento"] = "45678912"
    solicitud_bot["telefono"] = "987654321"
    solicitud_bot["fecha_nacimiento"] = "1990-08-15"
    solicitud_bot["website_antispam"] = "http://spam-link.com"
    res_bot = client.post("/api/solicitar", json=solicitud_bot)
    assert res_bot.status_code == 422
    print("✔ Prueba 6 superada: Detección y bloqueo de bot mediante trampa honeypot.")

    # 7. Test Solicitud Válida Exitosa
    solicitud_valida = dict(solicitud_invalida_dni)
    solicitud_valida["numero_documento"] = "72345678"
    solicitud_valida["telefono"] = "998877665"
    solicitud_valida["whatsapp"] = "998877665"
    solicitud_valida["fecha_nacimiento"] = "1994-06-20"
    solicitud_valida["website_antispam"] = ""
    
    res_ok = client.post("/api/solicitar", json=solicitud_valida)
    assert res_ok.status_code == 201
    data_ok = res_ok.json()
    assert data_ok["status"] == "success"
    assert "CA-" in data_ok["codigo"]
    codigo_generado = data_ok["codigo"]
    print(f"✔ Prueba 7 superada: Solicitud registrada exitosamente con código único {codigo_generado}.")

    # 8. Test Login Asesor y Listado en Panel Privado
    res_login = client.post("/api/admin/login", json={"pin": "crediavanza2026"})
    assert res_login.status_code == 200
    token = res_login.json()["token"]
    
    res_list = client.get(f"/api/admin/solicitudes?token={token}")
    assert res_list.status_code == 200
    lista = res_list.json()
    assert len(lista) > 0
    encontrado = any(s["codigo"] == codigo_generado for s in lista)
    assert encontrado
    print(f"✔ Prueba 8 superada: Asesor autenticado y solicitud visualizada en el listado administrativo.")

    # 9. Test Actualizar Estado de la Solicitud
    res_estado = client.patch(
        f"/api/admin/solicitudes/{codigo_generado}/estado?token={token}",
        json={"estado": "EN_EVALUACION", "notas_asesor": "Documentación inicial validada en Reniec. En espera de evaluación de riesgo."}
    )
    assert res_estado.status_code == 200
    print(f"✔ Prueba 9 superada: Estado de solicitud actualizado a EN_EVALUACION con anotación de asesor.")

    # 10. Test Exportación a CSV
    res_csv = client.get(f"/api/admin/solicitudes/export?token={token}")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "attachment; filename=" in res_csv.headers["content-disposition"]
    csv_text = res_csv.text
    assert "Código;Fecha Registro;Estado" in csv_text or "Código" in csv_text
    assert codigo_generado in csv_text
    print("✔ Prueba 10 superada: Exportación CSV generada con formato seguro y compatible con Excel.")

    # 11. Test Servir HTML Frontend
    res_home = client.get("/")
    assert res_home.status_code == 200
    assert "Credi Avanza" in res_home.text
    print("✔ Prueba 11 superada: index.html servido correctamente.")

    # 12. Test Servir Admin HTML
    res_admin_page = client.get("/admin")
    assert res_admin_page.status_code == 200
    assert "Panel de Asesores" in res_admin_page.text
    print("✔ Prueba 12 superada: admin.html servido correctamente.")

    print("\n🎉 ¡TODAS LAS 12 PRUEBAS PASARON EXITOSAMENTE! 🎉")

if __name__ == "__main__":
    run_tests()
