import { useState } from 'react'
import { dealHighlights } from '../engine/achievements'
import { contractBreakdown, scoreDeal } from '../engine/score'
import type { ContractDeal, Deal, DealInput, PlayerId, RuleSet } from '../engine/types'
import { DealReveal, type RevealData } from '../components/DealReveal'
import { ScoreTable } from '../components/ScoreTable'
import { Button, EmptyState, Screen, TopAction } from '../components/ui'
import type { Game as GameRecord } from '../store/db'
import { useGame } from '../store/hooks'
import { DealEntry, draftDeal } from './DealEntry'
import { Vachette } from './Vachette'
import './game.css'

interface GameProps {
  game: GameRecord
  rules: RuleSet
  onExit: () => void
  onEnd: () => void
  onOpenStats: () => void
}

/** Ce que l'écran affiche : le tableau, ou l'une des deux saisies de donne. */
type Mode =
  | { view: 'table' }
  | { view: 'contrat'; deal: ContractDeal; editing?: Deal }
  | { view: 'vachette'; editing?: Deal }

/**
 * Écran de partie : le tableau des donnes, et le point d'entrée vers la saisie.
 * Prendre la donne se fait depuis le « + » sous le portrait du preneur.
 */
/** Joueur en tête, ou `null` si personne ne se détache. */
function leaderOf(totals: Record<PlayerId, number>): PlayerId | null {
  const entries = Object.entries(totals)
  if (entries.length === 0) return null
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  const tied = entries.filter(([, value]) => value === best[1])
  return tied.length > 1 ? null : best[0]
}

export function Game({ game, rules, onExit, onEnd, onOpenStats }: GameProps) {
  const state = useGame(game, rules)
  const [mode, setMode] = useState<Mode>({ view: 'table' })
  const [reveal, setReveal] = useState<RevealData | null>(null)

  const backToTable = () => setMode({ view: 'table' })

  const save = async (input: DealInput, editing?: Deal) => {
    if (editing) {
      // Une correction n'est pas un moment de jeu : on la passe sans mise en scène.
      await state.editDeal(editing.id, input)
      backToTable()
      return
    }

    // Les scores sont recalculés ici pour connaître le nouveau meneur avant que la donne
    // ne soit relue depuis la base — la révélation doit s'afficher sans attendre l'écriture.
    const scores = scoreDeal(input, game.playerIds, rules)
    const nextTotals: Record<PlayerId, number> = {}
    for (const id of game.playerIds) {
      nextTotals[id] = (state.totals[id] ?? 0) + (scores[id] ?? 0)
    }

    await state.addDeal(input)
    backToTable()

    setReveal({
      contract: input.kind === 'vachette' ? 'vachette' : input.contract,
      takerId: input.kind === 'vachette' ? null : input.takerId,
      diff: input.kind === 'vachette' ? null : contractBreakdown(input, rules).diff,
      scores,
      feats: dealHighlights(input, rules),
      previousLeaderId: leaderOf(state.totals),
      leaderId: leaderOf(nextTotals),
    })
  }

  const remove = async (editing: Deal) => {
    await state.removeDeal(editing.id)
    backToTable()
  }

  const openDeal = (deal: Deal) => {
    if (deal.input.kind === 'vachette') setMode({ view: 'vachette', editing: deal })
    else setMode({ view: 'contrat', deal: deal.input, editing: deal })
  }

  if (state.loading) return <Screen title="Partie">{null}</Screen>

  if (mode.view === 'contrat') {
    return (
      <DealEntry
        players={state.players}
        rules={rules}
        dealNumber={(mode.editing?.index ?? state.deals.length) + 1}
        initial={mode.deal}
        onCancel={backToTable}
        onSubmit={(deal) => save(deal, mode.editing)}
        onDelete={mode.editing ? () => remove(mode.editing!) : undefined}
        // La vachette est un contrat à part entière : on y bascule depuis la même rangée.
        onSwitchToVachette={
          rules.vacheeEnabled && !mode.editing
            ? () => setMode({ view: 'vachette' })
            : undefined
        }
      />
    )
  }

  if (mode.view === 'vachette') {
    return (
      <Vachette
        players={state.players}
        rules={rules}
        dealNumber={(mode.editing?.index ?? state.deals.length) + 1}
        initial={
          mode.editing?.input.kind === 'vachette' ? mode.editing.input : undefined
        }
        onCancel={backToTable}
        onSubmit={(deal) => save(deal, mode.editing)}
        onDelete={mode.editing ? () => remove(mode.editing!) : undefined}
      />
    )
  }

  const startContract = (takerId: PlayerId) =>
    setMode({ view: 'contrat', deal: draftDeal(takerId) })

  return (
    <Screen
      title={`${state.deals.length} donne${state.deals.length > 1 ? 's' : ''}`}
      left={<TopAction onClick={onExit}>Parties</TopAction>}
      right={
        <TopAction onClick={onOpenStats} align="end">
          Stats
        </TopAction>
      }
      footer={
        <>
          <Button
            variant="primary"
            onClick={() => startContract(state.nextDealerId)}
          >
            Nouvelle donne
          </Button>
          <Button variant="ghost" onClick={onEnd}>
            Terminer
          </Button>
        </>
      }
    >
      <ScoreTable
        players={state.players}
        deals={state.deals}
        totals={state.totals}
        nextDealerId={state.nextDealerId}
        onTake={startContract}
        onOpenDeal={openDeal}
      />

      {state.deals.length === 0 && (
        <EmptyState title="La partie commence">
          <p>
            Touchez le joueur qui a pris pour saisir la donne. Le liseré indique qui donne.
          </p>
        </EmptyState>
      )}

      {reveal && (
        <DealReveal
          data={reveal}
          players={state.players}
          onDone={() => setReveal(null)}
        />
      )}
    </Screen>
  )
}
