import { useMemo, useState } from 'react'
import { CONTRACT_LABELS, CONTRACT_ORDER, formatPoints, formatSigned } from '../engine/rules'
import { contractBreakdown, scoreDeal } from '../engine/score'
import type {
  ContractDeal,
  Contract,
  HandfulKind,
  Oudlers,
  PlayerId,
  RuleSet,
  SlamState,
} from '../engine/types'
import { Avatar } from '../components/Avatar'
import { PointSlider } from '../components/PointSlider'
import { Button, Chip, Eyebrow, Screen, TopAction } from '../components/ui'
import type { Player } from '../store/db'
import './dealentry.css'

const OUDLERS: Oudlers[] = [0, 1, 2, 3]

const HANDFUL_LABELS: Record<HandfulKind, string> = {
  simple: 'Simple',
  double: 'Double',
  triple: 'Triple',
}

const SLAM_LABELS: Record<SlamState, string> = {
  aucun: 'Aucun',
  annonceReussi: 'Annoncé et réussi',
  nonAnnonceReussi: 'Réussi sans annonce',
  annonceChute: 'Annoncé et chuté',
}

interface DealEntryProps {
  players: Player[]
  rules: RuleSet
  dealNumber: number
  /** Donne existante rouverte pour correction, ou brouillon pour une nouvelle donne. */
  initial: ContractDeal
  onCancel: () => void
  onSubmit: (deal: ContractDeal) => void
  onDelete?: () => void
}

/** Brouillon d'une donne, prêt à être édité, avec le preneur déjà désigné. */
export function draftDeal(takerId: PlayerId): ContractDeal {
  return {
    kind: 'contrat',
    contract: 'garde',
    takerId,
    partnerId: null,
    oudlers: 1,
    attackPoints: 51,
    petitAuBout: null,
    handfuls: [],
    slam: 'aucun',
    miseries: [],
  }
}

/**
 * Saisie d'une donne, dans l'ordre où elle se raconte à table : qui a pris, sur quel
 * contrat, avec combien de bouts, puis les annonces, et enfin le partage des points.
 */
