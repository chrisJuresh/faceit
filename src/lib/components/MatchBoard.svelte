<script lang="ts">
  import Avatar from '$lib/components/Avatar.svelte';
  import type { LiveMatch, LivePlayer, LiveTeam } from '$lib/types';
  import { ArrowUpRight, ChevronDown, Crown, MapPin, Radio, Server, ShieldCheck } from '@lucide/svelte';

  let { match, now }: { match: LiveMatch; now: number } = $props();

  let expanded = $state<Record<string, boolean>>({});

  const phaseLabel = { live: 'LIVE', setup: 'SETTING UP', finished: 'FINISHED', cancelled: 'CANCELLED' };
  const sourceLabel = { history: 'Match history', webhook: 'FACEIT webhook', lookup: 'Manual lookup' };

  let finished = $derived(match.phase === 'finished' && match.teams.some((team) => team.players.some((p) => p.scoreline)));
  let [left, right] = $derived(match.teams);
  let clock = $derived.by(() => {
    const start = match.startedAt || match.configuredAt;
    if (!start) return '—';
    const end = match.phase === 'live' || match.phase === 'setup' ? now : match.finishedAt || now;
    return duration(Math.max(0, end - start));
  });

  function duration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  function avg(team: LiveTeam | undefined, pick: (player: LivePlayer) => number | null | undefined) {
    const values = (team?.players || []).map(pick).filter((v): v is number => typeof v === 'number' && v > 0);
    return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  }

  function sum(team: LiveTeam, pick: (player: LivePlayer) => number | undefined) {
    return team.players.reduce((total, player) => total + (pick(player) || 0), 0);
  }

  function fmt(value: number | null | undefined, digits = 0, suffix = '') {
    return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—';
  }

  function toggle(playerId: string) {
    expanded[playerId] = !expanded[playerId];
  }

  let comparisons = $derived([
    { label: 'Avg ELO', left: avg(left, (p) => p.elo), right: avg(right, (p) => p.elo), digits: 0 },
    { label: 'Avg level', left: avg(left, (p) => p.skillLevel), right: avg(right, (p) => p.skillLevel), digits: 1 },
    { label: 'Lifetime K/D', left: avg(left, (p) => p.lifetime?.kd), right: avg(right, (p) => p.lifetime?.kd), digits: 2 },
    { label: 'Lifetime ADR', left: avg(left, (p) => p.lifetime?.adr), right: avg(right, (p) => p.lifetime?.adr), digits: 1 },
    { label: 'Lifetime win %', left: avg(left, (p) => p.lifetime?.winRate), right: avg(right, (p) => p.lifetime?.winRate), digits: 0 },
    {
      label: match.map ? `${match.map.name} win %` : 'Map win %',
      left: avg(left, (p) => p.onMap?.winRate),
      right: avg(right, (p) => p.onMap?.winRate),
      digits: 0
    },
    {
      label: match.map ? `${match.map.name} matches` : 'Map matches',
      left: left ? sum(left, (p) => p.onMap?.matches) : null,
      right: right ? sum(right, (p) => p.onMap?.matches) : null,
      digits: 0
    }
  ]);
</script>

