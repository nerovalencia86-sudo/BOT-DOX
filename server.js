const { Telegraf } = require('telegraf');
const axios = require('axios');

// Token oficial configurado
const bot = new Telegraf('8664870579:AAGIej251Y_tj2n6VcESVjAyvxcFeoy0TVo'); 

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

// Función auxiliar para generar el panel /start
function enviarStart(ctx) {
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

    let bienvenidaPanel = `👁️ *¡Bienvenido al Ojo de Dios!* \n`;
    bienvenidaPanel += `Para realizar una consulta presiona el comando /nequi\n\n`;
    bienvenidaPanel += `╔════════════════════════╗\n`;
    bienvenidaPanel += `   👤   *MI PERFIL DE ACCESO*   \n`;
    bienvenidaPanel += `╚════════════════════════╝\n\n`;
    bienvenidaPanel += `🆔 *Tu ID:* \`${userId}\`\n`;
    bienvenidaPanel += `👤 *Usuario:* ${username}\n`;
    bienvenidaPanel += `📝 *Nombre:* \`${nombreCompleto}\`\n`;
    bienvenidaPanel += `🏅 *Membresía:* *${tipoMembresia}*\n`;
    bienvenidaPanel += `─────────────────────────\n`;
    bienvenidaPanel += `✨ *by : @El_CuervoX*`;

    ctx.reply(bienvenidaPanel, { parse_mode: 'Markdown' });
}

// ==========================================
// COMANDO /START 
// ==========================================

bot.start((ctx) => {
    enviarStart(ctx);
});

bot.command('nequi', async (ctx) => {
    const accesoAutorizado = await verificarAcceso(ctx);
    if (!accesoAutorizado) return;

    esperandoNumero[ctx.from.id] = true;
    ctx.reply("📱 Envía el número a consultar:");
});

// ==========================================
// COMANDO /PANEL (Sellers y Owner)
// ==========================================

bot.command('panel', (ctx) => {
    const userId = ctx.from.id;
    const esSeller = database.sellers.includes(userId);
    const esOwner = userId === OWNER_ID;

    if (!esSeller && !esOwner) {
        return enviarStart(ctx);
    }

    let menu = `╔════════════════════════╗\n`;
    menu += `   ⚙️   *PANEL DE CONTROL*   \n`;
    menu += `╚════════════════════════╝\n\n`;
    
    if (esOwner) {
        menu += `👑 *RANGO:* \`Owner / Dueño\`\n\n`;
        menu += `📝 *COMANDOS DISPONIBLES:*\n`;
        menu += `🔹 \`/vender [ID] [Dias/perm]\` ➔ Asignar membresías\n`;
        menu += `🔹 \`/lista\` ➔ Ver vendedores y clientes VIP\n`;
        menu += `🔹 \`/addseller [ID]\` ➔ Registrar un vendedor\n`;
        menu += `🔹 \`/delseller [ID]\` ➔ Eliminar un vendedor\n`;
    } else if (esSeller) {
        menu += `💼 *RANGO:* \`Seller Autorizado\`\n\n`;
        menu += `📝 *COMANDOS DISPONIBLES:*\n`;
        menu += `🔹 \`/vender [ID] [Dias/perm]\` ➔ Asignar membresías\n`;
        menu += `🔹 \`/lista\` ➔ Ver clientes VIP de la base de datos\n`;
    }

    menu += `─────────────────────────\n`;
    menu += `✨ *by : @El_CuervoX*`;

    ctx.reply(menu, { parse_mode: 'Markdown' });
});

// ==========================================
// COMANDO /LISTA (Ver Vendedores y VIPs)
// ==========================================

