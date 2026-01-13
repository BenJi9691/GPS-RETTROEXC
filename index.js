const mqtt = require('mqtt');
const admin = require('firebase-admin');

// CONFIGURACIÓN DE FIREBASE
try {
    // Aquí leemos la variable que acabas de crear en Render
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
    });

    console.log("✅ Robot BenJi autenticado correctamente con Firebase.");
} catch (error) {
    console.error("❌ ERROR DE LLAVE:", error.message);
    process.exit(1); 
}

const db = admin.database();
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
  client.subscribe('GPS-RETRO');
  console.log("🚀 Escuchando vehículos en tiempo real...");
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const id = data.id || "CAMION-DESCONOCIDO";
    const timestamp = Date.now();
    
    // Guardar en el historial (los 30 días)
    db.ref(`historial/${id}/${timestamp}`).set(data)
      .then(() => console.log(`📍 Posición de ${id} guardada.`))
      .catch((e) => console.error("Error Firebase:", e));
    
    // Actualizar ubicación actual (para el mapa vivo)
    db.ref(`ultimo_estado/${id}`).set(data);
    
  } catch (e) {
    console.error("Error en datos recibidos:", e.message);
  }
});
