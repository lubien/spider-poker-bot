import path from 'path'
import Telegraf from 'telegraf'
import session from 'telegraf/session'
import Markup from 'telegraf/markup'
import R from 'ramda'
import * as game from './game'
import { User } from 'telegram-typings'

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  silent: true
})

const bot = new Telegraf(process.env.BOT_TOKEN || '')

bot.use(session())

bot.command('poker', commandPoker)
bot.command('finish', commandFinish)
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

async function commandFinish (ctx) {
  const inGame = game.ctxInGame(ctx)
  const messageId = game.getMessageId(ctx).getOrElse(false)

  if (!inGame || !messageId) {
    return warnNotInGame(ctx)
  }

  const voteGroups = game.getVotesGrouped(ctx).getOrElse([])
  
  const votesText = voteGroups.map(votes => {
    const firstVote = R.view(R.lensIndex(0), votes)
    const vote = R.prop('vote', firstVote)

    const peopleNames = votes
      .map(R.compose(userToName, R.prop('user')))

    return `*${vote}* ${peopleNames.join(', ')}`
  }).join('\n')

  const message = ['Game finished!', '', votesText].join('\n')

  await ctx.replyWithMarkdown(message, { reply_to_message_id: messageId })

  ctx.session.game = false
}

function warnInGame (ctx) {
  const messageId = game.getMessageId(ctx).getOrElse(false)

  if (!messageId) {
    return
  }

  ctx.reply('Already in game.', { reply_to_message_id: messageId })
}

function warnNotInGame (ctx) {
  ctx.reply('You\'re not in game.')
}

const InlineKeyboardMarkup = Markup.inlineKeyboard(
  [
    ['0', '1/2', '1', '2', '3', '5', '8'],
    ['13', '20', '40', '100', '🤔', '☕']
  ].map(row => row.map(item => Markup.callbackButton(item, item)))
).extra()

async function startGame (ctx) {
  const message = await ctx.reply(...votingMessage(ctx))
  const messageId : number = message.message_id
  ctx.session.game = game.newGame(messageId)
  return 
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

function userToName (user: User) {
  const username = R.prop('username', user)

  if (username) {
    return `@${username}`
  }

  const firstName = R.prop('first_name', user)
  const lastName = R.prop('last_name', user)

  return `${firstName} ${lastName}`.trim()
}
