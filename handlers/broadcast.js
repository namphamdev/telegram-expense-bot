const db = require('../db'),
    dotenv = require('dotenv'),
    wrapAsync = require('../utils').wrapAsync,
    UsersService = require('../services/users')

dotenv.config()

const cfg = {
    PUBLIC_URL: process.env.PUBLIC_URL,
    DB_URL: process.env.DB_URL,
    DB_COLLECTION: process.env.DB_COLLECTION,
    DB_COLLECTION_MISC: process.env.DB_COLLECTION_MISC,
    BOT_TOKEN: process.env.BOT_TOKEN,
    BOT_NAME: process.env.BOT_NAME,
    BOT_TELEGRAM_USERNAME: process.env.BOT_TELEGRAM_USERNAME,
    WEBHOOK_MODE: process.env.WEBHOOK_MODE,
    PORT: process.env.PORT,
    BIND_IP4: process.env.BIND_IP4,
    ADMINS: process.env.ADMINS,
    RATE_LIMIT: process.env.RATE_LIMIT,
    MAINTENANCE_MESSAGE: process.env.MAINTENANCE_MESSAGE,
    ALERT_MESSAGE: process.env.ALERT_MESSAGE,
}

const PATTERN_DEFAULT = /^\/broadcast (\/yes )?(.+)$/i

const userService = new UsersService(db)

function onBroadcast(bot) {
    return async function (msg, match) {
        if (!cfg.ADMINS.includes(msg.from.id)) return

        const dry = !match[1]

        let userIds, recipients

        try {
            userIds = (await userService.listActive()).map((u) => u._id)
            recipients = dry ? userIds.filter((uid) => uid === msg.from.id) : userIds

            await Promise.all(
                recipients.map((uid) =>
                    bot.sendMessage(uid, match[2], {
                        parse_mode: 'Markdown',
                        disable_web_page_preview: true,
                    })
                )
            )

            await bot.sendMessage(
                msg.chat.id,
                `✅ Sent to *${userIds.length}* users ${dry ? '(dry mode, use with `/yes`)' : ''}`,
                { parse_mode: 'Markdown' }
            )
        } catch (e) {
            console.error(`Failed to broadcast to ${userIds.length} recipients: ${e}`)
            await bot.sendMessage(msg.chat.id, `Error: \`${e}\``, { parse_mode: 'Markdown' })
        }
    }
}

function register(bot, middleware) {
    console.log('✅ Registering handlers for /broadcast ...')
    bot.onText(PATTERN_DEFAULT, middleware(wrapAsync(onBroadcast(bot))))
}

module.exports = {
    register,
}
