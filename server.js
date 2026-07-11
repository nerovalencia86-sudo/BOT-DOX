const { Telegraf } = require('telegraf');
const axios = require('axios');

// ⚠️ REEMPLAZA ESTO CON EL TOKEN QUE TE DIO @BotFather
const bot = new Telegraf('TU_TELEGRAM_BOT_TOKEN'); 

// ID del Dueño Absoluto
const OWNER_ID = 8116120039;

// Base de datos temporal en memoria
let database = {
    sellers: [],       // Lista de IDs de Telegram de los vendedores autorizados
    vips: {}           // Almacena accesos { telegram_id: Date_Expira o 'perm' }
};

// Control de estados de flujo para usuarios
const esperandoNumero = {};

// --- SISTEMA DE CACHÉ ---
const cacheConsultas = {}; 

// Función interna de seguridad para validar accesos
async function verificarAcceso(ctx) {
    const userId = ctx.from.id;
    if (userId === OWNER_ID || database.sellers.includes(userId)) return true;

    const acceso = database.vips[userId];
    
    // Si nunca ha tenido registro de compra
    if (!acceso) {
        ctx.reply("❌ No tienes acceso, compra tu acceso con @El_CuervoX");
        return false;
    }

    // Si posee membresía de por vida
    if (acceso === 'perm') return true;

    // Si cuenta con días, verificar que sigan vigentes
    if (new Date(acceso) > new Date()) {
        return true;
    } else {
        ctx.reply("❌ RENUEVA TU ACCESO CON @El_CuervoX");
        return false;
    }
}

// ==========================================
// COMANDO /START Y FLUJO /NEQUI
// ==========================================

bot.start((ctx) => {
    ctx.reply("👁️ Bienvenido al Ojo de Dios. Para hacer tu consulta presiona el comando /nequi");
});

bot.command('nequi', async (ctx) => {
    const accesoAutorizado = await verificarAcceso(ctx);
    if (!accesoAutorizado) return;

    // Habilitar la escucha del siguiente mensaje de texto de este ID
    esperandoNumero[ctx.from.id] = true;
    ctx.reply("📱 Envía el número a consultar:");
});

// ==========================================
// COMANDO /ME (PERFIL DE USUARIO)
// ==========================================

bot.command('me', async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : "No configurado";
    const nombreCompleto = `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim();
    
    let tipoMembresia = "❌ Sin acceso activo";

    if (userId === OWNER_ID) {
        tipoMembresia = "👑 Owner / Creador";
    } else if (database.sellers.includes(userId)) {
        tipoMembresia = "💼 Seller / Vendedor Autorizado";
    } else {
        const acceso = database.vips[userId];
        if (acceso) {
            if (acceso === 'perm') {
                tipoMembresia = "💎 VIP Permanente";
            } else if (new Date(acceso) > new Date()) {
                const fechaFormat = new Date(acceso).toISOString().split('T')[0];
                tipoMembresia = `⏱️ VIP Activo (Vence: ${fechaFormat})`;
            } else {
                tipoMembresia = "❌ Membresía Expirada";
            }
        }
    }

    let panelUsuario = `╔════════════════════════╗\n`;
    panelUsuario += `   👤   *MI PERFIL DE ACCESO*   \n`;
    panelUsuario += `╚════════════════════════╝\n\n`;
    panelUsuario += `🆔 *Tu ID:* \`${userId}\`\n`;
    panelUsuario += `👤 *Usuario:* ${username}\n`;
    panelUsuario += `📝 *Nombre:* \`${nombreCompleto}\`\n`;
    panelUsuario += `🏅 *Membresía:* *${tipoMembresia}*\n`;
    panelUsuario += `─────────────────────────\n`;
    panelUsuario += `✨ *by : @El_CuervoX*`;

    ctx.reply(panelUsuario, { parse_mode: 'Markdown' });
});

// ==========================================
// SECCIÓN DE VENTAS Y SELLE (Sellers)
// ==========================================

// Registrar vendedores en el bot (Solo ejecutable por el Owner)
bot.command('addseller', (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const sellerId = parseInt(ctx.message.text.split(' ')[1]);
    
    if (!sellerId || isNaN(sellerId)) {
        return ctx.reply("❌ Uso incorrecto.\nFormato: `/addseller [ID_Telegram_Numerico]`", { parse_mode: 'Markdown' });
    }
    
    if (!database.sellers.includes(sellerId)) {
        database.sellers.push(sellerId);
    }
    ctx.reply(`✅ El ID \`${sellerId}\` ha sido agregado como Seller autorizado.`, { parse_mode: 'Markdown' });
});

