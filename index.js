const mqtt = require('mqtt');
const admin = require('firebase-admin');

// 1. INICIO DE SESIÓN SEGURO
try {
    const pKey = process.env.FIREBASE_PRIVATE_KEY;
    const cEmail = process.env.FIREBASE_CLIENT_EMAIL;

    // Verificación de seguridad
    if (!pKey || !cEmail) {
        throw new Error("Faltan las variables en Render: Revisa la pestaña Environment.");
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "gps-retroexc",
            clientEmail: cEmail,
            // Esta línea limpia la llave para que Google la acepte sin errores
            privateKey: pKey.replace(/\\n/g, '\n')
        }),
        databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
    });

    console.log("✅ ¡CONEXIÓN EXITOSA! El Robot BenJi está en línea.");
} catch (error) {
    console.error("❌ ERROR AL INICIAR:", error.message);
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
        const id = data.id || "SIN-ID";
        const ts = Date.now();

        // Guardamos en historial y ubicación actual
        const updates = {};
        updates[`/historial/${id}/${ts}`] = data;
        updates[`/ultimo_estado/${id}`] = data;

        db.ref().update(updates)
            .then(() => console.log(`📍 Posición de ${id} recibida.`))
            .catch(e => console.error("Error Firebase:", e.message));
    } catch (e) {
        console.error("Error en datos MQTT:", e.message);
    }
});
