const mqtt = require('mqtt');
const admin = require('firebase-admin');

// 1. CARGA DE CONFIGURACIÓN DESDE VARIABLE DE ENTORNO
try {
    // Intentamos leer la variable que configuraste en Render
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
    });

    console.log("✅ CONEXIÓN EXITOSA: Robot BenJi autenticado con Firebase.");
} catch (error) {
    console.error("❌ ERROR DE CONFIGURACIÓN: No se pudo leer FIREBASE_CONFIG.");
    console.error("Detalle:", error.message);
    process.exit(1); 
}

const db = admin.database();

// 2. CONEXIÓN AL BROKER MQTT
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
  client.subscribe('GPS-RETRO');
  console.log("🚀 Robot BenJi activo y escuchando vehículos...");
});

// 3. PROCESAMIENTO Y GUARDADO
client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const id = data.id || "VEHICULO-DESCONOCIDO";
    const timestamp = Date.now();
    
    // Guardar en HISTORIAL (30 días de ruta)
    db.ref(`historial/${id}/${timestamp}`).set(data)
      .then(() => console.log(`📍 Ubicación de ${id} guardada con éxito.`))
      .catch((e) => console.error("❌ Error al escribir en Firebase:", e.message));
    
    // Actualizar ULTIMO_ESTADO (Para el mapa en vivo)
    db.ref(`ultimo_estado/${id}`).set(data);
    
  } catch (e) {
    console.error("⚠️ Datos MQTT inválidos recibidos:", e.message);
  }
});
