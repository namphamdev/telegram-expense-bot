const Expense = require('../model/expense')

const db = require('../db'),
    wrapAsync = require('../utils').wrapAsync,
    ExpensesService = require('../services/expenses')

// delete <id>, id can be string
const PATTERN_PARAMS = /^\/delete (.*)$/i

const HELP_TEXT = `Sorry, your command must look like this: \`/delete 1\``

const expenseService = new ExpensesService(db)

function onDelete(bot) {
    return async function (msg, match) {
        const id = match[1]

        if (!id) {
            return await bot.sendMessage(msg.chat.id, HELP_TEXT, { parse_mode: 'Markdown' })
        }

        try {
            await expenseService.delete(id)

            await bot.sendMessage(msg.chat.id, `✅ Deleted expense *${id}*.`, { parse_mode: 'Markdown' })
        } catch (e) {
            console.error(`Failed to delete expense for user ${msg.chat.id}: ${e}`)
            await bot.sendMessage(
                msg.chat.id,
                '❌ Sorry, something went wrong while deleting your expense. Please try again.',
                { parse_mode: 'Markdown' }
            )
        }
    }
}

function register(bot, middleware) {
    console.log('✅ Registering handlers for /delete ...')
    bot.onText(PATTERN_PARAMS, middleware(wrapAsync(onDelete(bot))))
}

module.exports = {
    register,
}
