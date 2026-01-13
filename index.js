const mqtt = require('mqtt');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Leer el archivo JSON de forma segura usando la ruta absoluta
const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
});

const db = admin.database();
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
  client.subscribe('GPS-RETRO');
  console.log("Robot BenJi conectado y autenticado en Firebase...");
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const id = data.id || "DESCONOCIDO";
    const timestamp = Date.now();
    
    // 1. Guardar en el historial (para ver rutas pasadas)
    db.ref(`historial/${id}/${timestamp}`).set(data)
      .then(() => console.log(`✅ ÉXITO: Ubicación de ${id} guardada en historial.`))
      .catch((e) => console.error("❌ ERROR Firebase:", e.message));
    
    // 2. Actualizar el último estado (para ver ubicación en tiempo real)
    db.ref(`ultimo_estado/${id}`).set(data);
    
  } catch (e) {
    console.error("❌ ERROR procesando mensaje:", e.message);
  }
});
