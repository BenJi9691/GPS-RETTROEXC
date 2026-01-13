const mqtt = require('mqtt');
const admin = require('firebase-admin');
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
});

const db = admin.database();
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
  client.subscribe('GPS-RETRO');
  console.log("Robot BenJi activado: Escuchando flota...");
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const id = data.id || "S-ID";
    const timestamp = Date.now();
    
    // Guarda el recorrido histórico
    db.ref(`historial/${id}/${timestamp}`).set(data);
    
    // Guarda solo la última posición conocida
    db.ref(`ultimo_estado/${id}`).set(data);
    
    console.log(`Dato recibido de ${id} y guardado en la nube.`);
  } catch (e) { console.error("Error procesando trama:", e); }
});
