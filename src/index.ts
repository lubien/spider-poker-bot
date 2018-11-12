import path from 'path'
import Telegraf from 'telegraf'
import session from 'telegraf/session'
import Markup from 'telegraf/markup'
import R from 'ramda'
import { Maybe } from 'ramda-fantasy'
import * as game from './game'
import { User } from 'telegram-typings'

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  silent: true
})

const bot = new Telegraf(process.env.BOT_TOKEN || '')

bot.use(session({
  getSessionKey (ctx) {
    return ctx.chat && `${ctx.chat.id}`
  }
}))

bot.command('poker', commandPoker)
bot.on('callback_query', callbackQuery)

bot.startPolling()

console.log('Polling started')

function commandPoker (ctx) {
  const inGame = game.ctxInGame(ctx)

  if (inGame) {
    return finishGame(ctx)
  }

  return startGame(ctx)
}

async function finishGame (ctx) {
  const gameMessageId = game.getMessageId(ctx).getOrElse(false)

  if (!gameMessageId) {
    return warnNotInGame(ctx)
  }

  const voteGroups = game.getVotesGrouped(ctx).getOrElse([])
  
  const votesText = voteGroups.map(votes => {
    const firstVote = R.view(R.lensIndex(0), votes)
    const vote = R.prop('vote', firstVote)
    const count = votes.length
    const suffix = count > 1
      ? 'votes'
      : 'vote'
  
    const peopleNames = votes
      .map(R.compose(userToName, R.prop('user')))
  
    return `*${vote}* (${count} ${suffix}) ${peopleNames.join(', ')}`
  }).join('\n')

  const message = ['Game finished!', '', votesText].join('\n')

  const chatId = ctx.message.chat.id
  const inlineMessageId = undefined

  await Promise.all([
    ctx.replyWithMarkdown(message, { reply_to_message_id: gameMessageId }),
    ctx.telegram.editMessageText(chatId, gameMessageId, inlineMessageId, ...votingMessage(ctx, true))
  ])

  ctx.session.game = false
}

function warnNotInGame (ctx) {
  ctx.reply('You\'re not in game.')
}

const InlineKeyboardMarkup = Markup.inlineKeyboard(
  [
    ['0', '1/2', '1', '2', '3', '5', '8'],
    ['13', '20', '40', '100', '🤔', '☕']
  ].map(row => row.map(item => Markup.callbackButton(item, item)))
)

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

function votingMessage (ctx, finished = false) {
  const count = game.getVoteCount(ctx).getOrElse(0)
  const repliedMessageId = getRepliedMessageId(ctx)
    .getOrElse(
      getMessageId(ctx).getOrElse(undefined)
    )

  const extra = {
    reply_markup: finished ? undefined : InlineKeyboardMarkup,
    reply_to_message_id: repliedMessageId,
    parse_mode: 'Markdown'
  }

  const people = game.getVotes(ctx)
    .getOrElse([])
    .map(R.compose(userToName, R.prop('user')))

  const prefix = finished
    ? '[Closed]'
    : ''

  const votesSuffix = count === 1
    ? 'vote'
    : 'votes'

  const voteCount = count 
    ? `${count} ${votesSuffix}: ` 
    : ''

  const headerText = `*${prefix} Spider Poker game!*`.trim()

  const countText = count 
    ? `${voteCount} ${people.join(', ')}`
    : false

  const footerText = 'Run /poker to finish.'
  
  const text =
`${headerText}
${countText ? `\n${countText}\n` : ''}
${footerText}
`

  return [text, extra]
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

function getRepliedMessageId (ctx) {
  const lens = R.lensPath(['update', 'message', 'reply_to_message', 'message_id'])
  return Maybe.toMaybe(R.view(lens, ctx))
}

function getMessageId (ctx) {
  const lens = R.lensPath(['update', 'message', 'message_id'])
  return Maybe.toMaybe(R.view(lens, ctx))
}
