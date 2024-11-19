const { Telegraf, Markup } = require('telegraf');

// Replace with your bot token and group chat ID
const BOT_TOKEN = '';
const ADMIN_GROUP_ID = ''; // Replace with the chat ID of the group

const bot = new Telegraf(BOT_TOKEN);

// Languages dictionary
const messages = {
    uz: {
        start: `Salom! 👋 Men sizga g'oyalar, shikoyatlar yoki takliflar bilan bo'lishishda yordam beradigan botman. O'quv jarayonini yaxshilashni, muammo haqida xabar berishni yoki shunchaki sharh qoldirmoqchimisiz? Menga yozing, men sizning xabaringizni ma'muriyatga yetkazaman. Birgalikda biz hamma narsani yaxshilaymiz!`,
        menu: 'Asosiy menyu',
        write: '✍️ Fikr bildirish',
        done: '✅ Tugatish',
        changeLanguage: '🌐 Tilni o‘zgartirish',
        chooseLanguage: 'Tilni tanlang:',
        feedbackPrompt: `Iltimos, fikrlaringizni, shikoyatlaringizni yoki g'oyalaringizni yuboring. Fotosuratlar yoki videolarni ham qo'shishingiz mumkin. Tugatish uchun "✅ Tugatish" tugmasini bosing.`,
        limitReached: `Kechirasiz, siz kuniga 20 ta fikr yuborishingiz mumkin. Ertaga davom etishingiz mumkin.`
    },
    en: {
        start: `Hello! 👋 I'm a bot that will help you share ideas, complaints or suggestions. Do you want to improve the learning process, report a problem, or just leave a comment? Write to me and I will pass on your message to the administration anonymously. Together we will make everything better!`,
        menu: 'Main Menu',
        write: '✍️ Write Feedback',
        done: '✅ Done',
        changeLanguage: '🌐 Change Language',
        chooseLanguage: 'Choose a language:',
        feedbackPrompt: `Please send your feedback, photos, or videos. Click "✅ Done" when you are finished.`,
        limitReached: `Sorry, you can send up to 20 feedback messages per day. Please try again tomorrow.`
    },
    ru: {
        start: `Привет! 👋 Я бот, который поможет тебе поделиться идеями, жалобами или предложениями. Хочешь улучшить учебный процесс, сообщить о проблеме или просто оставить комментарий? Напиши мне, и я передам твоё сообщение администрации анонимно. Вместе мы сделаем всё лучше!`,
        menu: 'Главное меню',
        write: '✍️ Оставить отзыв',
        done: '✅ Готово',
        changeLanguage: '🌐 Сменить язык',
        chooseLanguage: 'Выберите язык:',
        feedbackPrompt: `Пожалуйста, отправьте ваши отзывы, фотографии или видео. Нажмите "✅ Готово", когда закончите.`,
        limitReached: `Извините, вы можете отправлять до 20 сообщений с отзывами в день. Попробуйте завтра.`
    }
};

// Store user state
const userState = {};

// Start command
bot.start((ctx) => {
    const userId = ctx.from.id;
    userState[userId] = { lang: 'en', feedbackMode: false, messagesToday: 0, lastReset: Date.now() };
    ctx.reply(
        messages.en.start,
        Markup.keyboard([
            [messages.en.write, messages.en.changeLanguage]
        ]).resize()
    );
});

// Handle language change
bot.hears([messages.en.changeLanguage, messages.ru.changeLanguage, messages.uz.changeLanguage], (ctx) => {
    const userId = ctx.from.id;
    const lang = userState[userId]?.lang || 'en';
    ctx.reply(
        messages[lang].chooseLanguage,
        Markup.inlineKeyboard([
            [
                Markup.button.callback('🇺🇿 Uzbek', 'set_lang_uz'),
                Markup.button.callback('🇷🇺 Russian', 'set_lang_ru'),
                Markup.button.callback('🇬🇧 English', 'set_lang_en')
            ]
        ])
    );
});

// Language selection handler
bot.action(/set_lang_(.+)/, (ctx) => {
    const userId = ctx.from.id;
    const lang = ctx.match[1];

    // Initialize user state if it doesn't exist
    if (!userState[userId]) {
        userState[userId] = { lang: 'en', feedbackMode: false, messagesToday: 0, lastReset: Date.now() };
    }

    // Update the user's language preference
    userState[userId].lang = lang;

    // Send a confirmation message with the main menu in the selected language
    ctx.reply(
        messages[lang].start,
        Markup.keyboard([
            [messages[lang].write, messages[lang].changeLanguage]
        ]).resize()
    );
});

// Handle feedback writing
bot.hears([messages.en.write, messages.ru.write, messages.uz.write], (ctx) => {
    const userId = ctx.from.id;
    const lang = userState[userId]?.lang || 'en';

    userState[userId].feedbackMode = true;

    ctx.reply(
        messages[lang].feedbackPrompt,
        Markup.keyboard([
            [messages[lang].done]
        ]).resize()
    );
});

// Handle "Done" button
bot.hears([messages.en.done, messages.ru.done, messages.uz.done], (ctx) => {
    const userId = ctx.from.id;
    const lang = userState[userId]?.lang || 'en';

    userState[userId].feedbackMode = false;

    ctx.reply(
        messages[lang].menu,
        Markup.keyboard([
            [messages[lang].write, messages[lang].changeLanguage]
        ]).resize()
    );
});

// Track daily message limits
function canSendFeedback(userId) {
    const now = Date.now();
    const user = userState[userId];

    // Reset daily limit every 24 hours
    if (now - user.lastReset > 24 * 60 * 60 * 1000) {
        user.messagesToday = 0;
        user.lastReset = now;
    }

    return user.messagesToday < 20;
}

// Process feedback during feedback mode
bot.on(['text', 'photo', 'video'], (ctx) => {
    const userId = ctx.from.id;
    const lang = userState[userId]?.lang || 'en';

    if (!userState[userId]?.feedbackMode) {
        ctx.reply(`${messages[lang].menu}: Please click "✍️ Write Feedback" to start sending feedback.`);
        return;
    }

    if (!canSendFeedback(userId)) {
        ctx.reply(messages[lang].limitReached);
        return;
    }

    userState[userId].messagesToday++;

    if (ctx.message.text) {
        // Handle text feedback
        bot.telegram.sendMessage(
            ADMIN_GROUP_ID,
            `📩 New anonymous feedback:\n\n${ctx.message.text}`
        );
    } else if (ctx.message.photo) {
        // Handle photo feedback
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        bot.telegram.sendPhoto(ADMIN_GROUP_ID, photoId, {
            caption: '📩 New anonymous photo feedback.'
        });
    } else if (ctx.message.video) {
        // Handle video feedback
        const videoId = ctx.message.video.file_id;
        bot.telegram.sendVideo(ADMIN_GROUP_ID, videoId, {
            caption: '📩 New anonymous video feedback.'
        });
    }
});

// Start the bot
bot.launch()
    .then(() => console.log('Bot started'))
    .catch((error) => console.error('Error starting the bot:', error));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));