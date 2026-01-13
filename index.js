const mqtt = require('mqtt');
const admin = require('firebase-admin');

// 1. CONFIGURACIÓN DE FIREBASE
// El robot buscará la llave en la variable "FIREBASE_CONFIG" que configuramos en Render
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
    });

    console.log("✅ Sistema de autenticación configurado correctamente.");
} catch (error) {
    console.error("❌ ERROR CRÍTICO: No se pudo cargar la configuración de Firebase. Verifica la variable FIREBASE_CONFIG en Render.");
    process.exit(1); // Detiene el robot si no hay llave
}

const db = admin.database();

// 2. CONFIGURACIÓN DE MQTT (BROKER EMQX)
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
  // Se suscribe al tópico donde tus GPS envían los datos
  client.subscribe('GPS-RETRO');
  console.log("🚀 Robot BenJi conectado a MQTT y escuchando vehículos...");
});

// 3. PROCESAMIENTO DE DATOS
client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    
    // Extraemos el ID del camión (por ejemplo: VEHICULO-01)
    const id = data.id || "DESCONOCIDO";
    
    // Creamos una marca de tiempo para el historial
    const timestamp = Date.now();
    
    // --- ACCIÓN A: GUARDAR EN HISTORIAL (Para rutas de 30 días) ---
    db.ref(`historial/${id}/${timestamp}`).set(data)
      .then(() => {
        console.log(`📍 Dato guardado: ${id} en historial.`);
      })
      .catch((err) => {
        console.error(`❌ Error al guardar en Firebase:`, err.message);
      });

    // --- ACCIÓN B: ACTUALIZAR ÚLTIMO ESTADO (Para el mapa en vivo) ---
    db.ref(`ultimo_estado/${id}`).set(data);

  } catch (e) {
    console.error("⚠️ Error procesando mensaje del GPS:", e.message);
  }
});

// Manejo de errores de conexión MQTT
client.on('error', (err) => {
  console.error("❌ Error de conexión MQTT:", err);
});
