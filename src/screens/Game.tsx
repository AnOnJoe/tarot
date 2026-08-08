import { useState } from 'react'
import type { ContractDeal, Deal, DealInput, PlayerId, RuleSet } from '../engine/types'
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
export function Game({ game, rules, onExit, onEnd, onOpenStats }: GameProps) {
  const state = useGame(game, rules)
  const [mode, setMode] = useState<Mode>({ view: 'table' })

  const backToTable = () => setMode({ view: 'table' })

  const save = async (input: DealInput, editing?: Deal) => {
    if (editing) await state.editDeal(editing.id, input)
    else await state.addDeal(input)
    backToTable()
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
    </Screen>
  )
}
