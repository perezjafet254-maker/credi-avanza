/**
 * UBIGEO PERÚ - Estructura Departamental, Provincial y Distrital
 * Para Credi Avanza - Mercado Peruano
 */
const UBIGEO_PERU = {
  "Lima": {
    "Lima Metropolitana": [
      "San Isidro", "Miraflores", "Santiago de Surco", "San Borja", "La Molina",
      "San Miguel", "Magdalena del Mar", "Pueblo Libre", "Jesús María", "Lince",
      "Surquillo", "Barranco", "Chorrillos", "Cercado de Lima", "Breña",
      "Los Olivos", "San Martín de Porres", "Comas", "Independencia", "Carabayllo",
      "Puente Piedra", "San Juan de Lurigancho", "Ate", "Santa Anita", "El Agustino",
      "San Juan de Miraflores", "Villa María del Triunfo", "Villa El Salvador",
      "Lurín", "Pachacámac", "Chaclacayo", "Lurigancho-Chosica", "Cieneguilla",
      "Ancón", "Santa Rosa", "Rímac", "San Luis", "La Victoria"
    ],
    "Cañete": ["San Vicente de Cañete", "Imperial", "Mala", "Chilca", "Asia", "Lunahuaná", "Cerro Azul"],
    "Huaral": ["Huaral", "Chancay", "Aucallama"],
    "Huaura": ["Huacho", "Hualmay", "Santa María", "Carquín", "Sayán"],
    "Barranca": ["Barranca", "Paramonga", "Pativilca", "Supe", "Supe Puerto"]
  },
  "Callao": {
    "Prov. Const. del Callao": ["Callao", "Bellavista", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Ventanilla", "Mi Perú"]
  },
  "Arequipa": {
    "Arequipa": ["Arequipa (Cercado)", "Cayma", "Yanahuara", "Cerro Colorado", "Paucarpata", "José Luis Bustamante y Rivero", "Miraflores", "Socabaya", "Mariano Melgar", "Hunter", "Tiabaya", "Sachaca"],
    "Camaná": ["Camaná", "José María Quimper", "Samuel Pastor"],
    "Islay": ["Mollendo", "Cocachacra", "Mejía"],
    "Caylloma": ["Chivay", "Majes"]
  },
  "La Libertad": {
    "Trujillo": ["Trujillo (Cercado)", "Víctor Larco Herrera", "Huanchaco", "Florencia de Mora", "El Porvenir", "La Esperanza", "Moche", "Salaverry", "Laredo"],
    "Pacasmayo": ["San Pedro de Lloc", "Pacasmayo"],
    "Chepén": ["Chepén", "Pacanga"],
    "Virú": ["Virú", "Chao"]
  },
  "Piura": {
    "Piura": ["Piura (Cercado)", "Castilla", "Veintiséis de Octubre", "Catacaos", "La Unión", "Tambo Grande"],
    "Sullana": ["Sullana", "Bellavista", "Marcavelica", "Querecotillo"],
    "Talara": ["Pariñas (Talara)", "Máncora", "Los Órganos", "El Alto"],
    "Paita": ["Paita", "Colán", "Yacila"]
  },
  "Lambayeque": {
    "Chiclayo": ["Chiclayo (Cercado)", "José Leonardo Ortiz", "La Victoria", "Pimentel", "Reque", "Monsefú", "Chongoyape"],
    "Lambayeque": ["Lambayeque", "Mórrope", "Mochumí", "Túcume", "Olmos"],
    "Ferreñafe": ["Ferreñafe", "Pítipo"]
  },
  "Cusco": {
    "Cusco": ["Cusco (Cercado)", "Wanchaq", "Santiago", "San Sebastián", "San Jerónimo", "Poroy"],
    "Urubamba": ["Urubamba", "Ollantaytambo", "Chinchero", "Machupicchu"],
    "La Convención": ["Santa Ana (Quillabamba)", "Echarati"],
    "Canchis": ["Sicuani", "Combapata"],
    "Calca": ["Calca", "Pisac"]
  },
  "Junín": {
    "Huancayo": ["Huancayo (Cercado)", "El Tambo", "Chilca", "Pilcomayo", "San Jerónimo de Tunán"],
    "Chanchamayo": ["Chanchamayo (La Merced)", "San Ramón", "Pichanaqui"],
    "Tarma": ["Tarma", "Acobamba"],
    "Satipo": ["Satipo", "Mazamari", "Pangoa"],
    "Jauja": ["Jauja", "Yauyos"]
  },
  "Ancash": {
    "Santa": ["Chimbote", "Nuevo Chimbote", "Coishco", "Santa", "Nepeña"],
    "Huaraz": ["Huaraz (Cercado)", "Independencia", "Tarica"],
    "Huarmey": ["Huarmey", "Culebras"],
    "Casma": ["Casma", "Comandante Noel"]
  },
  "Ica": {
    "Ica": ["Ica (Cercado)", "Parcona", "Subtanjalla", "La Tinguiña", "Los Aquijes", "Santiago", "Salas"],
    "Chincha": ["Chincha Alta", "Chincha Baja", "Pueblo Nuevo", "Sunampe", "Grocio Prado"],
    "Pisco": ["Pisco", "Paracas", "San Andrés", "Túpac Amaru Inca"],
    "Nazca": ["Nazca", "Marcona", "Vista Alegre"]
  },
  "Cajamarca": {
    "Cajamarca": ["Cajamarca (Cercado)", "Baños del Inca", "Los Baños"],
    "Jaén": ["Jaén", "Bellavista", "Pucará"],
    "Chota": ["Chota", "Lajas"]
  },
  "Puno": {
    "Puno": ["Puno (Cercado)", "Acora", "Chucuito"],
    "San Román": ["Juliaca", "Caracoto", "Cabana"]
  },
  "Loreto": {
    "Maynas": ["Iquitos", "Punchana", "Belén", "San Juan Bautista"],
    "Alto Amazonas": ["Yurimaguas"]
  },
  "San Martín": {
    "San Martín": ["Tarapoto", "Morales", "La Banda de Shilcayo"],
    "Moyobamba": ["Moyobamba", "Soritor"],
    "Rioja": ["Rioja", "Nueva Cajamarca"]
  },
  "Tacna": {
    "Tacna": ["Tacna (Cercado)", "Alto de la Alianza", "Ciudad Nueva", "Coronel Gregorio Albarracín Lanchipa", "Pocollay"]
  },
  "Huánuco": {
    "Huánuco": ["Huánuco (Cercado)", "Amarilis", "Pillco Marca"],
    "Leoncio Prado": ["Rupa-Rupa (Tingo María)"]
  },
  "Ayacucho": {
    "Huamanga": ["Ayacucho (Cercado)", "Carmen Alto", "San Juan Bautista", "Jesús Nazareno"]
  },
  "Ucayali": {
    "Coronel Portillo": ["Callería (Pucallpa)", "Yarinacocha", "Manantay"]
  },
  "Moquegua": {
    "Mariscal Nieto": ["Moquegua (Cercado)", "Samegua", "Torata"],
    "Ilo": ["Ilo", "Pacocha", "El Algarrobal"]
  },
  "Tumbes": {
    "Tumbes": ["Tumbes (Cercado)", "Corrales", "La Cruz", "Zorritos", "Zarumilla"]
  },
  "Amazonas": {
    "Chachapoyas": ["Chachapoyas", "Huancas"],
    "Bagua": ["Bagua", "Aramango"]
  },
  "Apurímac": {
    "Abancay": ["Abancay", "Tamburco"],
    "Andahuaylas": ["Andahuaylas", "San Jerónimo", "Talavera"]
  },
  "Huancavelica": {
    "Huancavelica": ["Huancavelica", "Ascensión"]
  },
  "Madre de Dios": {
    "Tambopata": ["Tambopata (Puerto Maldonado)", "Laberinto"]
  },
  "Pasco": {
    "Pasco": ["Chaupimarca (Cerro de Pasco)", "Yanacancha"],
    "Oxapampa": ["Oxapampa", "Villa Rica", "Pozuzo"]
  }
};
