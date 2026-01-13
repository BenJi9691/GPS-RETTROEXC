const mqtt = require('mqtt');
const admin = require('firebase-admin');
const http = require('http'); // Necesario para que Render no falle

// 1. CONFIGURACIÓN DE FIREBASE
// Asegúrate de tener FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en Render
admin.initializeApp({
  credential: admin.credential.cert({
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    projectId: "gps-retroexc" 
  }),
  databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
});

const db = admin.database();
const client = mqtt.connect('mqtt://broker.hivemq.com'); // Tu broker

client.on('connect', () => {
  console.log("✅ ¡CONEXIÓN EXITOSA! El Robot BenJi está en línea.");
  client.subscribe('tu_topico_gps/datos'); // <--- Asegúrate que sea el correcto
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const id = data.id;
    const ts = Date.now();

    // Guardar último estado y el historial
    db.ref(`ultimo_estado/${id}`).set(data);
    db.ref(`historial/${id}/${ts}`).set(data);

    console.log(`📍 Posición recibida de: ${id}`);

    // Limpieza automática: Una probabilidad de 1% cada vez que llega un mensaje
    if (Math.random() < 0.01) {
        const limiteSieteDias = Date.now() - (30 * 24 * 60 * 60 * 1000);
        db.ref('historial').once('value', (snap) => {
            snap.forEach((veh) => {
                const puntos = veh.val();
                Object.keys(puntos).forEach((key) => {
                    if (parseInt(key) < limiteSieteDias) {
                        db.ref(`historial/${veh.key}/${key}`).remove();
                    }
                });
            });
        });
    }
  } catch (e) {
    console.log("⚠️ Error en formato JSON:", e.message);
  }
});

// 2. EL TRUCO PARA RENDER (Evita el error "No open ports detected")
// Esto crea una mini-página web que solo dice "OK" para que Render no apague el robot.
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Robot BenJi funcionando correctamente\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor de mantenimiento escuchando en puerto ${PORT}`);
});
