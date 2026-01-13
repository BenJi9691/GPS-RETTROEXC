const mqtt = require('mqtt');
const admin = require('firebase-admin');

try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG);
    
    // Limpieza profunda de la llave para evitar "Invalid JWT Signature"
    const formattedKey = config.private_key.replace(/\\n/g, '\n');

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: config.project_id,
            clientEmail: config.client_email,
            privateKey: formattedKey
        }),
        databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
    });

    console.log("✅ CONEXIÓN EXITOSA: El Robot BenJi está listo.");
} catch (error) {
    console.error("❌ ERROR CRÍTICO AL INICIAR:", error.message);
    process.exit(1);
}

const db = admin.database();
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
    client.subscribe('GPS-RETRO');
    console.log("🚀 Escuchando GPS-RETRO...");
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const id = data.id || "SIN-ID";
        const ts = Date.now();

        // Guardar en dos lugares al mismo tiempo
        const updates = {};
        updates[`/historial/${id}/${ts}`] = data;
        updates[`/ultimo_estado/${id}`] = data;

        db.ref().update(updates)
            .then(() => console.log(`📍 ${id} actualizado.`))
            .catch(e => console.error("Error DB:", e.message));
    } catch (e) {
        console.error("Error en datos:", e.message);
    }
});
