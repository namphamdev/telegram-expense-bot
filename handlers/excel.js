const db = require('../db'),
    fs = require('fs'),
    axios = require('axios'),
    path = require('path'),
    ExpensesService = require('../services/expenses'),
    xlsx = require('xlsx'),
    Expense = require('../model/expense'),
    moment = require('moment-timezone')

const expenseService = new ExpensesService(db)

function register(bot, middleware) {
    console.log('✅ Registering handlers for excel ...')
    bot.on('message', (msg) => {
        console.log(msg)
        const chatId = msg.chat.id
        if (
            msg.document &&
            msg.document.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ) {
            const fileId = msg.document.file_id
            const fileName = msg.document.file_name
            const fileSize = msg.document.file_size

            // Download the file
            bot.getFileLink(fileId)
                .then(async (fileLink) => {
                    bot.sendMessage(
                        chatId,
                        `File received: ${fileName} (${fileSize} bytes). Download link: ${fileLink}`
                    )
                    // Download the file to /temp/file.xlsx
                    const response = await axios.get(fileLink, { responseType: 'arraybuffer' })
                    // check temp folder
                    const tempFolder = path.join(__dirname, '..', 'temp')
                    if (!fs.existsSync(tempFolder)) {
                        fs.mkdirSync(tempFolder)
                    }
                    const filePath = path.join(tempFolder, 'file.xlsx')
                    fs.writeFileSync(filePath, response.data)
                    const workbook = xlsx.readFile(filePath)
                    // extract data from workbook
                    const sheet = workbook.Sheets[workbook.SheetNames[0]]
                    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 })
                    let found = false
                    const data = []
                    const parseAmount = (amount) => {
                        return parseFloat(amount.replace(/,/g, '').replace(' VND', ''))
                    }
                    const existData = await expenseService.listAll(msg.chat.id)
                    console.log(existData)
                    for (let i = 0; i < json.length; i++) {
                        const row = json[i]
                        if (row?.[1]?.includes('STT')) {
                            found = true
                            continue
                        }
                        if (!found) continue
                        if (!row[2]) continue
                        const date = row[2].split('\n')[0]
                        const ref = row[2].split('\n')[1]
                        const amountOut = row[3]
                        const amountIn = row[4]
                        const description = row[6]
                        const exist = existData.find((e) => e.ref === ref)
                        if (exist) continue
                        data.push(
                            new Expense(
                                null,
                                amountOut ? 'out' : 'in',
                                msg.chat.id,
                                parseAmount(amountOut || amountIn),
                                description,
                                moment(date, 'DD/MM/YYYY').tz('Asia/Ho_Chi_Minh').toDate(),
                                'Import',
                                false,
                                ref
                            )
                        )
                    }
                    if (data.length) await expenseService.insertMany(data)
                    await bot.sendMessage(chatId, `✅ Added *${data.length}* expenses.`)
                })
                .catch((error) => {
                    console.error('Error:', error)
                    bot.sendMessage(chatId, 'Sorry, there was an error handling the file.')
                })
        }
    })
}

module.exports = {
    register,
}
