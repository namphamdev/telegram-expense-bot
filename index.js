'use strict'

const TelegramBot = require('node-telegram-bot-api'),
    express = require('express'),
    asyncHandler = require('express-async-handler'),
    randomUUID = require('crypto').randomUUID,
    handlers = require('./handlers'),
    jobs = require('./jobs'),
    db = require('./db'),
    dotenv = require('dotenv'),
    metrics = require('./metrics'),
    noop = require('./middlewares/noop'),
    rateLimit = require('./middlewares/rate_imit'),
    maintenanceMode = require('./middlewares/maintenance_mode'),
    alertMessage = require('./middlewares/alert_message')

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

async function trySelfRegister(bot, secret) {
    if (cfg.PUBLIC_URL) {
        console.log('⏳ Registering bot with Telegram API (setWebhook) ...')
        bot.setWebHook(`${cfg.PUBLIC_URL}/updates`, {
            secret_token: secret,
        })
        console.log(`✅ Successfully registered webhook '${cfg.PUBLIC_URL}/updates' (secret token: ${secret})`)
    } else {
        console.log(
            `⚠️ Auto-registration skipped, as no PUBLIC_URL was passed. You need to register the webhook yourself (secret token: ${secret}) (see https://core.telegram.org/bots/api#setwebhook)`
        )
    }
}

async function run() {
    // Initialization + checks
    if (!cfg.BOT_TOKEN) throw Error('❌ You need to pass a bot token')
    const secretToken = randomUUID()

    const dbRoot = await db.connect()

    // Bot setup
    const bot = new TelegramBot(cfg.BOT_TOKEN, {
        polling: !cfg.WEBHOOK_MODE,
    })

    // Middlewares
    let middleware = noop(bot)
    middleware = middleware.use(rateLimit(bot, 60 * 60, cfg.RATE_LIMIT || -1))
    middleware = middleware.use(maintenanceMode(bot, cfg.MAINTENANCE_MESSAGE))
    middleware = middleware.use(alertMessage(bot, cfg.ALERT_MESSAGE))

    // Handler registration
    handlers.registerAll(bot, middleware)

    // Error handlers
    bot.on('polling_error', (err) => {
        console.error(`Polling error: ${err.code} - ${err.response?.body || ''}`)
    })

    bot.on('webhook_error', (err) => {
        console.error(`Polling error: ${err.code} - ${err.response?.body || ''}`)
    })

    // Web server setup + route registration
    if (cfg.WEBHOOK_MODE) {
        const app = express()
        app.use(express.json())

        console.log('✅ Registering /updates route ...')
        app.post(
            '/updates',
            asyncHandler(async (req, res) => {
                if (req.get('X-Telegram-Bot-Api-Secret-Token') !== secretToken) {
                    return res.sendStatus(401)
                }

                bot.processUpdate(req.body)
                res.sendStatus(200)
            })
        )

        console.log('✅ Registering /metrics route ...')
        app.get(
            '/metrics',
            asyncHandler(async (req, res) => {
                res.set('Content-Type', metrics.contentType)
                res.end(await metrics.metrics())
            })
        )

        console.log('✅ Registering /health route ...')
        app.get(
            '/health',
            asyncHandler(async (req, res) => {
                let dbState = 0
                try {
                    await await dbRoot.command({ ping: 1 })
                    dbState = 1
                } catch (e) {}
                res.set('Content-Type', 'text/plain')
                res.end(`app=1\ndb=${dbState}`)
            })
        )

        app.listen(cfg.PORT, () => {
            console.log(`✅ Listening at ${cfg.PORT} ...`)
        })

        setTimeout(async () => trySelfRegister(bot, secretToken), 100)
    }

    // Job scheduling
    jobs.runDefault(bot)
    jobs.scheduleDefault(bot)
}

process.on('SIGINT', async () => {
    await db.disconnect()
    process.exit()
})

run()
