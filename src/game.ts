import R from 'ramda'
import { Maybe } from 'ramda-fantasy'

const gameLens = R.lensPath(['session', 'game'])
const voteLens = R.lensPath(['update', 'callback_query', 'data'])

function ctxGame (ctx) {
  return Maybe.toMaybe(R.view(gameLens, ctx))
}

export function gameStatus (maybeGame) {
  return maybeGame.map(R.prop('active'))
}

export function ctxInGame (ctx) {
  const maybeStatus = R.compose(gameStatus, ctxGame)(ctx)
  return maybeStatus.getOrElse(false)
}

export function newGame (messageId: number) {
  return {
    active: true,
    messageId,
    votes: {}
  }
}

export function getCtxVote (ctx) {
  return Maybe.toMaybe(R.view(voteLens, ctx))
}

export function registerVote (ctx) {
  const vote = getCtxVote(ctx).getOrElse(false)

  if (!vote) {
    return ctxGame(ctx)
  }

  return assignVote(ctx, vote)
}

function assignVote (ctx, vote) {
  const game = ctxGame(ctx).getOrElse(false)
  const user = R.view(R.lensPath(['update', 'callback_query', 'from']), ctx)

  if (!user || !game) {
    return game
  }

  const voteEntryLens = R.lensPath(['votes', user.id])
  const voteEntry = { vote, user }

  return R.set(voteEntryLens, voteEntry, game)
}

export function getVoteCount (ctx) {
  return ctxGame(ctx)
    .map(R.prop('votes'))
    .map(R.compose(R.length, R.keys))
}

export function getMessageId (ctx) {
  return ctxGame(ctx).map(R.prop('messageId'))
}

export function getVotesGrouped (ctx) {
  return ctxGame(ctx)
    .map(R.prop('votes'))
    .map(votes => {
      const voteList = R.values(votes)
      const groups = R.groupBy(R.prop('vote'), voteList)

      const groupList = R.compose(R.sortBy(voteEntryIndex), R.values)(groups)

      return groupList
    })
}

function voteEntryIndex (voteEntry) {
  const value = R.prop('vote', voteEntry)

  return R.cond([
    [R.equals('1/2'), () => 0.5],
    [R.equals('🤔'), () => 100],
    [R.equals('☕'), () => 101],
    [R.T, n => parseInt(n)]
  ])
}
