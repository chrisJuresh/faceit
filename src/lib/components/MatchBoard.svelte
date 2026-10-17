<script lang="ts">
  import { duration, score, thousands } from '$lib/format';
  import { sides, teamName } from '$lib/match-board';
  import type { LiveMatch } from '$lib/types';
  import { onMount } from 'svelte';
  import Roster from './Roster.svelte';
  import Scoreboard from './Scoreboard.svelte';

  /** Everything FACEIT publishes about one match. The map art shrinks to a thumbnail once it's over. */
  let { match }: { match: LiveMatch } = $props();

  // Wall-clock times differ between server and browser, so they appear once the page is live.
  let mounted = $state(false);
  onMount(() => (mounted = true));

  const finished = $derived(match.phase === 'finished');
  const { ours, theirs } = $derived(sides(match));
  const mapName = $derived(match.map?.name ?? (finished ? '—' : 'Map vote'));
  const image = $derived(match.map?.image ?? '');
  const odds = $derived(
    ours && theirs && ours.winProbability !== null && theirs.winProbability !== null
      ? { ours: ours.winProbability, theirs: theirs.winProbability }
      : null
  );
  const server = $derived([match.location?.name, match.region].filter(Boolean).join(' · ') || '—');

  const clockTime = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const liveFacts = $derived<Array<[string, string, boolean]>>([
    ['Queue', match.competition || '—', false],
    ['Server', server, false],
    ['Format', `BO${match.bestOf || 1} · ${match.calculateElo ? 'ELO' : 'no ELO'}`, false],
    ['Started', match.startedAt && mounted ? clockTime(match.startedAt) : '—', true]
  ]);

  /** Label, value, and whether the value is a number (set in the mono face). */
  const finishedFacts = $derived.by(() => {
    const facts: Array<[string, string, boolean]> = [
      ['Map', mapName, false],
      ['Queue', match.competition || '—', false]
    ];
    if (ours && theirs) {
      facts.push(['1st half', score(ours.firstHalf, theirs.firstHalf), true]);
      facts.push(['2nd half', score(ours.secondHalf, theirs.secondHalf), true]);
      if ((ours.overtime ?? 0) + (theirs.overtime ?? 0) > 0)
        facts.push(['Overtime', score(ours.overtime, theirs.overtime), true]);
    }
    if (match.rounds) facts.push(['Rounds', String(match.rounds), true]);
    if (match.startedAt && match.finishedAt) facts.push(['Length', duration(match.finishedAt - match.startedAt), true]);
    facts.push(['Server', server, false]);
    return facts;
  });
</script>

{#if finished}
  <div class="finished-top">
    {#if image}<img class="map-thumb" src={image} alt="" />{/if}
    <p class="score">
      {#if ours && ours.score !== null}
        <span class="res" class:win={ours.won} class:loss={!ours.won}>{ours.won ? 'W' : 'L'}</span>{score(ours.score, theirs?.score)}
      {:else}
        —
      {/if}
    </p>
    <dl class="kv facts two">
      {#each finishedFacts as [label, value, numeric] (label)}<dt>{label}</dt><dd class:mono={numeric}>{value}</dd>{/each}
    </dl>
  </div>
  <Scoreboard {match} />
{:else}
  <div class="live-top">
    {#if image}<img class="map-art" src={image} alt="" />{:else}<span class="map-art"></span>{/if}
    <div>
      <p class="map-name">{mapName}</p>
      <dl class="kv facts">
        {#each liveFacts as [label, value, numeric] (label)}<dt>{label}</dt><dd class:mono={numeric}>{value}</dd>{/each}
      </dl>
    </div>
    {#if ours && theirs}
      <div class="h2h">
        <p class="row teams"><span>{teamName(ours)}</span><span>{teamName(theirs)}</span></p>
        <p class="row odds">
          <span class="chance">{odds ? `${odds.ours}%` : '—'}</span>
          <span class="label">Win probability</span>
          <span class="chance">{odds ? `${odds.theirs}%` : '—'}</span>
        </p>
        {#if odds}
          <div class="bar" aria-hidden="true">
            <i class="us" style:width="{odds.ours}%"></i><i style:width="{odds.theirs}%"></i>
          </div>
        {/if}
        <p class="row sub">
          <span>avg ELO {thousands(ours.averageElo)}</span><span>avg ELO {thousands(theirs.averageElo)}</span>
        </p>
      </div>
    {/if}
  </div>
  <Roster {match} />
{/if}

<style>
  .live-top {
    align-items: end;
    display: grid;
    gap: 32px;
    grid-template-columns: 192px minmax(0, 1fr) minmax(0, 1.35fr);
    margin-bottom: 22px;
  }

  .map-art {
    aspect-ratio: 16 / 9;
    background: var(--cell);
    border-radius: 2px;
    display: block;
    object-fit: cover;
    width: 100%;
  }

  .map-name {
    font: 600 30px/1 var(--sans);
    letter-spacing: -0.02em;
    margin-bottom: 14px;
  }

  .facts dd {
    font-family: var(--sans);
    text-align: left;
  }

  .facts dd.mono {
    font-family: var(--mono);
  }

  .h2h .row {
    align-items: baseline;
    display: flex;
    gap: 12px;
    justify-content: space-between;
  }

  .teams span {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .odds {
    margin-top: 6px;
  }

  .chance {
    font: 500 24px/1.1 var(--mono);
    letter-spacing: -0.02em;
  }

  .label {
    color: var(--muted);
    font-size: 11.5px;
  }

  .bar {
    display: flex;
    gap: 2px;
    height: 6px;
    margin: 8px 0 6px;
  }

  .bar i {
    background: var(--faint);
    border-radius: 1px;
    display: block;
  }

  .bar i.us {
    background: var(--accent);
  }

  .sub {
    color: var(--muted);
    font: 11.5px var(--mono);
  }

  .finished-top {
    align-items: center;
    display: grid;
    gap: 28px;
    grid-template-columns: auto auto minmax(0, 1fr);
    margin-bottom: 20px;
  }

  .map-thumb {
    background: var(--cell);
    border-radius: 2px;
    height: 32px;
    object-fit: cover;
    width: 56px;
  }

  .score {
    font: 600 40px/1 var(--mono);
    letter-spacing: -0.04em;
    white-space: nowrap;
  }

  .score .res {
    font-size: 15px;
    letter-spacing: 0;
    margin-right: 10px;
    vertical-align: 12px;
  }

  .facts.two {
    gap: 3px 18px;
    grid-template-columns: repeat(2, auto minmax(0, max-content));
    justify-content: start;
  }

  .facts.two dd {
    padding-right: 14px;
  }

  @media (max-width: 860px) {
    .live-top {
      gap: 20px;
      grid-template-columns: 128px minmax(0, 1fr);
    }

    .h2h {
      grid-column: 1 / -1;
    }

    .finished-top {
      gap: 8px 20px;
      grid-template-columns: auto minmax(0, 1fr);
    }

    .finished-top .facts {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 640px) {
    .map-name {
      font-size: 24px;
    }

    .score {
      font-size: 32px;
    }

    .facts.two {
      grid-template-columns: auto minmax(0, 1fr);
    }
  }
</style>
