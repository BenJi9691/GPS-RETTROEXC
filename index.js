const mqtt = require('mqtt');
const admin = require('firebase-admin');
const http = require('http');

// 1. CONFIGURACIÓN DE FIREBASE
try {
    admin.initializeApp({
        credential: admin.credential.cert({
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            projectId: "gps-retroexc"
        }),
        databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
    });
    console.log("✅ Firebase listo.");
} catch (error) {
    console.error("❌ Error Firebase:", error.message);
}

const db = admin.database();

// 2. CONEXIÓN AL BROKER REAL (EMQX)
const BROKER = "mqtt://broker.emqx.io";
const TOPIC_WILDCARD = "GPS-RETRO/#"; // Escucha todas las unidades de GPS-RETRO

const client = mqtt.connect(BROKER, {
    keepalive: 60,
    reconnectPeriod: 1000
});

client.on('connect', () => {
    console.log(`✅ CONECTADO A EMQX: Escuchando ${TOPIC_WILDCARD}`);
    client.subscribe(TOPIC_WILDCARD, (err) => {
        if (!err) console.log("📡 Suscripción activa al bus de datos.");
    });
});

client.on('message', (topic, message) => {
    // Log para ver el dato crudo en Render y confirmar que llega
    console.log(`📩 DATOS RECIBIDOS en [${topic}]: ${message.toString()}`);

    try {
        const data = JSON.parse(message.toString());
        const id = data.id || topic.split('/').pop(); // Si el JSON no trae ID, usa el del tópico
        const ts = Date.now();

        // Guardar en Firebase
        db.ref(`ultimo_estado/${id}`).set(data);
        db.ref(`historial/${id}/${ts}`).set(data);

        console.log(`📍 Guardado correctamente: ${id}`);

        // Limpieza automática 30 días (5% de probabilidad)
        if (Math.random() < 0.05) {
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
        console.error("⚠️ Error en JSON:", e.message);
    }
});

// 3. SERVIDOR FANTASMA PARA RENDER
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Robot BenJi EMQX Active');
}).listen(process.env.PORT || 10000);
