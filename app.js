require('dotenv').config();

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
        GatewayIntentBits.GuildMessages
    ]
});

// ==========================
// CONFIGURATION
// ==========================
const CONFIG = {
    TOKEN: process.env.TOKEN, // Ambil token dari Railway Variables

    CHANNELS: {
        AFK: '1509039041771995257',
        LOG: '1509041039326052373'
    },

    TIMERS: {
        AUTO_MOVE_MINUTES: 30,
        WARN_BEFORE_MINUTES: 5
    }
};

// ==========================
// VALIDASI TOKEN
// ==========================
if (!CONFIG.TOKEN) {
    console.error('❌ TOKEN tidak ditemukan!');
    console.error('Tambahkan TOKEN di Railway Variables.');
    process.exit(1);
}

// ==========================
// MAP TIMER
// ==========================
const activeTimers = new Map();

// ==========================
// LOGGER
// ==========================
const Logger = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
    system: (msg) => console.log(`\x1b[35m[SYSTEM]\x1b[0m ${msg}`)
};

// ==========================
// BOT READY
// ==========================
client.once('ready', () => {
    Logger.system('Bot successfully booted up!');
    Logger.info(`Logged in as ${client.user.tag}`);
    Logger.info(`AFK Timer: ${CONFIG.TIMERS.AUTO_MOVE_MINUTES} minutes`);

    console.log('='.repeat(50));
});

// ==========================
// VOICE UPDATE
// ==========================
client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member;

    if (!member || member.user.bot) return;

    const clearUserTimers = (userId) => {
        if (activeTimers.has(userId)) {
            const timers = activeTimers.get(userId);

            clearTimeout(timers.warnTimer);
            clearTimeout(timers.moveTimer);

            activeTimers.delete(userId);
        }
    };

    // User keluar VC
    if (!newState.channelId) {
        if (activeTimers.has(member.id)) {
            clearUserTimers(member.id);

            Logger.warn(`${member.user.tag} left VC.`);
        }

        return;
    }

    // Cek mute/deafen
    const isMuted =
        newState.selfMute ||
        newState.serverMute ||
        newState.selfDeaf ||
        newState.serverDeaf;

    if (isMuted) {

        if (activeTimers.has(member.id)) return;

        Logger.info(`${member.user.tag} muted/deafened.`);

        const totalMoveMs =
            CONFIG.TIMERS.AUTO_MOVE_MINUTES * 60 * 1000;

        const warnMs =
            (CONFIG.TIMERS.AUTO_MOVE_MINUTES -
                CONFIG.TIMERS.WARN_BEFORE_MINUTES) *
            60 *
            1000;

        // ==========================
        // WARNING TIMER
        // ==========================
        const warnTimer = setTimeout(async () => {
            try {
                const currentState = member.voice;

                if (!currentState.channelId) return;

                const warnEmbed = new EmbedBuilder()
                    .setColor(Colors.Yellow)
                    .setTitle('⚠️ Peringatan AFK')
                    .setDescription(
                        `Halo **${member.user.username}**!\n\nKamu akan dipindahkan ke AFK dalam **${CONFIG.TIMERS.WARN_BEFORE_MINUTES} menit** jika tetap mute/deafen.`
                    )
                    .setTimestamp();

                await member.send({
                    embeds: [warnEmbed]
                });

                Logger.warn(`Warning sent to ${member.user.tag}`);

            } catch (err) {
                Logger.error(`DM gagal ke ${member.user.tag}`);
            }

        }, warnMs);

        // ==========================
        // MOVE TIMER
        // ==========================
        const moveTimer = setTimeout(async () => {
            try {

                const latestState = member.voice;

                if (!latestState.channelId) {
                    clearUserTimers(member.id);
                    return;
                }

                const stillMuted =
                    latestState.selfMute ||
                    latestState.serverMute ||
                    latestState.selfDeaf ||
                    latestState.serverDeaf;

                if (!stillMuted) {
                    clearUserTimers(member.id);
                    return;
                }

                // Permission check
                if (
                    !member.guild.members.me.permissions.has(
                        PermissionsBitField.Flags.MoveMembers
                    )
                ) {
                    Logger.error(
                        "Bot tidak punya permission Move Members!"
                    );

                    return;
                }

                // Move ke AFK
                await latestState.setChannel(
                    CONFIG.CHANNELS.AFK
                );

                Logger.success(
                    `${member.user.tag} dipindahkan ke AFK`
                );

                // DM USER
                try {
                    const movedEmbed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setTitle('🛏️ Dipindahkan ke AFK')
                        .setDescription(
                            `Kamu dipindahkan ke AFK karena mute/deafen lebih dari ${CONFIG.TIMERS.AUTO_MOVE_MINUTES} menit.`
                        )
                        .setTimestamp();

                    await member.send({
                        embeds: [movedEmbed]
                    });

                } catch (e) {
                    Logger.error(`Gagal DM ${member.user.tag}`);
                }

                // LOG CHANNEL
                try {
                    const logChannel =
                        await client.channels.fetch(
                            CONFIG.CHANNELS.LOG
                        );

                    if (logChannel) {

                        const logEmbed = new EmbedBuilder()
                            .setColor(Colors.DarkVividPink)
                            .setTitle('📋 Auto AFK Log')
                            .addFields(
                                {
                                    name: 'User',
                                    value: `${member.user.tag}`,
                                    inline: true
                                },
                                {
                                    name: 'Durasi',
                                    value: `${CONFIG.TIMERS.AUTO_MOVE_MINUTES} menit`,
                                    inline: true
                                },
                                {
                                    name: 'Status',
                                    value: '✅ Dipindahkan ke AFK'
                                }
                            )
                            .setThumbnail(
                                member.user.displayAvatarURL()
                            )
                            .setTimestamp();

                        await logChannel.send({
                            embeds: [logEmbed]
                        });
                    }

                } catch (e) {
                    Logger.error(`Gagal kirim log.`);
                }

            } catch (err) {
                Logger.error(`Move Error: ${err}`);
            }

            clearUserTimers(member.id);

        }, totalMoveMs);

        activeTimers.set(member.id, {
            warnTimer,
            moveTimer
        });

    } else {

        if (activeTimers.has(member.id)) {

            clearUserTimers(member.id);

            Logger.success(
                `${member.user.tag} unmuted. Timer dibatalkan.`
            );
        }
    }
});

// ==========================
// ERROR HANDLER
// ==========================
client.on('error', console.error);

process.on('unhandledRejection', console.error);

// ==========================
// LOGIN
// ==========================
client.login(CONFIG.TOKEN);
