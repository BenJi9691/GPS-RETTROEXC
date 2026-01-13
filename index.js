const mqtt = require('mqtt');
const admin = require('firebase-admin');

// 1. CARGA Y REPARACIÓN DE LA CONFIGURACIÓN
try {
    if (!process.env.FIREBASE_CONFIG) {
        throw new Error("Falta la variable FIREBASE_CONFIG en Render");
    }

    // Leemos la variable de entorno
    const config = JSON.parse(process.env.FIREBASE_CONFIG);

    // CORRECCIÓN CRÍTICA: Render a veces escapa los saltos de línea de la llave. 
    // Esto repara la firma del certificado para evitar el error "Invalid JWT Signature"
    config.private_key = config.private_key.replace(/\\n/g, '\n');

    admin.initializeApp({
        credential: admin.credential.cert(config),
        databaseURL: "https://gps-retroexc-default-rtdb.firebaseio.com"
    });

    console.log("✅ CONEXIÓN EXITOSA: Robot BenJi autenticado con Firebase.");
} catch (error) {
    console.error("❌ ERROR DE CONFIGURACIÓN:", error.message);
    process.exit(1); 
}

const db = admin.database();

// 2. CONEXIÓN AL BROKER MQTT (EMQX)
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
    client.subscribe('GPS-RETRO');
    console.log("🚀 Robot BenJi activo y escuchando el tópico 'GPS-RETRO'...");
});

// 3. PROCESAMIENTO DE DATOS
client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        
        // Identificamos el vehículo (ej. VEHICULO-01)
        const id = data.id || "SIN-ID";
        const timestamp = Date.now();

        // ACCIÓN 1: Guardar en Historial (Rutas de 30 días)
        db.ref(`historial/${id}/${timestamp}`).set(data)
            .then(() => console.log(`📍 Ubicación de ${id} guardada en historial.`))
            .catch(err => console.error("❌ Error al guardar historial:", err.message));

        // ACCIÓN 2: Actualizar Último Estado (Mapa en vivo)
        db.ref(`ultimo_estado/${id}`).set(data);

    } catch (e) {
        console.error("⚠️ Datos MQTT inválidos:", e.message);
    }
});

// Manejo de errores de conexión MQTT
client.on('error', (err) => {
    console.error("❌ Error en cliente MQTT:", err.message);
});