// Generar ventas por ID de usuario (Ejecutable por Owner y Sellers registrados)
bot.command('vender', async (ctx) => {
    const sellerId = ctx.from.id;
    const esSeller = database.sellers.includes(sellerId) || sellerId === OWNER_ID;
    if (!esSeller) return; 

    const args = ctx.message.text.split(' ');
    const clienteId = parseInt(args[1]);
    const tiempo = args[2];

    if (!clienteId || isNaN(clienteId) || !tiempo) {
        return ctx.reply("❌ *Formato de venta inválido.*\nUso obligatorio: `/vender [ID_Cliente] [Dias / perm]`", { parse_mode: 'Markdown' });
    }

    if (tiempo.toLowerCase() === 'perm') {
        database.vips[clienteId] = 'perm';
    } else {
        let limite = new Date();
        limite.setDate(limite.getDate() + parseInt(tiempo));
        database.vips[clienteId] = limite;
    }

    ctx.reply(`✅ *Venta exitosa!*\n🎯 *Cliente ID:* \`${clienteId}\`\n⏱ *Acceso:* \`${tiempo === 'perm' ? 'Permanente' : tiempo + ' días'}\``, { parse_mode: 'Markdown' });

    // Notificar de manera privada al comprador que su cuenta se activó
    try {
        await bot.telegram.sendMessage(clienteId, `🎉 *¡Tu acceso ha sido activado con éxito!*\n\n⏱️ *Duración:* ${tiempo === 'perm' ? 'Permanente' : tiempo + ' días'}\n\nPresiona /nequi para empezar.`, { parse_mode: 'Markdown' });
    } catch (e) {
        ctx.reply("⚠️ El cliente no ha iniciado el bot todavía, pero ya está guardado en el sistema.");
    }

    // Alerta inmediata al Owner con el username del vendedor y su ID
    if (sellerId !== OWNER_ID) {
        const vendedorUsername = ctx.from.username ? `@${ctx.from.username}` : "No configurado";
        await bot.telegram.sendMessage(OWNER_ID, 
            `🔔 **NOTIFICACIÓN DE VENTA**\n\n` +
            `👤 **Vendedor:** ${vendedorUsername}\n` +
            `🆔 **ID Vendedor:** \`${sellerId}\`\n\n` +
            `🎯 **Cliente ID:** \`${clienteId}\`\n` +
            `⏱️ **Plan:** \`${tiempo === 'perm' ? 'Permanente' : tiempo + ' días'}\`\n\n` +
            `👁️ _El Ojo de Dios System_`, 
            { parse_mode: 'Markdown' }
        );
    }
});

