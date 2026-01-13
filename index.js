const mqtt = require('mqtt');
const admin = require('firebase-admin');

// 1. CARGA SEGURA DE CONFIGURACIÓN
// Este bloque intenta leer la llave desde Render. Si no existe, avisa en los logs.
try {
    if (!process.env.FIREBASE_CONFIG) {
        throw new Error("La variable FIREBASE_CONFIG no está definida en Render.");
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
    });

    console.log("✅ Conexión con Firebase establecida exitosamente.");
} catch (error) {
    console.error("❌ ERROR DE CONFIGURACIÓN:", error.message);
    process.exit(1); // Detiene el robot para evitar bucles de error
}

const db = admin.database();

// 2. CONEXIÓN AL BROKER MQTT
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
    client.subscribe('GPS-RETRO');
    console.log("🚀 Robot BenJi escuchando el tópico 'GPS-RETRO'...");
});

// 3. PROCESAMIENTO Y GUARDADO DE DATOS
client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const id = data.id || "SIN-ID";
        const timestamp = Date.now();

        // Guardar en HISTORIAL (30 días de ruta)
        db.ref(`historial/${id}/${timestamp}`).set(data)
            .then(() => console.log(`📍 Registrada ubicación de: ${id}`))
            .catch(err => console.error(`❌ Error en Firebase: ${err.message}`));

        // Guardar en ULTIMO_ESTADO (Para el mapa en vivo)
        db.ref(`ultimo_estado/${id}`).set(data);

    } catch (e) {
        console.error("⚠️ Datos MQTT inválidos:", e.message);
    }
});

// Manejo de errores de conexión
client.on('error', (err) => {
    console.error("❌ Error en cliente MQTT:", err.message);
});
