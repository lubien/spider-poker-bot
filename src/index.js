import path from 'path'
import Telegraf from 'telegraf'

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  silent: true
})

const bot = new Telegraf(process.env.BOT_TOKEN)

bot.start((ctx) => ctx.reply('Welcome'))
bot.help((ctx) => ctx.reply('Send me a sticker b'))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))
bot.startPolling()

console.log('Polling started')