bot.command('lista', (ctx) => {
    const userId = ctx.from.id;
    const esSeller = database.sellers.includes(userId);
    const esOwner = userId === OWNER_ID;

    if (!esSeller && !esOwner) return; 

    let output = `╔════════════════════════╗\n`;
    output += `   📋   *BASE DE DATOS ACTIVA*   \n`;
    output += `╚════════════════════════╝\n\n`;

    if (esOwner) {
        output += `💼 *VENDEDORES AUTORIZADOS (${database.sellers.length}):*\n`;
        if (database.sellers.length === 0) {
            output += `_No hay vendedores registrados_\n`;
        } else {
            database.sellers.forEach(id => {
                output += ` ├ \`${id}\`\n`;
            });
        }
        output += `─────────────────────────\n\n`;
    }

    const vipsKeys = Object.keys(database.vips);
    output += `💎 *CLIENTES CON ACCESO VIP (${vipsKeys.length}):*\n`;
    
    if (vipsKeys.length === 0) {
        output += `_No hay clientes registrados en el sistema_\n`;
    } else {
        vipsKeys.forEach(id => {
            const acceso = database.vips[id];
            if (acceso === 'perm') {
                output += ` ├ 🆔 \`${id}\` ➔ \`💎 Permanente\`\n`;
            } else {
                const expira = new Date(acceso);
                if (expira > new Date()) {
                    const fechaFormat = expira.toISOString().split('T')[0];
                    output += ` ├ 🆔 \`${id}\` ➔ \`⏱️ Vence: ${fechaFormat}\`\n`;
                } else {
                    output += ` ├ 🆔 \`${id}\` ➔ \`❌ Expirado\`\n`;
                }
            }
        });
    }

    output += `─────────────────────────\n`;
    output += `✨ *by : @El_CuervoX*`;

    ctx.reply(output, { parse_mode: 'Markdown' });
});

// ==========================================
// SECCIÓN DE ADMINISTRACIÓN (Vendedores)
// ==========================================

bot.command('addseller', (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const sellerId = parseInt(ctx.message.text.split(' ')[1]);
    
    if (!sellerId || isNaN(sellerId)) {
        return ctx.reply("❌ Uso incorrecto.\nFormato: `/addseller [ID]`", { parse_mode: 'Markdown' });
    }
    
    if (!database.sellers.includes(sellerId)) {
        database.sellers.push(sellerId);
    }
    ctx.reply(`✅ El ID \`${sellerId}\` ha sido agregado como Seller autorizado.`, { parse_mode: 'Markdown' });
});

