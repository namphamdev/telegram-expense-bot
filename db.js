const MongoClient = require('mongodb').MongoClient
const dotenv = require('dotenv')

dotenv.config()

const config = {
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

const client = new MongoClient(config.DB_URL, { useUnifiedTopology: true })
const collections = {}

async function connect() {
    try {
        await client.connect()
        await client.db().command({ ping: 1 })
        console.log('✅ Connected to database ...')

        // get collections
        collections.expenses = client.db().collection(config.DB_COLLECTION || 'expenses')
        collections.misc = client.db().collection(config.DB_COLLECTION_MISC || 'misc')

        return await client.db()
    } catch (e) {
        console.error(e)
        await disconnect()
    }
}

async function disconnect() {
    await client.close()
    console.log('✅ Disconnected from database ...')
}

function expenses() {
    return collections.expenses
}

function misc() {
    return collections.misc
}

module.exports = {
    connect,
    disconnect,
    expenses,
    misc,
}
