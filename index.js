const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const token = "8244085548:AAH_aoXrRTRR1ktuvTUYAEoLBB38hPxjZbY";
const bot = new TelegramBot(token, { polling: true });

var serviceAccount = require("./key.json");

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

console.log("🤖 Bot is starting...");

bot.on('polling_error', (err) => console.error("[Polling Error]", err.message));
bot.on('error', (err) => console.error("[Bot Error]", err.message));

bot.onText(/\/movie (.+)/, async (msg, match) => {
    const movie = match[1];
    const chatId = msg.chat.id;

    console.log(`📩 Command received: /movie ${movie} from chatId: ${chatId}`);

    // Fetch previously stored movies
    const snapshot = await db.collection("todo").where('chatid', "==", chatId).get();
    if (!snapshot.empty) {
        console.log(`📂 Found ${snapshot.size} stored movies for chatId ${chatId}`);
        snapshot.forEach(doc => {
            let data = doc.data();
            console.log(`   → Stored Movie: ${data.Title} (${data.Year}) Released: ${data.Released}`);
            bot.sendMessage(chatId, `Stored Movie: ${data.Title} (${data.Year}) Released: ${data.Released}`);
        });
    } else {
        console.log("📂 No previous movies found in Firestore.");
        bot.sendMessage(chatId, "No previous movies stored.");
    }

    // Fetch movie from OMDB (using axios params)
    try {
        console.log(`🌍 Fetching from OMDB: ${movie}`);
        const res = await axios.get("https://www.omdbapi.com/", {
            params: {
                apikey: "83e46333",
                t: movie
            }
        });

        if (res.data.Response === "False") {
            console.log(`❌ Movie not found: ${movie}`);
            bot.sendMessage(chatId, `Movie not found: ${movie}`);
            return;
        }

        console.log(`✅ Movie found: ${res.data.Title} (${res.data.Year}), Released: ${res.data.Released}`);

        await bot.sendMessage(chatId, `_Looking for ${movie}..._`, { parse_mode: 'Markdown' });

        if (res.data.Poster && res.data.Poster !== "N/A") {
            await bot.sendPhoto(chatId, res.data.Poster, {
                caption: `🎬 *${res.data.Title}* (${res.data.Year})\nRated: ${res.data.Rated}\nReleased: ${res.data.Released}`,
                parse_mode: "Markdown"
            });
        } else {
            await bot.sendMessage(chatId, `🎬 *${res.data.Title}* (${res.data.Year})\nRated: ${res.data.Rated}\nReleased: ${res.data.Released}`, { parse_mode: "Markdown" });
        }

        // Save to Firestore
        await db.collection('todo').add({
            chatid: chatId,
            Title: res.data.Title,
            Year: res.data.Year,
            Released: res.data.Released,
            Timestamp: new Date()
        });

        console.log("💾 Movie saved to Firestore successfully.");
        bot.sendMessage(chatId, "✅ Data stored in database successfully.");
    } catch (err) {
        console.error("❌ Error fetching from OMDB:", err.message);
        bot.sendMessage(chatId, "❌ Error fetching movie details.");
    }
});
