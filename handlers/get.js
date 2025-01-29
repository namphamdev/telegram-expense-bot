const db = require('../db'),
    wrapAsync = require('../utils').wrapAsync,
    ExpensesService = require('../services/expenses'),
    sendSplit = require('../utils').sendSplit,
    KeyValueService = require('../services/keyValue')

const keyValueService = new KeyValueService(db)
const PATTERN_DEFAULT = /^\/get$/i
const PATTERN_MONTH = /^\/get (january|february|march|april|may|june|july|august|september|october|november|december)$/i
const PATTERN_CATEGORY = /^\/get (#\w+)$/i
const PATTERN_COMBINED =
    /^\/get (january|february|march|april|may|june|july|august|september|october|november|december) (#\w+)$/i
const PATTERN_DATE = /^\/get (\d{4}-\d{2}-\d{2})$/i
const PATTERN_MONTH_YEAR = /^\/get (\d{4}-\d{2})$/i
const PATTERN_MONTH_PLAIN = /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i
const PATTERN_CATEGORY_PLAIN = /^(#\w+)$/i

const expenseService = new ExpensesService(db)

function onGetDefault(bot) {
    return async function (msg) {
        const keyboard = []
        const months = await expenseService.groupMonth(msg.chat.id)
        for (let i = 0; i < months.length; i++) {
            // 4 months per line
            keyboard[i] = months.slice(i * 4, i * 4 + 4)
        }

        return await bot.sendMessage(msg.chat.id, 'Select a month to view expenses for.', {
            reply_markup: {
                inline_keyboard: keyboard.map((e) => e.map((m) => ({ text: m, callback_data: `/get ${m}` }))),
            },
        })
    }
}

function onGetDate(bot, matchIdx) {
    return async function (msg, match) {
        try {
            const text = await printExpenseSummary(msg.chat.id, null, null, match[matchIdx || 1])
            await bot.sendMessage(msg.chat.id, text, {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true },
            })
        } catch (e) {
            console.error(`Failed to get day-specific expenses for user ${msg.chat.id}: ${e}`)
            await bot.sendMessage(msg.chat.id, 'Something went wrong, sorry 😕')
        }
    }
}

function onGetMonth(bot, matchIdx) {
    return async function (msg, match) {
        try {
            const text = await printExpenseSummary(msg.chat.id, match[matchIdx || 1], null)
            await bot.sendMessage(msg.chat.id, text, {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true },
            })
        } catch (e) {
            console.error(`Failed to get monthly expenses for user ${msg.chat.id}: ${e}`)
            await bot.sendMessage(msg.chat.id, 'Something went wrong, sorry 😕')
        }
    }
}

function onGetCategory(bot, matchIdx) {
    return async function (msg, match) {
        try {
            const text = await printExpenseSummary(msg.chat.id, null, match[matchIdx || 1])
            await bot.sendMessage(msg.chat.id, text, {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true },
            })
        } catch (e) {
            console.error(`Failed to get category expenses for user ${msg.chat.id}: ${e}`)
            await bot.sendMessage(msg.chat.id, 'Something went wrong, sorry 😕')
        }
    }
}

function onGetCombined(bot) {
    return async function (msg, match) {
        try {
            const text = await printExpenseSummary(msg.chat.id, match[1], match[2])
            await bot.sendMessage(msg.chat.id, text, {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true },
            })
        } catch (e) {
            console.error(`Failed to get combined expenses for user ${msg.chat.id}: ${e}`)
            await bot.sendMessage(msg.chat.id, 'Something went wrong, sorry 😕')
        }
    }
}

async function printExpenseSummary(user, month, category, date, bot, msg) {
    const userTz = await keyValueService.getUserTz(user)
    const expenses = await expenseService.list(user, month, category, date)
    let text = ''
    let totalOut = 0
    let totalIn = 0
    if (expenses.length) {
        for (let i = 0; i < expenses.length; i++) {
            const expense = expenses[i]
            text += `${i + 1}. ${expense.toString(false, userTz)}\n`
            if (expense.type === 'out') {
                totalOut += parseFloat(expense.amount)
            } else {
                totalIn += parseFloat(expense.amount)
            }
        }
        const parseMoney = (amount) => {
            return amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        }
        text += `\nTotal: *${parseMoney(totalOut)} VND* 💸, *${parseMoney(totalIn)} VND* 💰`
        return await sendSplit(bot, msg.chat.id, text, { parse_mode: 'Markdown' })
    }
    if (!text) {
        text = 'No expenses found.'
    }
    return text
}

function register(bot, middleware) {
    console.log('✅ Registering handlers for /get ...')
    bot.onText(PATTERN_DEFAULT, middleware(wrapAsync(onGetDefault(bot))))
    bot.onText(PATTERN_DATE, middleware(wrapAsync(onGetDate(bot))))
    bot.onText(PATTERN_MONTH, middleware(wrapAsync(onGetMonth(bot))))
    bot.onText(PATTERN_MONTH_YEAR, middleware(wrapAsync(onGetMonth(bot))))
    bot.onText(PATTERN_CATEGORY, middleware(wrapAsync(onGetCategory(bot))))
    bot.onText(PATTERN_COMBINED, middleware(wrapAsync(onGetCombined(bot))))
    bot.onText(PATTERN_MONTH_PLAIN, middleware(wrapAsync(onGetMonth(bot, 0))))
    bot.onText(PATTERN_CATEGORY_PLAIN, middleware(wrapAsync(onGetCategory(bot, 0))))
    bot.on('callback_query', async function onCallbackQuery(callbackQuery) {
        const action = callbackQuery.data
        const msg = callbackQuery.message
        if (action.includes('/get')) {
            const month = action.split('/get ')[1]
            try {
                await bot.editMessageText('Processing...', {
                    chat_id: msg.chat.id,
                    message_id: msg.message_id,
                    parse_mode: 'Markdown',
                })
                await printExpenseSummary(msg.chat.id, month, null, null, bot, msg)
                await bot.editMessageText('Done', {
                    chat_id: msg.chat.id,
                    message_id: msg.message_id,
                    parse_mode: 'Markdown',
                })
            } catch (e) {
                console.error(`Failed to get monthly expenses for user ${msg.chat.id}: ${e}`)
                await bot.sendMessage(msg.chat.id, 'Something went wrong, sorry 😕')
            }
        }
    })
}

module.exports = {
    register,
}
