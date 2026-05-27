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
// VALIDASI TOKEN (DIPERBAIKI)
// ==========================
if (!CONFIG.TOKEN) {
    console.error('❌ TOKEN tidak ditemukan!');
    console.error('Tambahkan TOKEN di Railway Variables.');
    process.exit(1);
}

// CEK FORMAT TOKEN
if (!CONFIG.TOKEN.startsWith('MTE') && !CONFIG.TOKEN.startsWith('OT')) {
    console.error('❌ Format TOKEN salah!');
    console.error(`Token: ${CONFIG.TOKEN.substring(0, 10)}... (terpotong)`);
    console.error('Token Discord biasanya dimulai dengan "MTE" atau "OT"');
    process.exit(1);
}

console.log('✅ Token ditemukan dengan format yang benar');
console.log(`Panjang token: ${CONFIG.TOKEN.length} karakter`);