<article class="board" class:live={match.phase === 'live'} id={`match-${match.matchId}`}>
  <header class="board-top">
    <span class={`phase phase-${match.phase}`}>
      {#if match.phase === 'live'}<i class="pulse"></i>{/if}{phaseLabel[match.phase]}
    </span>
    <span class="meta">{match.competition}</span>
    {#if match.region}<span class="meta">{match.region}</span>{/if}
    <span class="meta">BO{match.bestOf}</span>
    <span class="meta">{match.calculateElo ? 'ELO on' : 'No ELO'}</span>
    {#if match.location}<span class="meta"><Server size={12} /> {match.location.name}</span>{/if}
    <span class="meta clock" title={match.phase === 'live' ? 'Time since match start' : 'Match duration'}>⏱ {clock}</span>
    <a class="room-link" href={match.faceitUrl} target="_blank" rel="noreferrer">Match room <ArrowUpRight size={13} /></a>
  </header>

  <section class="scorebar" style={match.map?.image ? `--map-image: url('${match.map.image}')` : ''}>
    <div class="team-head">
      <Avatar src={left?.avatar} name={left?.name || 'Team A'} size="lg" />
      <div>
        <strong>{left?.name}</strong>
        <span>{left?.tracked ? 'YOUR SIDE' : 'FACTION 1'}{left?.won ? ' · WINNER' : ''}</span>
      </div>
    </div>

    <div class="score-centre">
      <span class="map-name"><MapPin size={13} /> {match.map?.name || 'Map vote pending'}</span>
      <div class="score">
        <b class:won={left?.won}>{left?.score ?? '–'}</b>
        <i>:</i>
        <b class:won={right?.won}>{right?.score ?? '–'}</b>
      </div>
      {#if finished && left && right && left.firstHalf !== null}
        <span class="halves">
          H1 {left.firstHalf}–{right.firstHalf} · H2 {left.secondHalf}–{right.secondHalf}{left.overtime || right.overtime ? ` · OT ${left.overtime}–${right.overtime}` : ''}{match.rounds ? ` · ${match.rounds} rounds` : ''}
        </span>
      {:else if match.phase === 'live'}
        <span class="halves">Round score appears when the match ends (FACEIT doesn't publish it live)</span>
      {/if}
    </div>

    <div class="team-head right">
      <div>
        <strong>{right?.name}</strong>
        <span>{right?.tracked ? 'YOUR SIDE' : 'FACTION 2'}{right?.won ? ' · WINNER' : ''}</span>
      </div>
      <Avatar src={right?.avatar} name={right?.name || 'Team B'} size="lg" />
    </div>
  </section>

  {#if left && right && left.winProbability !== null && right.winProbability !== null}
    <div class="probability" aria-label="FACEIT pre-match win probability">
      <span>{left.winProbability.toFixed(0)}%</span>
      <div><i style={`width: ${left.winProbability}%`}></i></div>
      <span>{right.winProbability.toFixed(0)}%</span>
      <small>FACEIT WIN PROBABILITY</small>
    </div>
  {/if}

  <section class="matchup" aria-label="Team comparison">
    {#each comparisons as row}
      {@const better = row.left !== null && row.right !== null ? (row.left > row.right ? 'l' : row.left < row.right ? 'r' : '') : ''}
      <div>
        <b class:edge={better === 'l'}>{fmt(row.left, row.digits)}</b>
        <span>{row.label}</span>
        <b class:edge={better === 'r'}>{fmt(row.right, row.digits)}</b>
      </div>
    {/each}
  </section>

  {#each match.teams as team}
    <section class="team-table">
      <div class="team-caption">
        <strong>{team.name}</strong>
        <span>{team.averageElo ? `${team.averageElo.toLocaleString()} avg ELO` : ''}{team.rating ? ` · rating ${team.rating}` : ''}</span>
        {#if team.won}<span class="won-pill">WIN</span>{:else if match.phase === 'finished'}<span class="lost-pill">LOSS</span>{/if}
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            {#if finished}
              <tr>
                <th>Player</th><th>K</th><th>D</th><th>A</th><th>+/-</th><th>K/D</th><th>K/R</th><th>ADR</th><th>HS%</th><th>MVP</th><th>FK</th><th>Entry</th><th>Clutch</th><th>3k/4k/5k</th><th>Util</th><th>Flashed</th><th title="Stackline estimated team-relative impact">Impact<sup>est</sup></th><th></th>
              </tr>
            {:else}
              <tr>
                <th>Player</th><th>ELO</th><th>Matches</th><th>Win%</th><th>K/D</th><th>ADR</th><th>HS%</th><th>Entry%</th><th>1v1%</th><th>Streak</th><th>Recent</th>
                <th class="map-col">{match.map?.name || 'Map'} played</th><th class="map-col">Win%</th><th class="map-col">K/D</th><th class="map-col">ADR</th><th></th>
              </tr>
            {/if}
          </thead>
          <tbody>
            {#each team.players as player (player.playerId)}
              {@const s = player.scoreline}
              <tr class:tracked={player.isOwner || player.isFriend}>
                <td>
                  <a class="player" href={player.faceitUrl} target="_blank" rel="noreferrer">
                    <Avatar src={player.avatar} name={player.displayName} size="sm" />
                    <span>
                      <strong>
                        {player.displayName}
                        {#if player.isLeader}<Crown size={12} aria-label="Team captain" />{/if}
                        {#if player.verified}<ShieldCheck size={12} aria-label="Verified" />{/if}
                      </strong>
                      <small>
                        <i class={`lvl lvl-${player.skillLevel}`}>{player.skillLevel || '?'}</i>
                        {#if player.isOwner}<em>YOU</em>{:else if player.isFriend}<em>FRIEND</em>{/if}
                        {player.country}
                      </small>
                    </span>
                  </a>
                </td>
                {#if finished}
                  <td class="num strong">{s?.kills ?? '—'}</td>
                  <td class="num">{s?.deaths ?? '—'}</td>
                  <td class="num">{s?.assists ?? '—'}</td>
                  <td class="num" class:positive={s && s.kills - s.deaths > 0} class:negative={s && s.kills - s.deaths < 0}>
                    {s ? `${s.kills - s.deaths > 0 ? '+' : ''}${s.kills - s.deaths}` : '—'}
                  </td>
                  <td class="num">{fmt(s?.kd, 2)}</td>
                  <td class="num">{fmt(s?.kr, 2)}</td>
                  <td class="num strong">{fmt(s?.adr, 1)}</td>
                  <td class="num">{fmt(s?.headshots, 0)}</td>
                  <td class="num">{s?.mvps ?? '—'}</td>
                  <td class="num">{s?.firstKills ?? '—'}</td>
                  <td class="num">{s ? `${s.entryWins}/${s.entryCount}` : '—'}</td>
                  <td class="num">{s ? `${s.clutchWins}/${s.clutchAttempts}` : '—'}</td>
                  <td class="num">{s ? `${s.tripleKills}/${s.quadroKills}/${s.pentaKills}` : '—'}</td>
                  <td class="num">{s?.utilityDamage ?? '—'}</td>
                  <td class="num">{s?.enemiesFlashed ?? '—'}</td>
                  <td class="num" class:positive={s && s.swing > 0} class:negative={s && s.swing < 0}>
                    {s ? `${s.swing > 0 ? '+' : ''}${s.swing.toFixed(2)}%` : '—'}
                  </td>
                {:else}
                  {@const life = player.lifetime}
                  <td class="num strong">{player.elo ? player.elo.toLocaleString() : '—'}</td>
                  <td class="num">{life?.matches.toLocaleString() ?? '—'}</td>
                  <td class="num">{fmt(life?.winRate, 0)}</td>
                  <td class="num strong">{fmt(life?.kd, 2)}</td>
                  <td class="num">{fmt(life?.adr, 1)}</td>
                  <td class="num">{fmt(life?.headshots, 0)}</td>
                  <td class="num">{fmt(life?.entrySuccess, 0)}</td>
                  <td class="num">{fmt(life?.clutch1v1, 0)}</td>
                  <td class="num">{life ? `${life.currentStreak}${life.longestStreak ? ` / ${life.longestStreak}` : ''}` : '—'}</td>
                  <td><span class="form">{#each life?.recentResults || [] as r}<i class:win={r === 'W'}>{r}</i>{/each}</span></td>
                  <td class="num map-col">{player.onMap?.matches ?? '—'}</td>
                  <td class="num map-col">{fmt(player.onMap?.winRate, 0)}</td>
                  <td class="num map-col">{fmt(player.onMap?.kd, 2)}</td>
                  <td class="num map-col">{fmt(player.onMap?.adr, 1)}</td>
                {/if}
                <td>
                  <button class="expand" type="button" onclick={() => toggle(player.playerId)} aria-expanded={Boolean(expanded[player.playerId])} aria-label={`More stats for ${player.displayName}`}>
                    <ChevronDown size={15} />
                  </button>
                </td>
              </tr>
              {#if expanded[player.playerId]}
                <tr class="detail-row">
                  <td colspan="20">
                    <div class="detail">
                      <div>
                        <h4>Profile</h4>
                        <dl>
                          <dt>Nickname</dt><dd>{player.nickname}</dd>
                          <dt>ELO</dt><dd>{player.elo ? player.elo.toLocaleString() : '—'}</dd>
                          <dt>Level</dt><dd>{player.skillLevel || '—'}</dd>
                          <dt>Membership</dt><dd>{player.membership || '—'}</dd>
                        </dl>
                      </div>
                      {#if player.lifetime}
                        <div>
                          <h4>Lifetime CS2</h4>
                          <dl>
                            <dt>Matches</dt><dd>{player.lifetime.matches.toLocaleString()}</dd>
                            <dt>Win rate</dt><dd>{fmt(player.lifetime.winRate, 0, '%')}</dd>
                            <dt>K/D</dt><dd>{fmt(player.lifetime.kd, 2)}</dd>
                            <dt>ADR</dt><dd>{fmt(player.lifetime.adr, 1)}</dd>
                            <dt>Headshot %</dt><dd>{fmt(player.lifetime.headshots, 0, '%')}</dd>
                            <dt>Entry success</dt><dd>{fmt(player.lifetime.entrySuccess, 0, '%')}</dd>
                            <dt>1v1 win rate</dt><dd>{fmt(player.lifetime.clutch1v1, 0, '%')}</dd>
                            <dt>Streak / best</dt><dd>{player.lifetime.currentStreak} / {player.lifetime.longestStreak}</dd>
                          </dl>
                        </div>
                      {/if}
                      {#if player.onMap}
                        <div>
                          <h4>On {player.onMap.map}</h4>
                          <dl>
                            <dt>Matches</dt><dd>{player.onMap.matches}</dd>
                            <dt>Win rate</dt><dd>{fmt(player.onMap.winRate, 0, '%')}</dd>
                            <dt>K/D</dt><dd>{fmt(player.onMap.kd, 2)}</dd>
                            <dt>K/R</dt><dd>{fmt(player.onMap.kr, 2)}</dd>
                            <dt>ADR</dt><dd>{fmt(player.onMap.adr, 1)}</dd>
                            <dt>Headshot %</dt><dd>{fmt(player.onMap.headshots, 0, '%')}</dd>
                          </dl>
                        </div>
                      {/if}
                      {#if player.allStats.length}
                        <div class="all-stats">
                          <h4>Every match stat FACEIT returned</h4>
                          <div class="stat-pairs">
                            {#each player.allStats as stat}<div><span>{stat.label}</span><b>{stat.value}</b></div>{/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/each}

  <footer class="board-foot">
    <span><Radio size={12} /> Found via {sourceLabel[match.source]}</span>
    <span>Status: {match.status}</span>
    {#if match.demoAvailable}<span>Demo available in match room</span>{/if}
    <span class="mono">{match.matchId}</span>
  </footer>
</article>

<style>
  .board { background: linear-gradient(160deg, var(--surface-raised), var(--surface-quiet)); border: 1px solid var(--border); box-shadow: var(--shadow); margin-bottom: 2rem; position: relative; }
  .board.live::before { background: var(--accent); content: ''; height: 2px; left: -1px; position: absolute; right: -1px; top: -1px; }
  .board-top { align-items: center; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; padding: 0.85rem 1.1rem; }
  .phase { align-items: center; background: var(--surface); border: 1px solid var(--border-strong); color: var(--text-strong); display: inline-flex; font-size: 0.6rem; font-weight: 800; gap: 0.4rem; letter-spacing: 0.14em; padding: 0.3rem 0.5rem; }
  .phase-live { background: var(--accent); border-color: var(--accent); color: #fff; }
  .phase-setup { border-color: var(--accent-border); color: var(--accent); }
  .phase-finished { color: var(--text-muted); }
  .pulse { animation: pulse 1.4s ease-in-out infinite; background: #fff; border-radius: 50%; height: 6px; width: 6px; }
  @keyframes pulse { 50% { opacity: 0.25; } }
  .meta { align-items: center; color: var(--text-muted); display: inline-flex; font-size: 0.7rem; gap: 0.3rem; }
  .clock { color: var(--text-strong); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .room-link { align-items: center; color: var(--accent); display: inline-flex; font-size: 0.72rem; font-weight: 650; gap: 0.2rem; margin-left: auto; text-decoration: none; }

  .scorebar { align-items: center; background: linear-gradient(90deg, var(--surface-quiet) 8%, color-mix(in srgb, var(--surface-quiet) 70%, transparent) 50%, var(--surface-quiet) 92%), var(--map-image, none) center / cover; display: grid; gap: 1rem; grid-template-columns: 1fr auto 1fr; min-height: 150px; padding: 1.4rem 1.2rem; }
  .team-head { align-items: center; display: flex; gap: 0.85rem; min-width: 0; }
  .team-head.right { justify-content: flex-end; text-align: right; }
  .team-head div { display: grid; gap: 0.25rem; min-width: 0; }
  .team-head strong { color: var(--text-strong); font-size: clamp(0.95rem, 1.8vw, 1.25rem); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .team-head span { color: var(--text-muted); font-size: 0.58rem; letter-spacing: 0.14em; }
  .score-centre { display: grid; justify-items: center; text-align: center; }
  .map-name { align-items: center; color: var(--text-strong); display: inline-flex; font-size: 0.7rem; font-weight: 700; gap: 0.3rem; letter-spacing: 0.12em; text-transform: uppercase; }
  .score { align-items: baseline; display: flex; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; gap: 0.6rem; margin: 0.2rem 0; }
  .score b { color: var(--text-strong); font-size: clamp(2.6rem, 6vw, 4.4rem); font-weight: 500; letter-spacing: -0.06em; }
  .score b.won { color: var(--positive); }
  .score i { color: var(--text-muted); font-size: 2rem; font-style: normal; }
  .halves { color: var(--text-muted); font-size: 0.66rem; max-width: 280px; }

  .probability { align-items: center; border-top: 1px solid var(--border); display: grid; gap: 0.2rem 0.75rem; grid-template-columns: auto 1fr auto; padding: 0.75rem 1.2rem; }
  .probability span { color: var(--text-strong); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; }
  .probability div { background: var(--negative-soft); height: 6px; overflow: hidden; }
  .probability i { background: var(--positive); display: block; height: 100%; }
  .probability small { color: var(--text-muted); font-size: 0.55rem; grid-column: 1 / -1; letter-spacing: 0.14em; text-align: center; }

  .matchup { border-bottom: 1px solid var(--border); border-top: 1px solid var(--border); display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  .matchup div { align-items: center; border-right: 1px solid var(--border-subtle); display: grid; gap: 0.4rem; grid-template-columns: 1fr auto 1fr; padding: 0.7rem 0.8rem; }
  .matchup span { color: var(--text-muted); font-size: 0.56rem; letter-spacing: 0.1em; text-align: center; text-transform: uppercase; }
  .matchup b { color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; font-weight: 500; }
  .matchup b:last-child { text-align: right; }
  .matchup b.edge { color: var(--positive); font-weight: 700; }

  .team-table { padding: 1rem 1.1rem 0.4rem; }
  .team-caption { align-items: center; display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.5rem; }
  .team-caption strong { color: var(--text-strong); font-size: 0.85rem; }
  .team-caption span { color: var(--text-muted); font-size: 0.68rem; }
  .won-pill, .lost-pill { font-size: 0.56rem !important; font-weight: 800; letter-spacing: 0.12em; padding: 0.2rem 0.35rem; }
  .won-pill { background: var(--positive-soft); color: var(--positive) !important; }
  .lost-pill { background: var(--negative-soft); color: var(--negative) !important; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; min-width: 100%; white-space: nowrap; }
  th { border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 0.56rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.5rem 0.55rem; text-align: right; text-transform: uppercase; }
  th:first-child { text-align: left; }
  th.map-col, td.map-col { background: var(--accent-soft); }
  td { border-bottom: 1px solid var(--border-subtle); color: var(--text); font-size: 0.78rem; padding: 0.45rem 0.55rem; }
  td.num { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.76rem; text-align: right; }
  td.strong { color: var(--text-strong); font-weight: 650; }
  tr.tracked td:first-child { box-shadow: inset 2px 0 0 var(--accent); }
  tr.tracked td { background: color-mix(in srgb, var(--accent-soft) 45%, transparent); }
  .player { align-items: center; color: inherit; display: flex; gap: 0.6rem; min-width: 190px; text-decoration: none; }
  .player > span { display: grid; gap: 0.15rem; }
  .player strong { align-items: center; color: var(--text-strong); display: inline-flex; font-size: 0.8rem; gap: 0.3rem; }
  .player strong :global(svg) { color: var(--accent); }
  .player small { align-items: center; color: var(--text-muted); display: inline-flex; font-size: 0.62rem; gap: 0.35rem; }
  .player em { color: var(--accent); font-size: 0.55rem; font-style: normal; font-weight: 800; letter-spacing: 0.1em; }
  .lvl { align-items: center; border: 1px solid currentColor; border-radius: 50%; display: inline-flex; font-size: 0.55rem; font-style: normal; font-weight: 800; height: 16px; justify-content: center; width: 16px; }
  .lvl-1, .lvl-2, .lvl-3 { color: #9ca3af; }
  .lvl-4, .lvl-5, .lvl-6, .lvl-7 { color: #f5c542; }
  .lvl-8, .lvl-9 { color: #ff8a3d; }
  .lvl-10 { color: #ff4b2b; }
  .form { display: inline-flex; gap: 0.18rem; }
  .form i { align-items: center; background: var(--negative-soft); color: var(--negative); display: inline-flex; font-size: 0.52rem; font-style: normal; font-weight: 800; height: 16px; justify-content: center; width: 16px; }
  .form i.win { background: var(--positive-soft); color: var(--positive); }
  .expand { background: transparent; border: 1px solid var(--border); color: var(--text-muted); cursor: pointer; display: inline-flex; padding: 0.2rem; transition: transform 160ms ease; }
  .expand[aria-expanded='true'] { transform: rotate(180deg); }
  .expand:hover { border-color: var(--border-strong); color: var(--text-strong); }
  .detail-row td { background: var(--surface-quiet); white-space: normal; }
  .detail { display: grid; gap: 1.2rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); padding: 0.6rem 0.2rem; }
  .detail h4 { color: var(--accent); font-size: 0.58rem; letter-spacing: 0.14em; margin: 0 0 0.5rem; text-transform: uppercase; }
  .detail dl { display: grid; gap: 0.25rem 0.8rem; grid-template-columns: auto 1fr; margin: 0; }
  .detail dt { color: var(--text-muted); font-size: 0.68rem; }
  .detail dd { color: var(--text-strong); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.7rem; margin: 0; text-align: right; }
  .all-stats { grid-column: 1 / -1; }
  .stat-pairs { display: grid; gap: 0.25rem 1.4rem; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
  .stat-pairs div { border-bottom: 1px dotted var(--border); display: flex; justify-content: space-between; gap: 0.6rem; padding: 0.15rem 0; }
  .stat-pairs span { color: var(--text-muted); font-size: 0.68rem; }
  .stat-pairs b { color: var(--text-strong); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.7rem; font-weight: 500; }

  .board-foot { color: var(--text-muted); display: flex; flex-wrap: wrap; font-size: 0.64rem; gap: 0.4rem 1.2rem; padding: 0.8rem 1.1rem 1rem; }
  .board-foot span { align-items: center; display: inline-flex; gap: 0.3rem; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-left: auto; }
  .positive { color: var(--positive) !important; }
  .negative { color: var(--negative) !important; }

  @media (max-width: 720px) {
    .scorebar { grid-template-columns: 1fr 1fr; }
    .score-centre { grid-column: 1 / -1; grid-row: 1; }
    .team-head :global(.avatar) { display: none; }
    .room-link { margin-left: 0; }
    .mono { margin-left: 0; }
  }
</style>
