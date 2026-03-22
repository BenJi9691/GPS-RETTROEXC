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
    console.log("✅ Firebase configurado correctamente.");
} catch (error) {
    console.error("❌ ERROR EN FIREBASE:", error.message);
}

const db = admin.database();

// 2. CONEXIÓN MQTT A EMQX
const BROKER = "mqtt://broker.emqx.io"; 
const TOPIC_SUBSCRIPTION = "GPS-RETRO/#"; 

const client = mqtt.connect(BROKER, {
    keepalive: 60,
    reconnectPeriod: 1000
});

client.on('connect', () => {
    console.log(`🚀 ROBOT CONECTADO. Escuchando: ${TOPIC_SUBSCRIPTION}`);
    client.subscribe(TOPIC_SUBSCRIPTION);
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const id = data.id || "VEHICULO-01";
        const ts = Date.now();

        // --- CORRECCIÓN DE FECHA (NORMALIZACIÓN) ---
        if (data.fec && data.fec.includes('/')) {
            let partes = data.fec.split('/');
            if (partes.length === 3) {
                let dia = partes[0].padStart(2, '0');
                let mes = partes[1].padStart(2, '0');
                let anio = partes[2];
                data.fec = `${dia}/${mes}/${anio}`;
            }
        }

        // Guardar en Firebase
        db.ref(`ultimo_estado/${id}`).set(data);
        db.ref(`historial/${id}/${ts}`).set(data);

        console.log(`📩 Dato guardado: ${id} | Fecha corregida: ${data.fec}`);

    } catch (e) {
        console.error("⚠️ Error procesando JSON:", e.message);
    }
});

// 3. MANTENER RENDER ACTIVO Y RUTA DE LIMPIEZA
const server = http.createServer(async (req, res) => {
    // NUEVA RUTA DE LIMPIEZA: Detecta si la URL termina en /limpiar-historial-2468
    if (req.url === '/limpiar-historial-2468') {
        try {
            await db.ref('historial').remove();
            console.log("🧹 MANTENIMIENTO: Historial borrado por comando web.");
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('✅ Historial de Firebase eliminado correctamente.\n');
        } catch (error) {
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.end('❌ Error al limpiar base de datos.\n');
        }
    } else {
        // Respuesta normal para mantener Render despierto
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('Servidor GPS BenJi Activo\n');
    }
});

const WEB_PORT = process.env.PORT || 10000;
server.listen(WEB_PORT, () => {
    console.log(`🌐 Monitoreo en puerto ${WEB_PORT}`);
});
