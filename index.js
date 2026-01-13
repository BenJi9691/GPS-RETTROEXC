const mqtt = require('mqtt');
const admin = require('firebase-admin');
const fs = require('fs');

// Leer el archivo de forma segura
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccount.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
});

const db = admin.database();
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
  client.subscribe('GPS-RETRO');
  console.log("Robot BenJi conectado y escuchando vehículos...");
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const id = data.id || "SIN-ID";
    const timestamp = Date.now();
    
    // Guardar en el historial
    db.ref(`historial/${id}/${timestamp}`).set(data)
      .then(() => console.log(`Dato recibido de ${id} y guardado en la nube.`))
      .catch((e) => console.error("Error al escribir en Firebase:", e));
    
    // Actualizar último estado
    db.ref(`ultimo_estado/${id}`).set(data);
    
  } catch (e) {
    console.error("Error procesando mensaje MQTT:", e);
  }
});
