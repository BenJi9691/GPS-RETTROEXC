const mqtt = require('mqtt');
const admin = require('firebase-admin');
const http = require('http');

// 1. CONFIGURACIÓN ROBUSTA DE FIREBASE
try {
    admin.initializeApp({
        credential: admin.credential.cert({
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            projectId: "gps-retroexc"
        }),
        databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
    });
    console.log("✅ Firebase configurado correctamente.");
} catch (error) {
    console.error("❌ ERROR CRÍTICO EN FIREBASE:", error.message);
}

const db = admin.database();

// 2. CONEXIÓN MQTT CON RECONEXIÓN AUTOMÁTICA
const client = mqtt.connect('mqtt://broker.hivemq.com', {
    keepalive: 60,
    reconnectPeriod: 1000 // Reintenta cada segundo si se cae
});

client.on('connect', () => {
    console.log("✅ CONEXIÓN EXITOSA: Robot BenJi escuchando el Broker.");
    client.subscribe('tu_topico_gps/datos', (err) => {
        if (!err) console.log("📡 Suscrito al tópico de los vehículos.");
    });
});

client.on('error', (err) => {
    console.error("❌ ERROR MQTT:", err.message);
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const id = data.id;
        const ts = Date.now();

        // Guardar datos
        db.ref(`ultimo_estado/${id}`).set(data);
        db.ref(`historial/${id}/${ts}`).set(data);

        console.log(`📍 Dato guardado de: ${id} | Bat: ${data.btc}V`);

        // Limpieza automática (30 días)
        if (Math.random() < 0.05) { // Ejecuta limpieza con 5% de probabilidad
            const limite = Date.now() - (30 * 24 * 60 * 60 * 1000);
            db.ref('historial').once('value', (snap) => {
                snap.forEach((veh) => {
                    const puntos = veh.val();
                    Object.keys(puntos).forEach((key) => {
                        if (parseInt(key) < limite) db.ref(`historial/${veh.key}/${key}`).remove();
                    });
                });
            });
        }
    } catch (e) {
        console.error("⚠️ Error procesando mensaje:", e.message);
    }
});

// 3. SERVIDOR DE MANTENIMIENTO PARA RENDER (Indispensable)
const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('BenJi GPS Server Is Running\n');
});

// Render asigna el puerto automáticamente
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor de mantenimiento en puerto ${PORT}`);
});
