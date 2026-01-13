const mqtt = require('mqtt');
const admin = require('firebase-admin');

// 1. CONFIGURACIÓN SEGURA POR VARIABLES DE ENTORNO
try {
    // Limpiamos la llave privada por si Render añadió caracteres extra
    const pKey = process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : null;

    if (!pKey || !process.env.FIREBASE_CLIENT_EMAIL) {
        throw new Error("Faltan las variables FIREBASE_PRIVATE_KEY o FIREBASE_CLIENT_EMAIL en Render");
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "gps-retroexc", 
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: pKey
        }),
        databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
    });

    console.log("✅ ¡ÉXITO TOTAL! Robot BenJi conectado a Firebase.");
} catch (error) {
    console.error("❌ ERROR DE AUTENTICACIÓN:", error.message);
    process.exit(1);
}

const db = admin.database();

// 2. CONEXIÓN AL BROKER MQTT
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
    client.subscribe('GPS-RETRO');
    console.log("🚀 Escuchando datos del tópico: GPS-RETRO");
});

// 3. PROCESAMIENTO DE SEÑALES GPS
client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const id = data.id || "SIN-ID";
        const ts = Date.now();

        // Creamos un objeto de actualización para enviar todo en un solo viaje
        const updates = {};
        updates[`/historial/${id}/${ts}`] = data; // Para el rastro de 30 días
        updates[`/ultimo_estado/${id}`] = data;   // Para ver la ubicación actual

        db.ref().update(updates)
            .then(() => console.log(`📍 Posición recibida de: ${id}`))
            .catch(e => console.error("❌ Error al guardar en Firebase:", e.message));

    } catch (e) {
        console.error("⚠️ Los datos recibidos no son un JSON válido:", e.message);
    }
});

// Manejo de errores de conexión
client.on('error', (err) => {
    console.error("❌ Error en MQTT:", err.message);
});