export function DealEntry({
  players,
  rules,
  dealNumber,
  initial,
  onCancel,
  onSubmit,
  onDelete,
}: DealEntryProps) {
  const [deal, setDeal] = useState<ContractDeal>(initial)
  const patch = (changes: Partial<ContractDeal>) =>
    setDeal((current) => ({ ...current, ...changes }))

  const playerIds = players.map((p) => p.id)
  const taker = players.find((p) => p.id === deal.takerId)
  const isFivePlayers = players.length === 5
  const hasPartner = deal.partnerId !== null && deal.partnerId !== deal.takerId
  const defenders = players.filter(
    (p) => p.id !== deal.takerId && !(hasPartner && p.id === deal.partnerId),
  )

  const breakdown = useMemo(() => contractBreakdown(deal, rules), [deal, rules])
  const scores = useMemo(
    () => scoreDeal(deal, playerIds, rules),
    // playerIds est recalculé à chaque rendu ; sa valeur ne change que si players change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deal, players, rules],
  )

  const toggleHandful = (playerId: PlayerId, kind: HandfulKind) => {
    const existing = deal.handfuls.find((h) => h.playerId === playerId)
    if (existing?.kind === kind) {
      patch({ handfuls: deal.handfuls.filter((h) => h.playerId !== playerId) })
    } else {
      patch({
        handfuls: [...deal.handfuls.filter((h) => h.playerId !== playerId), { playerId, kind }],
      })
    }
  }

  const toggleMisery = (playerId: PlayerId) => {
    const has = deal.miseries.some((m) => m.playerId === playerId)
    patch({
      miseries: has
        ? deal.miseries.filter((m) => m.playerId !== playerId)
        : [...deal.miseries, { playerId, kind: 'atout' }],
    })
  }

  return (
    <Screen
      title={`Donne ${dealNumber}`}
      left={<TopAction onClick={onCancel}>Annuler</TopAction>}
      right={
        onDelete && (
          <TopAction onClick={onDelete} align="end">
            Supprimer
          </TopAction>
        )
      }
      footer={
        <Button variant="primary" onClick={() => onSubmit(deal)}>
          Valider · {formatSigned(scores[deal.takerId] ?? 0)} pour {taker?.name}
        </Button>
      }
    >
      <Eyebrow>Preneur</Eyebrow>
      <div className="pickRow">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            className="pick"
            aria-pressed={player.id === deal.takerId}
            onClick={() =>
              patch({
                takerId: player.id,
                // L'ancien appelé peut être devenu le preneur : on repart d'un joueur seul.
                partnerId: deal.partnerId === player.id ? null : deal.partnerId,
              })
            }
          >
            <Avatar
              player={player}
              size={46}
              highlighted={player.id === deal.takerId}
              dimmed={player.id !== deal.takerId}
            />
            <span className="pick__name">{player.name}</span>
          </button>
        ))}
      </div>

      <Eyebrow>Contrat</Eyebrow>
      <div className="chips">
        {CONTRACT_ORDER.map((contract: Contract) => (
          <Chip
            key={contract}
            selected={deal.contract === contract}
            onClick={() => patch({ contract })}
            label={CONTRACT_LABELS[contract]}
            sub={`×${formatPoints(rules.multipliers[contract])}`}
          />
        ))}
      </div>

      <Eyebrow>Bouts du preneur</Eyebrow>
      <div className="chips">
        {OUDLERS.map((oudlers) => (
          <Chip
            key={oudlers}
            selected={deal.oudlers === oudlers}
            onClick={() => patch({ oudlers })}
            label={oudlers}
            sub={`${rules.thresholds[oudlers]} pts`}
          />
        ))}
      </div>

      {isFivePlayers && (
        <>
          <Eyebrow>Roi appelé</Eyebrow>
          <div className="pickRow">
            <button
              type="button"
              className="pick pick--solo"
              aria-pressed={!hasPartner}
              onClick={() => patch({ partnerId: null })}
            >
              <span className="pick__solo">Seul</span>
              <span className="pick__name">contre 4</span>
            </button>
            {players
              .filter((p) => p.id !== deal.takerId)
              .map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className="pick"
                  aria-pressed={player.id === deal.partnerId}
                  onClick={() => patch({ partnerId: player.id })}
                >
                  <Avatar
                    player={player}
                    size={46}
                    highlighted={player.id === deal.partnerId}
                    dimmed={player.id !== deal.partnerId}
                  />
                  <span className="pick__name">{player.name}</span>
                </button>
              ))}
          </div>
        </>
      )}

      <Eyebrow>Petit au bout</Eyebrow>
      <div className="chips">
        <Chip
          selected={deal.petitAuBout === null}
          onClick={() => patch({ petitAuBout: null })}
          label="Aucun"
        />
        <Chip
          selected={deal.petitAuBout === 'attaque'}
          onClick={() => patch({ petitAuBout: 'attaque' })}
          label="Attaque"
          sub={`+${rules.petitAuBoutValue}`}
        />
        <Chip
          selected={deal.petitAuBout === 'defense'}
          onClick={() => patch({ petitAuBout: 'defense' })}
          label="Défense"
          sub={`−${rules.petitAuBoutValue}`}
        />
      </div>

      <Eyebrow>Poignées</Eyebrow>
      <div className="announce">
        {players.map((player) => {
          const current = deal.handfuls.find((h) => h.playerId === player.id)
          return (
            <div key={player.id} className="announce__row">
              <Avatar player={player} size={32} />
              <span className="announce__name">{player.name}</span>
              <div className="announce__choices">
                {(Object.keys(HANDFUL_LABELS) as HandfulKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="mini"
                    aria-pressed={current?.kind === kind}
                    onClick={() => toggleHandful(player.id, kind)}
                  >
                    {HANDFUL_LABELS[kind][0]}
                    <span className="mini__sub num">{rules.handfulValues[kind]}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        <p className="hint">
          {rules.handfulThresholds[players.length as 3 | 4 | 5].simple} atouts pour une
          simple, {rules.handfulThresholds[players.length as 3 | 4 | 5].double} pour une
          double, {rules.handfulThresholds[players.length as 3 | 4 | 5].triple} pour une
          triple. La prime revient au camp vainqueur.
        </p>
      </div>

      <Eyebrow>Chelem</Eyebrow>
      <div className="chips chips--grid">
        {(Object.keys(SLAM_LABELS) as SlamState[]).map((slam) => (
          <Chip
            key={slam}
            selected={deal.slam === slam}
            onClick={() => patch({ slam })}
            label={SLAM_LABELS[slam]}
            sub={slam === 'aucun' ? undefined : formatSigned(rules.slamValues[slam])}
          />
        ))}
      </div>

      {rules.miseryEnabled && (
        <>
          <Eyebrow>Misères</Eyebrow>
          <div className="chips">
            {players.map((player) => (
              <Chip
                key={player.id}
                selected={deal.miseries.some((m) => m.playerId === player.id)}
                onClick={() => toggleMisery(player.id)}
                label={player.name}
                sub={`+${rules.miseryValue}`}
              />
            ))}
          </div>
        </>
      )}

      <Eyebrow>Points réalisés</Eyebrow>
      <PointSlider
        value={deal.attackPoints}
        onChange={(attackPoints) => patch({ attackPoints })}
        threshold={breakdown.threshold}
        taker={taker}
        defenders={defenders}
      />

      <Eyebrow>Détail du calcul</Eyebrow>
      <div className="detail">
        <Line
          label={breakdown.success ? 'Contrat réussi' : 'Contrat chuté'}
          value={formatSigned(
            breakdown.success
              ? rules.baseValue + breakdown.diff
              : -(rules.baseValue + Math.abs(breakdown.diff)),
          )}
        />
        {breakdown.petitAuBout !== 0 && (
          <Line label="Petit au bout" value={formatSigned(breakdown.petitAuBout)} />
        )}
        <Line
          label={`Multiplicateur ${CONTRACT_LABELS[deal.contract]}`}
          value={`×${formatPoints(breakdown.multiplier)}`}
        />
        {breakdown.handful !== 0 && (
          <Line label="Poignée" value={formatSigned(breakdown.handful)} />
        )}
        {breakdown.slam !== 0 && <Line label="Chelem" value={formatSigned(breakdown.slam)} />}
        <Line label="Une part" value={formatSigned(breakdown.unit)} strong />
      </div>

      <div className="detail detail--scores">
        {players.map((player) => (
          <Line
            key={player.id}
            label={player.name}
            value={formatSigned(scores[player.id] ?? 0)}
            strong
          />
        ))}
      </div>
    </Screen>
  )
}

function Line({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="detail__line" data-strong={strong || undefined}>
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}
