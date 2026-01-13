const mqtt = require('mqtt');
const admin = require('firebase-admin');
const http = require('http');

// 1. CONFIGURACIÓN DE FIREBASE (Usa tus variables de entorno en Render)
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
    console.error("❌ ERROR EN FIREBASE:", error.message);
}

const db = admin.database();

// 2. CONEXIÓN MQTT A EMQX (Puerto 1883 interno del broker)
const BROKER = "mqtt://broker.emqx.io"; 
const TOPIC_SUBSCRIPTION = "GPS-RETRO/#"; // Escucha todas las unidades

const client = mqtt.connect(BROKER, {
    keepalive: 60,
    reconnectPeriod: 1000
});

client.on('connect', () => {
    console.log(`🚀 ROBOT CONECTADO A EMQX. Escuchando: ${TOPIC_SUBSCRIPTION}`);
    client.subscribe(TOPIC_SUBSCRIPTION);
});

client.on('message', (topic, message) => {
    // Este log es vital: si sale esto en Render, la conexión GPS -> ROBOT es perfecta
    console.log(`📩 LLEGÓ DATO! Tópico: ${topic} | Contenido: ${message.toString()}`);

    try {
        const data = JSON.parse(message.toString());
        const id = data.id || topic.split('/').pop(); 
        const ts = Date.now();

        // Guardar en Firebase
        db.ref(`ultimo_estado/${id}`).set(data);
        db.ref(`historial/${id}/${ts}`).set(data);

    } catch (e) {
        console.error("⚠️ Error procesando JSON:", e.message);
    }
});

// 3. EL "TRUCO" PARA RENDER (Puerto 10000 para la web)
// Esto hace que Render vea un puerto abierto y no detenga el servicio.
const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Servidor GPS BenJi Activo\n');
});

// Render usa el puerto 10000 por defecto para servicios web
const WEB_PORT = process.env.PORT || 10000;
server.listen(WEB_PORT, () => {
    console.log(`🌐 Servidor de monitoreo listo en puerto ${WEB_PORT}`);
});