bot.command('delseller', (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const sellerId = parseInt(ctx.message.text.split(' ')[1]);
    
    if (!sellerId || isNaN(sellerId)) {
        return ctx.reply("❌ Uso incorrecto.\nFormato: `/delseller [ID]`", { parse_mode: 'Markdown' });
    }
    
    const index = database.sellers.indexOf(sellerId);
    if (index !== -1) {
        database.sellers.splice(index, 1);
        ctx.reply(`🗑️ El ID \`${sellerId}\` ha sido revocado de sus permisos de Seller.`, { parse_mode: 'Markdown' });
    } else {
        ctx.reply(`⚠️ El ID \`${sellerId}\` no era un Seller registrado.`);
    }
});

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

    try {
        await bot.telegram.sendMessage(clienteId, `🎉 *¡Tu acceso ha sido activado con éxito!*\n\n⏱️ *Duración:* ${tiempo === 'perm' ? 'Permanente' : tiempo + ' días'}\n\nPresiona /nequi para empezar.`, { parse_mode: 'Markdown' });
    } catch (e) {
        ctx.reply("⚠️ El cliente no ha iniciado el bot todavía, pero ya está guardado en el sistema.");
    }

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

    if (!esperandoNumero[userId]) return;
    delete esperandoNumero[userId];

    const numero = ctx.message.text.trim();
    
    if (isNaN(numero) || numero.length < 7) {
        return ctx.reply("❌ Número inválido. Presiona /nequi e intenta de nuevo.");
    }

    const accesoAutorizado = await verificarAcceso(ctx);
    if (!accesoAutorizado) return;

    if (userId !== OWNER_ID) {
        const userUsername = ctx.from.username ? `@${ctx.from.username}` : "No configurado";
        const userNombre = `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim();
        
        bot.telegram.sendMessage(OWNER_ID,
            `📢 **NUEVA CONSULTA REALIZADA**\n\n` +
            `👤 **Usuario:** ${userNombre} (${userUsername})\n` +
            `🆔 **ID Cliente:** \`${userId}\`\n` +
            `📱 **Celular Buscado:** \`${numero}\`\n\n` +
            `👁️ _El Ojo de Dios System_`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    }

    if (cacheConsultas[numero]) {
        const datosCache = cacheConsultas[numero];
        const apiTiempo = datosCache.tiempo || "0.01s";
        
        let respuestaCache = `╔════════════════════════╗\n`;
        respuestaCache += `   👁️   *EL OJO DE DIOS* 👁️\n`;
        respuestaCache += `╚════════════════════════╝\n\n`;
        respuestaCache += `📱 *Celular:* \`${numero}\`\n`;
        respuestaCache += `📊 *Estado:* \`Exitoso (Caché)\`\n`;
        respuestaCache += `⏱️ *Tiempo de carga:* \`${apiTiempo}\`\n\n`;
        respuestaCache += `📝 *INFORMACIÓN DETALLADA:*\n`;
        respuestaCache += `─────────────────────────\n`;
        
        for (const [key, value] of Object.entries(datosCache)) {
            if (key.toLowerCase() === 'eps' || key.toLowerCase() === 'tiempo') continue;
            const llaveLimpia = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            respuestaCache += `🔹 *${llaveLimpia}:* \`${value}\`\n`;
        }
        
        respuestaCache += `─────────────────────────\n`;
        respuestaCache += `✨ *by : @El_CuervoX*`;

        return ctx.reply(respuestaCache, { parse_mode: 'Markdown' });
    }

    const mensajeCarga = await ctx.reply("⏳ *Iniciando consulta...*\n`[░░░░░░░░░░] 0%`", { parse_mode: 'Markdown' });
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    try {
        await delay(400);
        await ctx.telegram.editMessageText(ctx.chat.id, mensajeCarga.message_id, null, "⚡ *Conectando con la API...*\n`[████░░░░░░] 40%`", { parse_mode: 'Markdown' }).catch(()=>{});
        
        const url = `https://cuervo-api.vercel.app/nequi/${numero}?key=ohhyejin1`;
        const response = await axios.get(url);
        const data = response.data;

        await delay(400);
        await ctx.telegram.editMessageText(ctx.chat.id, mensajeCarga.message_id, null, "🔍 *Extrayendo información...*\n`[████████░░] 80%`", { parse_mode: 'Markdown' }).catch(()=>{});

        if (data.error) {
            await ctx.telegram.deleteMessage(ctx.chat.id, mensajeCarga.message_id).catch(() => {});
            if (data.error.includes("waiting period")) {
                return ctx.reply("❌ *SISTEMA BLOQUEADO TEMPORALMENTE*\n\n⚠️ Espera unos minutos y vuelve a consultar.\nLa API requiere un tiempo de espera obligatorio.\n\n*by : @El_CuervoX*", { parse_mode: 'Markdown' });
            }
            return ctx.reply(`⚠️ *ERROR DE API:*\n\`${data.error}\`\n\n*by : @El_CuervoX*`, { parse_mode: 'Markdown' });
        }

        cacheConsultas[numero] = data;

        await delay(200);
        await ctx.telegram.editMessageText(ctx.chat.id, mensajeCarga.message_id, null, "✨ *Estructurando datos...*\n`[██████████] 100%`", { parse_mode: 'Markdown' }).catch(()=>{});

        const apiTiempo = data.tiempo || "N/A";

        let respuestaBonita = `╔════════════════════════╗\n`;
        respuestaBonita += `   👁️   *EL OJO DE DIOS* 👁️\n`;
        respuestaBonita += `╚════════════════════════╝\n\n`;
        respuestaBonita += `📱 *Celular:* \`${numero}\`\n`;
        respuestaBonita += `📊 *Estado:* \`Exitoso\`\n`;
        respuestaBonita += `⏱️ *Tiempo de carga:* \`${apiTiempo}\`\n\n`;
        respuestaBonita += `📝 *INFORMACIÓN DETALLADA:*\n`;
        respuestaBonita += `─────────────────────────\n`;
        
        for (const [key, value] of Object.entries(data)) {
            if (key.toLowerCase() === 'eps' || key.toLowerCase() === 'tiempo') continue;
            const llaveLimpia = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            respuestaBonita += `🔹 *${llaveLimpia}:* \`${value}\`\n`;
        }
        
        respuestaBonita += `─────────────────────────\n`;
        respuestaBonita += `✨ *by : @El_CuervoX*`;

        await ctx.telegram.deleteMessage(ctx.chat.id, mensajeCarga.message_id).catch(() => {});
        ctx.reply(respuestaBonita, { parse_mode: 'Markdown' });

    } catch (error) {
        await ctx.telegram.deleteMessage(ctx.chat.id, mensajeCarga.message_id).catch(() => {});
        ctx.reply("❌ *Error de conexión:* Servidor fuera de línea temporalmente.\n\n*by : @El_CuervoX*", { parse_mode: 'Markdown' });
    }
});

// Servidor web interno para Render
const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Online\n');
}).listen(process.env.PORT || 3000);

bot.launch();
