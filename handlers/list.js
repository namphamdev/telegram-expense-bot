const db = require('../db'),
    wrapAsync = require('../utils').wrapAsync,
    sendSplit = require('../utils').sendSplit,
    ExpensesService = require('../services/expenses'),
    KeyValueService = require('../services/keyValue')

const PATTERN_DEFAULT = /^\/list$/i
const PATTERN_MONTH = /^\/list (\d{4}-\d{2})$/i
const PATTERN_DATE = /^\/list (\d{4}-\d{2}-\d{2})$/i

const expenseService = new ExpensesService(db)
const keyValueService = new KeyValueService(db)

function onListDefault(bot) {
    return async function (msg) {
        await bot.sendMessage(
            msg.chat.id,
            `Please specify a month to list the expenses for.\nE.g. you can type \`/list 2024-02\` to get expenses for February 2024 or \`/list 2024-02 #food\` to get expenses for February 2024 in the _#food_ category.`,
            { parse_mode: 'Markdown' }
        )
    }
}

function onListDate(bot) {
    return async function (msg, match) {
        try {
            const text = await printExpenseList(msg.chat.id, null, null, match[1])
            return await sendSplit(bot, msg.chat.id, text, { parse_mode: 'Markdown' })
        } catch (e) {
            console.error(`Failed to list day-specific expenses for uer ${msg.chat.id}: ${e}`)
            await bot.sendMessage(msg.chat.id, 'Something went wrong, sorry 😕')
        }
    }
}

function onListMonth(bot) {
    return async function (msg, match) {
        try {
            const text = await printExpenseList(msg.chat.id, match[1], null)
            return await sendSplit(bot, msg.chat.id, text, { parse_mode: 'HTML' })
        } catch (e) {
            console.error(`Failed to list monthly expenses for uer ${msg.chat.id}: ${e}`)
            await bot.sendMessage(msg.chat.id, 'Something went wrong, sorry 😕')
        }
    }
}

async function printExpenseList(user, month, category, date) {
    const userTz = await keyValueService.getUserTz(user)
    const expenses = await expenseService.list(user, month, category, date)
    if (expenses.length) {
        let msg = ''
        let totalOut = 0
        let totalIn = 0
        for (let i = 0; i < expenses.length; i++) {
            const expense = expenses[i]
            msg += `${i + 1}. ${expense.toString(false, userTz)}\n`
            if (expense.type === 'out') {
                totalOut += parseFloat(expense.amount)
            } else {
                totalIn += parseFloat(expense.amount)
            }
        }
        const parseMoney = (amount) => {
            return amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        }
        msg += `\nTotal: <strong>${parseMoney(totalOut)} VND</strong> 💸, <strong>${parseMoney(
            totalIn
        )} VND</strong> 💰`
        return msg
    }
    return '🙅‍♂️ No expenses for this month'
}

function register(bot, middleware) {
    console.log('✅ Registering handlers for /list ...')
    bot.onText(PATTERN_DEFAULT, middleware(wrapAsync(onListDefault(bot))))
    bot.onText(PATTERN_MONTH, middleware(wrapAsync(onListMonth(bot))))
    bot.onText(PATTERN_DATE, middleware(wrapAsync(onListDate(bot))))
}

module.exports = {
    register,
}
