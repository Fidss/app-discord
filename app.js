const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    EmbedBuilder,
    Colors
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages // Diperlukan untuk mengirim log
    ]
});

// ==========================
// CONFIGURATION
// ==========================
const CONFIG = {
    TOKEN: 'MTUwOTAzNzc0MTE2MDE0MDgyMQ.Gejozg.FCWl91TmLkM97DhpDl5PpKZP9HM_TJy705cFs4',
    CHANNELS: {
        AFK: '1509039041771995257',       // ID Room AFK
        LOG: '1509041039326052373'        // ID Channel Log
    },
    TIMERS: {
        AUTO_MOVE_MINUTES: 30,            // Total waktu sebelum dipindah (menit)
        WARN_BEFORE_MINUTES: 5            // Kirim pesan peringatan X menit sebelum dipindah
    }
};

// Map untuk menyimpan 2 timer sekaligus (Warning & Move)
const activeTimers = new Map();

// ==========================
// MODERN CONSOLE LOGGER
// ==========================
const Logger = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m \x1b[1m${msg}\x1b[0m`),
    success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
    system: (msg) => console.log(`\x1b[35m[SYSTEM]\x1b[0m ${msg}`),
};

// ==========================
// EVENT: BOT READY
// ==========================
client.once('ready', () => {
    Logger.system(`Bot successfully booted up!`);
    Logger.info(`Logged in as: ${client.user.tag}`);
    Logger.info(`Auto-move AFK: ${CONFIG.TIMERS.AUTO_MOVE_MINUTES} minutes`);
    Logger.info(`Warning DM: ${CONFIG.TIMERS.WARN_BEFORE_MINUTES} minutes before move`);
    console.log('='.repeat(50));
});

// ==========================
// EVENT: VOICE STATE UPDATE
// ==========================
client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member;
    if (!member || member.user.bot) return; // Abaikan bot

    // Fungsi kecil untuk membersihkan timer user
    const clearUserTimers = (userId) => {
        if (activeTimers.has(userId)) {
            const timers = activeTimers.get(userId);
            clearTimeout(timers.warnTimer);
            clearTimeout(timers.moveTimer);
            activeTimers.delete(userId);
        }
    };

    // JIKA USER KELUAR VC
    if (!newState.channelId) {
        if (activeTimers.has(member.id)) {
            clearUserTimers(member.id);
            Logger.warn(`[${member.user.tag}] left Voice Channel. Timers destroyed.`);
        }
        return;
    }

    // CEK STATUS MUTE/DEAFEN
    const isMuted = newState.selfMute || newState.serverMute || newState.selfDeaf || newState.serverDeaf;

    if (isMuted) {
        // Jangan buat timer dobel jika sudah ada
        if (activeTimers.has(member.id)) return;

        Logger.info(`[${member.user.tag}] is now Muted/Deafened. Starting timers...`);

        // Kalkulasi waktu (Convert ke Milliseconds)
        const totalMoveMs = CONFIG.TIMERS.AUTO_MOVE_MINUTES * 60 * 1000;
        const warnMs = (CONFIG.TIMERS.AUTO_MOVE_MINUTES - CONFIG.TIMERS.WARN_BEFORE_MINUTES) * 60 * 1000;

        // 1. TIMER PERINGATAN (WARNING)
        const warnTimer = setTimeout(async () => {
            try {
                // Pastikan user masih di VC dan masih mute
                const currentState = member.voice;
                if (!currentState.channelId) return;

                const warnEmbed = new EmbedBuilder()
                    .setColor(Colors.Yellow)
                    .setTitle('⚠️ Peringatan AFK')
                    .setDescription(`Halo **${member.user.username}**! Kamu telah di-mute/deafen untuk waktu yang lama.`)
                    .addFields({ name: 'Tindakan', value: `Kamu akan dipindahkan ke room AFK dalam **${CONFIG.TIMERS.WARN_BEFORE_MINUTES} menit** jika tidak unmute.` })
                    .setTimestamp()
                    .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() });

                await member.send({ embeds: [warnEmbed] });
                Logger.warn(`[${member.user.tag}] Warning DM sent.`);
            } catch (err) {
                Logger.error(`[${member.user.tag}] Failed to send Warning DM (DMs might be closed).`);
            }
        }, warnMs);

        // 2. TIMER PINDAH ROOM (MOVE)
        const moveTimer = setTimeout(async () => {
            try {
                const latestState = member.voice;

                // Jika sudah keluar atau sudah unmute, batalkan
                if (!latestState.channelId) {
                    clearUserTimers(member.id);
                    return;
                }

                const stillMuted = latestState.selfMute || latestState.serverMute || latestState.selfDeaf || latestState.serverDeaf;

                if (stillMuted) {
                    // Cek Permission Bot
                    if (!member.guild.members.me.permissions.has(PermissionsBitField.Flags.MoveMembers)) {
                        Logger.error(`Missing 'Move Members' permission!`);
                        return;
                    }

                    // Pindahkan ke AFK
                    await latestState.setChannel(CONFIG.CHANNELS.AFK);
                    Logger.success(`[${member.user.tag}] successfully moved to AFK Room.`);

                    // --- KIRIM DM KE USER (Embed) ---
                    try {
                        const movedEmbed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('🛏️ Dipindahkan ke AFK')
                            .setDescription(`Kamu telah dipindahkan ke **Room AFK** karena sedang tidak aktif (Mute/Deafen) selama lebih dari **${CONFIG.TIMERS.AUTO_MOVE_MINUTES} menit**.`)
                            .setTimestamp();
                        await member.send({ embeds: [movedEmbed] });
                    } catch (e) {
                        Logger.error(`[${member.user.tag}] Failed to send Moved DM.`);
                    }

                    // --- KIRIM LOG KE CHANNEL LOG (Embed) ---
                    try {
                        const logChannel = await client.channels.fetch(CONFIG.CHANNELS.LOG);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setColor(Colors.DarkVividPink)
                                .setAuthor({ name: 'Sistem Auto-AFK', iconURL: client.user.displayAvatarURL() })
                                .setThumbnail(member.user.displayAvatarURL())
                                .addFields(
                                    { name: 'User', value: `${member} (${member.user.tag})`, inline: true },
                                    { name: 'Durasi Mute', value: `${CONFIG.TIMERS.AUTO_MOVE_MINUTES} Menit`, inline: true },
                                    { name: 'Status', value: '✅ Berhasil dipindahkan ke Room AFK' }
                                )
                                .setTimestamp();

                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    } catch (e) {
                        Logger.error(`Failed to send log to channel: ${e.message}`);
                    }
                }
            } catch (err) {
                Logger.error(`Error moving user: ${err}`);
            }

            // Bersihkan timer setelah dieksekusi
            clearUserTimers(member.id);
        }, totalMoveMs);

        // Simpan kedua timer ke dalam Map
        activeTimers.set(member.id, { warnTimer, moveTimer });

    } else {
        // JIKA USER UNMUTE SEBELUM WAKTUNYA
        if (activeTimers.has(member.id)) {
            clearUserTimers(member.id);
            Logger.success(`[${member.user.tag}] Unmuted. Timers successfully canceled.`);
        }
    }
});

// Login bot
client.login(CONFIG.TOKEN);
