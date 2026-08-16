import { useMemo } from 'react'
import { playerAdvice } from '../engine/advice'
import {
  defenderProfile,
  formProfile,
  takerProfile,
  vacheeProfile,
} from '../engine/insights'
import { formatPoints, formatSigned } from '../engine/rules'
import { playerRecord } from '../engine/stats'
import type { Deal, PlayerId, RuleSet } from '../engine/types'
import { seriesColor } from '../palette'
import type { Player } from '../store/db'
import { Avatar } from './Avatar'
import {
  AppetiteGauge,
  ContractYieldChart,
  FormChart,
  OudlerChart,
} from './charts/InsightCharts'
import './advice.css'
import './playerreport.css'

/**
 * Tout ce que l'historique sait d'un joueur, sur une seule page.
 *
 * L'ordre n'est pas anodin : les conseils d'abord, parce qu'ils sont la seule chose qui
 * puisse changer la prochaine donne ; les graphiques ensuite, qui les justifient ; les
 * compteurs en dernier, qu'on vient chercher quand on les cherche. Une page qui commencerait
 * par les compteurs ne serait qu'un tableau de bord de plus.
 */
export function PlayerReport({
  player,
  players,
  deals,
  playerIds,
  rules,
}: {
  player: Player
  /** Toute la table : les conseils comparatifs en ont besoin, et les duels aussi. */
  players: Player[]
  deals: Deal[]
  playerIds: PlayerId[]
  rules: RuleSet
}) {
  const color = seriesColor(player.colorIndex)

  const report = useMemo(() => {
    const nameOf = (id: PlayerId) => players.find((p) => p.id === id)?.name ?? 'l’autre'
    return {
      taker: takerProfile(deals, player.id, rules),
      defender: defenderProfile(deals, player.id, rules),
      form: formProfile(deals, player.id),
      vachee: vacheeProfile(deals, player.id),
      record: playerRecord(deals, player.id),
      advice: playerAdvice(deals, player.id, playerIds, { rules, nameOf }),
    }
  }, [deals, player.id, playerIds, players, rules])

  const { taker, defender, form, vachee, record, advice } = report
  const total = deals.reduce((sum, deal) => sum + (deal.scores[player.id] ?? 0), 0)

  return (
    <div className="report">
      <header className="report__head">
        <Avatar player={player} size={54} highlighted />
        <div className="report__identity">
          <p className="report__name">{player.name}</p>
          {/* Chaque fragment porte son propre séparateur : au retour à la ligne, le point
              médian suit le fragment qu'il annonce au lieu de rester orphelin. */}
          <p className="report__meta">
            <span>
              {record.gamesPlayed} partie{record.gamesPlayed > 1 ? 's' : ''}
            </span>
            <span>
              {record.gamesWon} gagnée{record.gamesWon > 1 ? 's' : ''}
            </span>
            <span>
              {taker.deals} donne{taker.deals > 1 ? 's' : ''}
            </span>
          </p>
        </div>
        <p className="report__total num display" style={{ color }}>
          {formatSigned(total)}
        </p>
      </header>

      {advice.length > 0 ? (
        <>
          <p className="eyebrow">Ce que dit l’historique</p>
          <div className="advices">
            {advice.map((item) => (
              <p key={item.id} className="advice" data-tone={item.tone}>
                {item.text}
              </p>
            ))}
          </div>
        </>
      ) : (
        // Le silence est le comportement voulu, pas une panne : le dire évite qu'on cherche
        // ce qui ne s'affiche pas.
        <p className="report__quiet">
          Pas encore de quoi conclure quoi que ce soit. Les analyses apparaissent au fil des
          donnes, chacune à son seuil — mieux vaut se taire qu’affirmer sur trois prises.
        </p>
      )}

      <p className="eyebrow">Quand {player.name} prend</p>
      <div className="chart">
        <div className="tiles tiles--flush">
          <Tile value={String(taker.takes)} label="prises" />
          <Tile value={`${taker.won}/${taker.takes || 0}`} label="tenues" />
          <Tile
            value={taker.marginWon === null ? '—' : `+${Math.round(taker.marginWon)}`}
            label="marge tenue"
          />
          <Tile
            value={taker.marginLost === null ? '—' : `−${Math.round(taker.marginLost)}`}
            label="manque chuté"
          />
        </div>
      </div>

      <AppetiteGauge profile={taker} color={color} />
      <OudlerChart profile={taker} rules={rules} color={color} />
      <ContractYieldChart profile={taker} color={color} />

      <p className="eyebrow">Quand {player.name} ne prend pas</p>
      <div className="chart">
        <div className="tiles tiles--flush">
          <Tile
            value={
              defender.perDefense === null ? '—' : formatSigned(Math.round(defender.perDefense))
            }
            label="par donne défendue"
          />
          <Tile value={`${defender.broken}/${defender.defenses}`} label="chutes du preneur" />
          {defender.calls > 0 && (
            <Tile value={`${defender.callsWon}/${defender.calls}`} label="appelé, tenu" />
          )}
          {vachee.deals > 0 && (
            <Tile
              value={vachee.perDeal === null ? '—' : formatSigned(Math.round(vachee.perDeal))}
              label="par vachette"
            />
          )}
        </div>
      </div>

      {form.games.length > 1 && (
        <>
          <p className="eyebrow">Sa trajectoire</p>
          <FormChart profile={form} color={color} />
          <div className="chart">
            <div className="tiles tiles--flush">
              <Tile
                value={form.best === null ? '—' : formatSigned(form.best.total)}
                label="meilleure soirée"
              />
              <Tile
                value={form.worst === null ? '—' : formatSigned(form.worst.total)}
                label="pire soirée"
              />
              {form.spread !== null && (
                <Tile
                  value={formatPoints(Math.round(form.spread))}
                  label="battement par donne"
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="tile">
      <span className="tile__value num display">{value}</span>
      <span className="tile__label">{label}</span>
    </div>
  )
}
