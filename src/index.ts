import path from 'path'
import Telegraf from 'telegraf'
import session from 'telegraf/session'
import Markup from 'telegraf/markup'
import R from 'ramda'
import * as game from './game'

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  silent: true
})

const bot = new Telegraf(process.env.BOT_TOKEN || '')

bot.use(session())

bot.command('poker', commandPoker)
bot.on('callback_query', callbackQuery)

bot.startPolling()

console.log('Polling started')

function commandPoker (ctx) {
  const inGame = game.ctxInGame(ctx)

  if (inGame) {
    return warnInGame(ctx)
  }

  return startGame(ctx)
}

function warnInGame (ctx) {
  ctx.reply('Already in game.')
}

const InlineKeyboardMarkup = Markup.inlineKeyboard(
  [
    ['0', '1/2', '1', '2', '3', '5', '8'],
    ['13', '20', '40', '100', '🤔', '☕']
  ].map(row => row.map(item => Markup.callbackButton(item, item)))
).extra()

function startGame (ctx) {
  ctx.session.game = game.newGame()
  return ctx.reply(...votingMessage(ctx))
}

function callbackQuery (ctx) {
  const inGame = game.ctxInGame(ctx)

  if (!inGame) {
    return warnCbQueryNotInGame(ctx)
  }

  return registerVote(ctx)
}

function warnCbQueryNotInGame (ctx) {
  return ctx.answerCbQuery(`You're not in a game!`)
}

function registerVote (ctx) {
  const vote = game.getCtxVote(ctx).getOrElse(false)

  if (!vote) {
    return ctx.reply('Invalid callback query')
  }

  ctx.session.game = game.registerVote(ctx)

  ctx.editMessageText(...votingMessage(ctx))

  return ctx.answerCbQuery(`You voted [${vote}].`)
}

function votingMessage (ctx) {
  const count = game.getVoteCount(ctx).getOrElse(0)

  const text = R.cond([
    [R.equals(0), () => 'New Spider Poker game!'],
    [R.equals(1), () => 'Spider Poker game! (1 vote).'],
    [R.T, count => `Spider Poker game! (${count} votes).`]
  ])(count)

  return [text, InlineKeyboardMarkup]
}
