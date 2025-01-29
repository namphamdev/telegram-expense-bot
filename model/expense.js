'use strict'

const moment = require('moment-timezone')

class Expense {
    constructor(
        id,
        type, // out or in
        user,
        amount,
        description,
        timestamp,
        category,
        isTemplate,
        ref
    ) {
        this.id = id
        this.type = type
        this.user = user
        this.amount = amount
        this.description = description
        this.category = category
        this.timestamp = timestamp
        this.isTemplate = isTemplate
        this.ref = ref
    }

    toString(noTimestamp, tz) {
        const parseMoney = (amount) => {
            return amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        }
        let d = moment.tz(this.timestamp, tz)
        let msg = ''
        if (!noTimestamp) {
            msg += `*${d.format('DD/MM/YY') + '* – '}`
        }
        msg +=
            '*Type: ' +
            (this.type === 'out' ? '💸' : '💰') +
            '*: *' +
            parseMoney(this.amount) +
            ' VND* (' +
            this.id +
            ')\n'
        msg += `${this.description} ${this.category ? ' - ' + this.category : ''} ${this.ref ? '(🔁)' : ''}`
            .replaceAll('_', '\\_')
            .replaceAll('*', '\\*')
            .replaceAll('[', '\\[')
            .replaceAll('`', '\\`')
        return msg
    }
}

module.exports = Expense