// ==========================================
// CAPTURA DE TEXTO, BARRA DE CARGA Y API
// ==========================================

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;

    // Detener si el usuario no ejecutó el paso previo del comando /nequi
    if (!esperandoNumero[userId]) return;
    
    // Desactivar bandera de escucha
    delete esperandoNumero[userId];

    const numero = ctx.message.text.trim();
    
    if (isNaN(numero) || numero.length < 7) {
        return ctx.reply("❌ Número inválido. Presiona /nequi e intenta de nuevo.");
    }

    const accesoAutorizado = await verificarAcceso(ctx);
    if (!accesoAutorizado) return;

    const tiempoInicio = Date.now();

    // 1. DEVOLVER RESPUESTA SI YA EXISTE EN CACHÉ LOCAL
    if (cacheConsultas[numero]) {
        const datosCache = cacheConsultas[numero];
        
        let respuestaCache = `╔════════════════════════╗\n`;
        respuestaCache += `   👁️   *EL OJO DE DIOS* 👁️\n`;
        respuestaCache += `╚════════════════════════╝\n\n`;
        respuestaCache += `📱 *Destino:* \`${numero}\`\n`;
        respuestaCache += `⚡ *Origen:* \`Caché Local\`\n`;
        respuestaCache += `⏱️ *Tiempo de carga:* \`0.01s\`\n\n`;
        respuestaCache += `📝 *INFORMACIÓN DETALLADA:*\n`;
        respuestaCache += `─────────────────────────\n`;
        
        for (const [key, value] of Object.entries(datosCache)) {
            const llaveLimpia = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            respuestaCache += `🔹 *${llaveLimpia}:* \`${value}\`\n`;
        }
        
        respuestaCache += `─────────────────────────\n`;
        respuestaCache += `✨ *by : @El_CuervoX*`;

        return ctx.reply(respuestaCache, { parse_mode: 'Markdown' });
    }

    // 2. ANIMACIÓN DE LA BARRA DE CARGA
    const mensajeCarga = await ctx.reply("⏳ *Iniciando consulta...*\n`[░░░░░░░░░░] 0%`", { parse_mode: 'Markdown' });
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    try {
        await delay(400);
        await ctx.telegram.editMessageText(ctx.chat.id, mensajeCarga.message_id, null, "⚡ *Conectando con la API...*\n`[████░░░░░░] 40%`", { parse_mode: 'Markdown' }).catch(()=>{});
        
        // Petición Real a la API Externa usando Axios
        const url = `https://cuervo-api.vercel.app/nequi/${numero}?key=ohhyejin1`;
        const response = await axios.get(url);
        const data = response.data;

        await delay(400);
        await ctx.telegram.editMessageText(ctx.chat.id, mensajeCarga.message_id, null, "🔍 *Extrayendo información...*\n`[████████░░] 80%`", { parse_mode: 'Markdown' }).catch(()=>{});

        // 3. CAPTURA DE ERROR DE TIEMPO DE ESPERA (21 minutos)[cite: 1]
        if (data.error) {
            await ctx.telegram.deleteMessage(ctx.chat.id, mensajeCarga.message_id).catch(() => {});
            
            if (data.error.includes("waiting period")) {[cite: 1]
                return ctx.reply("❌ *SISTEMA BLOQUEADO TEMPORALMENTE*\n\n⚠️ Espera unos minutos y vuelve a consultar.\nLa API requiere un tiempo de espera obligatorio.\n\n*by : @El_CuervoX*", { parse_mode: 'Markdown' });
            }
            return ctx.reply(`⚠️ *ERROR DE API:*\n\`${data.error}\`\n\n*by : @El_CuervoX*`, { parse_mode: 'Markdown' });
        }

        // Guardar resultado limpio en el almacenamiento de Caché
        cacheConsultas[numero] = data;

        await delay(200);
        await ctx.telegram.editMessageText(ctx.chat.id, mensajeCarga.message_id, null, "✨ *Estructurando datos...*\n`[██████████] 100%`", { parse_mode: 'Markdown' }).catch(()=>{});

        // Cálculo del tiempo total que consumió la carga real
        const tiempoTotal = ((Date.now() - tiempoInicio) / 1000).toFixed(2);

        // 4. RESPUESTA IMPRESA FORMATEADA Y PREMIUM
        let respuestaBonita = `╔════════════════════════╗\n`;
        respuestaBonita += `   👁️   *EL OJO DE DIOS* 👁️\n`;
        respuestaBonita += `╚════════════════════════╝\n\n`;
        respuestaBonita += `📱 *Destino:* \`${numero}\`\n`;
        respuestaBonita += `📊 *Estado:* \`Exitoso\`\n`;
        respuestaBonita += `⏱️ *Tiempo de carga:* \`${tiempoTotal}s\`\n\n`;
        respuestaBonita += `📝 *INFORMACIÓN DETALLADA:*\n`;
        respuestaBonita += `─────────────────────────\n`;
        
        for (const [key, value] of Object.entries(data)) {
            const llaveLimpia = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            respuestaBonita += `🔹 *${llaveLimpia}:* \`${value}\`\n`;
        }
        
        respuestaBonita += `─────────────────────────\n`;
        respuestaBonita += `✨ *by : @El_CuervoX*`;

        // Remover barra y desplegar panel de datos final
        await ctx.telegram.deleteMessage(ctx.chat.id, mensajeCarga.message_id).catch(() => {});
        ctx.reply(respuestaBonita, { parse_mode: 'Markdown' });

    } catch (error) {
        await ctx.telegram.deleteMessage(ctx.chat.id, mensajeCarga.message_id).catch(() => {});
        ctx.reply("❌ *Error de conexión:* Servidor fuera de línea temporalmente.\n\n*by : @El_CuervoX*", { parse_mode: 'Markdown' });
    }
});

// Lanzamiento del bot
bot.launch();
