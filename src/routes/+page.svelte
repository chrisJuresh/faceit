<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import { navigating } from '$app/stores';
  import Avatar from '$lib/components/Avatar.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import type { SquadPlayer } from '$lib/types';
  import {
    Activity,
    ArrowUpRight,
    BarChart3,
    ChevronRight,
    ExternalLink,
    Info,
    KeyRound,
    LogOut,
    Moon,
    Pencil,
    RefreshCw,
    Search,
    Share2,
    ShieldCheck,
    Sun,
    Target,
    TrendingUp,
    Trophy,
    Users,
    X,
    Zap
  } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  type SortKey = 'swing' | 'matches' | 'winRate' | 'adr' | 'kd' | 'elo';

  let search = '';
  let sortKey: SortKey = 'swing';
  let selectedPlayerId: string | null = null;
  let detailsDialog: HTMLDialogElement;
  let ownerDialog: HTMLDialogElement;
  let theme: 'dark' | 'light' = 'dark';
  let refreshing = false;
  let shareState = '';

  $: dashboard = data.dashboard;
  $: selectedPlayer =
    dashboard?.players.find((player) => player.playerId === selectedPlayerId) || null;
  $: filteredPlayers = dashboard
    ? [...dashboard.players]
        .filter((player) =>
          `${player.displayName} ${player.nickname}`.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => {
          if (sortKey === 'matches') return b.matches - a.matches || b.swing - a.swing;
          if (sortKey === 'winRate') return b.winRate - a.winRate || b.matches - a.matches;
          if (sortKey === 'adr') return b.adr - a.adr || b.swing - a.swing;
          if (sortKey === 'kd') return b.kd - a.kd || b.swing - a.swing;
          if (sortKey === 'elo') return b.elo - a.elo || b.swing - a.swing;
          return b.swing - a.swing || b.matches - a.matches;
        })
    : [];
  $: bestPair = dashboard?.players[0] || null;
  $: mostQueued = dashboard
    ? [...dashboard.players].sort((a, b) => b.matches - a.matches)[0] || null
    : null;
  $: bestMap = dashboard
    ? [...dashboard.maps]
        .filter((map) => map.matches >= 2)
        .sort((a, b) => b.winRate - a.winRate || b.matches - a.matches)[0] || dashboard.maps[0]
    : null;

  onMount(() => {
    theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  });

  function formatSwing(value: number) {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  function formatDate(timestamp: number) {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp * 1000));
  }

  function formatCompactDate(timestamp: number) {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
      new Date(timestamp * 1000)
    );
  }

  function openPlayer(player: SquadPlayer) {
    selectedPlayerId = player.playerId;
    requestAnimationFrame(() => detailsDialog?.showModal());
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('stackline-theme', theme);
  }

  async function refresh() {
    refreshing = true;
    try {
      await invalidateAll();
    } finally {
      refreshing = false;
    }
  }

  async function shareDashboard() {
    const payload = {
      title: 'Stackline · FACEIT squad intelligence',
      text: `${dashboard?.owner.nickname}'s FACEIT squad dashboard`,
      url: window.location.href
    };

    try {
      if (navigator.share) await navigator.share(payload);
      else {
        await navigator.clipboard.writeText(window.location.href);
        shareState = 'Copied';
        window.setTimeout(() => (shareState = ''), 1800);
      }
    } catch {
      // The native share sheet can be dismissed without an error state.
    }
  }

  function changeLookback(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    goto(`/?matches=${value}`, { keepFocus: true, noScroll: true });
  }

  const unlockEnhance: SubmitFunction = () => {
    return async ({ result, update }) => {
      await update();
      if (result.type === 'success') ownerDialog?.close();
    };
  };
</script>

<svelte:head>
  <title>{dashboard ? `${dashboard.owner.nickname}'s squad` : 'FACEIT squad'} · Stackline</title>
  <meta
    name="description"
    content="Recent FACEIT squad form, teammate chemistry, impact, maps and match intelligence."
  />
</svelte:head>

<div class="page-shell" class:is-loading={$navigating !== null}>
  <header class="site-header">
    <a class="brand" href="/" aria-label="Stackline home">
      <span class="brand-mark">S/</span>
      <span>
        <strong>STACKLINE</strong>
        <small>FACEIT SQUAD INTELLIGENCE</small>
      </span>
    </a>

    <nav class="header-actions" aria-label="Dashboard actions">
      <button class="icon-button" type="button" onclick={toggleTheme} aria-label="Toggle theme">
        {#if theme === 'dark'}<Sun size={17} />{:else}<Moon size={17} />{/if}
      </button>
      <button class="text-button" type="button" onclick={shareDashboard}>
        <Share2 size={16} />
        <span>{shareState || 'Share'}</span>
      </button>
      {#if dashboard}
        <a class="profile-link" href={dashboard.owner.faceitUrl} target="_blank" rel="noreferrer">
          <Avatar src={dashboard.owner.avatar} name={dashboard.owner.nickname} size="sm" />
          <span>{dashboard.owner.nickname}</span>
          <ArrowUpRight size={14} />
        </a>
      {/if}
    </nav>
  </header>

  {#if data.apiError || !dashboard}
    <main class="error-state">
      <span class="eyebrow"><Activity size={14} /> DATA CONNECTION</span>
      <h1>FACEIT is between rounds.</h1>
      <p>{data.apiError}</p>
      <button class="primary-button" type="button" onclick={refresh}>
        <RefreshCw size={16} class={refreshing ? 'spin' : ''} /> Retry connection
      </button>
    </main>
  {:else}
    <main>
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow-row">
            <span class="eyebrow"><Zap size={14} /> LIVE SQUAD READ</span>
            <span class="data-source">{dashboard.sourceLabel}</span>
          </div>
          <h1>Your queue,<br /><em>quantified.</em></h1>
          <p>
            A clear read on who is creating impact alongside {dashboard.owner.nickname}, across the
            matches that matter right now.
          </p>
        </div>

        <aside class="owner-card" aria-label={`${dashboard.owner.nickname} profile summary`}>
          <div class="owner-topline">
            <Avatar src={dashboard.owner.avatar} name={dashboard.owner.nickname} size="lg" />
            <div>
              <span class="muted-label">TRACKING</span>
              <h2>{dashboard.owner.nickname}</h2>
              <span class="owner-country">{dashboard.owner.country || 'FACEIT'} · CS2 EUROPE</span>
            </div>
            <span class="level-badge">LVL {dashboard.owner.skillLevel}</span>
          </div>
          <div class="owner-metrics">
            <div>
              <span>ELO</span>
              <strong>{dashboard.owner.elo.toLocaleString()}</strong>
            </div>
            <div>
              <span>FORM</span>
              <strong>{dashboard.owner.winRate.toFixed(0)}%</strong>
            </div>
            <div class="form-dots" aria-label="Recent owner form">
              <span>LAST {dashboard.owner.form.length}</span>
              <div>
                {#each dashboard.owner.form as result}
                  <i class:win={result === 'W'}>{result}</i>
                {/each}
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section class="control-strip" aria-label="Dashboard filters">
        <div class="lookback-control">
          <span>LOOKBACK</span>
          <select value={dashboard.lookback} onchange={changeLookback} aria-label="Match lookback">
            {#each data.lookbacks as option}
              <option value={option}>Past {option} matches</option>
            {/each}
          </select>
        </div>
        <div class="window-copy">
          <span class="live-dot"></span>
          <strong>{dashboard.matchesAnalyzed} matches processed</strong>
          <span>·</span>
          <span>{dashboard.players.length} active {dashboard.source === 'recent-friends' ? 'friends' : 'teammates'}</span>
        </div>
        <button class="refresh-button" type="button" onclick={refresh} disabled={refreshing}>
          <RefreshCw size={15} class={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </section>

      <section class="metric-grid" aria-label="Squad summary">
        <article class="metric featured">
          <div class="metric-heading">
            <span><TrendingUp size={15} /> TOP SWING</span>
            <span class="estimated-pill" class:official={dashboard.swingSource === 'faceit'}>
              {dashboard.swingSource === 'faceit' ? 'FACEIT' : 'EST.'}
            </span>
          </div>
          <strong class:positive={bestPair && bestPair.swing >= 0} class:negative={bestPair && bestPair.swing < 0}>
            {bestPair ? formatSwing(bestPair.swing) : '—'}
          </strong>
          <p>{bestPair ? `${bestPair.displayName} leads the active squad` : 'No active squad data'}</p>
        </article>
        <article class="metric">
          <div class="metric-heading"><Trophy size={15} /><span>QUEUE WIN RATE</span></div>
          <strong>{dashboard.owner.winRate.toFixed(0)}%</strong>
          <p>{dashboard.owner.wins} wins · {dashboard.owner.losses} losses</p>
        </article>
        <article class="metric">
          <div class="metric-heading"><Users size={15} /><span>MOST QUEUED</span></div>
          <strong class="name-value">{mostQueued?.displayName || '—'}</strong>
          <p>{mostQueued ? `${mostQueued.matches} shared matches in view` : 'No shared matches'}</p>
        </article>
        <article class="metric">
          <div class="metric-heading"><Target size={15} /><span>BEST MAP</span></div>
          <strong class="name-value">{bestMap?.map || '—'}</strong>
          <p>{bestMap ? `${bestMap.winRate.toFixed(0)}% win rate · ${bestMap.matches} played` : 'No map sample'}</p>
        </article>
      </section>

      {#if dashboard.players.length > 0}
        <section class="spotlight-section">
          <div class="section-heading">
            <div>
              <span class="section-index">01</span>
              <div>
                <span class="eyebrow">CURRENT LEADERS</span>
                <h2>Impact, at a glance.</h2>
              </div>
            </div>
            <p>Team-relative performance across shared matches in the selected window.</p>
          </div>

          <div class="spotlight-grid">
            {#each dashboard.players.slice(0, 3) as player, index}
              <button class="spotlight-card" type="button" onclick={() => openPlayer(player)}>
                <div class="spotlight-rank">0{index + 1}</div>
                <div class="spotlight-person">
                  <Avatar src={player.avatar} name={player.displayName} size="lg" />
                  <div>
                    <h3>{player.displayName}</h3>
                    {#if player.alias}<span>@{player.nickname}</span>{:else}<span>LVL {player.skillLevel} · {player.elo.toLocaleString()} ELO</span>{/if}
                  </div>
                </div>
                <div class="spotlight-swing">
                  <span>SWING</span>
                  <strong class:positive={player.swing >= 0} class:negative={player.swing < 0}>
                    {formatSwing(player.swing)}
                  </strong>
                </div>
                <Sparkline values={player.trend} label={`${player.displayName} recent swing trend`} />
                <div class="spotlight-bottom">
                  <span><b>{player.winRate.toFixed(0)}%</b> win</span>
                  <span><b>{player.kd.toFixed(2)}</b> K/D</span>
                  <span><b>{player.adr.toFixed(0)}</b> ADR</span>
                  <ChevronRight size={17} />
                </div>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <section class="leaderboard-section">
        <div class="section-heading compact">
          <div>
            <span class="section-index">02</span>
            <div>
              <span class="eyebrow">FULL SQUAD</span>
              <h2>Queue leaderboard.</h2>
            </div>
          </div>
          <div class="table-tools">
            <label class="search-box">
              <Search size={16} />
              <span class="sr-only">Search players</span>
              <input bind:value={search} placeholder="Find player" />
            </label>
            <label class="sort-box">
              <span class="sr-only">Sort players</span>
              <select bind:value={sortKey}>
                <option value="swing">Sort: Swing</option>
                <option value="matches">Sort: Matches</option>
                <option value="winRate">Sort: Win rate</option>
                <option value="adr">Sort: ADR</option>
                <option value="kd">Sort: K/D</option>
                <option value="elo">Sort: ELO</option>
              </select>
            </label>
          </div>
        </div>

        {#if filteredPlayers.length}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th class="primary-column">Swing</th>
                  <th>Trend</th>
                  <th>Played</th>
                  <th>Win rate</th>
                  <th>ADR</th>
                  <th>K/D</th>
                  <th>Best map</th>
                  <th><span class="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {#each filteredPlayers as player, index}
                  <tr>
                    <td class="rank-cell">{String(index + 1).padStart(2, '0')}</td>
                    <td>
                      <button class="player-cell" type="button" onclick={() => openPlayer(player)}>
                        <Avatar src={player.avatar} name={player.displayName} />
                        <span>
                          <strong>{player.displayName}</strong>
                          <small>{player.alias ? `@${player.nickname}` : `${player.elo.toLocaleString()} ELO · LVL ${player.skillLevel}`}</small>
                        </span>
                        {#if player.verified}<ShieldCheck size={14} aria-label="Verified" />{/if}
                      </button>
                    </td>
                    <td class="primary-column">
                      <div class="swing-cell">
                        <strong class:positive={player.swing >= 0} class:negative={player.swing < 0}>{formatSwing(player.swing)}</strong>
                        <div class="swing-track" aria-hidden="true">
                          <i
                            class:negative-bar={player.swing < 0}
                            style={`width: ${Math.min(Math.abs(player.swing) / 10, 1) * 50}%; left: ${player.swing >= 0 ? 50 : 50 - Math.min(Math.abs(player.swing) / 10, 1) * 50}%`}
                          ></i>
                        </div>
                      </div>
                    </td>
                    <td><Sparkline values={player.trend} label={`${player.displayName} swing`} /></td>
                    <td><strong>{player.matches}</strong><small class="cell-note"> shared</small></td>
                    <td>
                      <strong>{player.winRate.toFixed(0)}%</strong>
                      <div class="mini-form" aria-label={`${player.displayName} form`}>
                        {#each player.currentForm as result}<i class:win={result === 'W'}></i>{/each}
                      </div>
                    </td>
                    <td>{player.adr.toFixed(0)}</td>
                    <td>{player.kd.toFixed(2)}</td>
                    <td>{player.bestMap?.map || '—'}</td>
                    <td><button class="row-action" type="button" onclick={() => openPlayer(player)} aria-label={`View ${player.displayName}`}><ChevronRight size={17} /></button></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <div class="mobile-player-list">
            {#each filteredPlayers as player, index}
              <button type="button" onclick={() => openPlayer(player)}>
                <span class="mobile-rank">{String(index + 1).padStart(2, '0')}</span>
                <Avatar src={player.avatar} name={player.displayName} />
                <span class="mobile-name"><strong>{player.displayName}</strong><small>{player.matches} matches · {player.winRate.toFixed(0)}% win</small></span>
                <strong class:positive={player.swing >= 0} class:negative={player.swing < 0}>{formatSwing(player.swing)}</strong>
                <ChevronRight size={16} />
              </button>
            {/each}
          </div>
        {:else}
          <div class="empty-filter">No players match “{search}”.</div>
        {/if}
      </section>

      <section class="intel-grid">
        <article class="map-panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">MAP INTELLIGENCE</span>
              <h2>Where the stack lands.</h2>
            </div>
            <BarChart3 size={22} />
          </div>
          <div class="map-list">
            {#each dashboard.maps.slice(0, 6) as map}
              <div class="map-row">
                <div><strong>{map.map}</strong><span>{map.matches} match{map.matches === 1 ? '' : 'es'}</span></div>
                <div class="map-bar"><i style={`width: ${map.winRate}%`}></i></div>
                <strong>{map.winRate.toFixed(0)}%</strong>
                <span>{map.ownerAdr ? `${map.ownerAdr.toFixed(0)} ADR` : '—'}</span>
              </div>
            {/each}
          </div>
        </article>

        <article class="pulse-panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">QUEUE PULSE</span>
              <h2>The useful read.</h2>
            </div>
            <Activity size={22} />
          </div>
          <div class="insight-list">
            <div>
              <span class="insight-icon positive-bg"><TrendingUp size={17} /></span>
              <p><strong>{bestPair?.displayName || 'No leader yet'}</strong><span>{bestPair ? `${formatSwing(bestPair.swing)} estimated impact leads this window.` : 'Play a shared match to begin.'}</span></p>
            </div>
            <div>
              <span class="insight-icon"><Users size={17} /></span>
              <p><strong>{mostQueued?.displayName || 'No regular yet'}</strong><span>{mostQueued ? `Your most frequent teammate across ${mostQueued.matches} selected matches.` : 'No teammate frequency data.'}</span></p>
            </div>
            <div>
              <span class="insight-icon"><Target size={17} /></span>
              <p><strong>{bestMap?.map || 'No map signal'}</strong><span>{bestMap ? `${bestMap.winRate.toFixed(0)}% win rate is the strongest map sample.` : 'More matches will reveal the map edge.'}</span></p>
            </div>
          </div>
        </article>
      </section>

      <section class="history-section">
        <div class="section-heading compact">
          <div>
            <span class="section-index">03</span>
            <div>
              <span class="eyebrow">RECENT FORM</span>
              <h2>The last {dashboard.recentMatches.length}.</h2>
            </div>
          </div>
          <p>Newest first · scores shown from {dashboard.owner.nickname}'s side</p>
        </div>

        <div class="match-strip">
          {#each dashboard.recentMatches as match}
            <a href={match.faceitUrl} target="_blank" rel="noreferrer" class:win={match.result === 'W'}>
              <span class="result-mark">{match.result}</span>
              <div><strong>{match.map}</strong><span>{formatCompactDate(match.playedAt)}</span></div>
              <b>{match.score}</b>
              <div class="match-avatars">
                {#each match.teammateIds.slice(0, 3) as playerId}
                  {@const teammate = dashboard.players.find((player) => player.playerId === playerId)}
                  {#if teammate}<Avatar src={teammate.avatar} name={teammate.displayName} size="sm" />{/if}
                {/each}
              </div>
              <ExternalLink size={14} />
            </a>
          {/each}
        </div>
      </section>

      {#if dashboard.players.length === 0}
        <section class="no-squad-state">
          <Users size={28} />
          <h2>No active friends in this window.</h2>
          <p>Increase the lookback to bring teammates back into view.</p>
        </section>
      {/if}
    </main>

    <footer>
      <div class="footer-brand"><span class="brand-mark">S/</span><span><strong>STACKLINE</strong><small>BUILT ON THE FACEIT DATA API</small></span></div>
      <div class="method-note">
        <Info size={15} />
        <p>
          FACEIT does not expose historical lobby parties or official Round Swing in its public Data
          API. The dashboard uses recent friends as the supported fallback; Swing marked “EST.” is a
          transparent team-relative estimate from ADR, K/R, K/D, assists, entries and utility.
        </p>
      </div>
      <div class="footer-actions">
        <span>Updated {formatDate(dashboard.generatedAt)}</span>
        {#if data.isOwner}
          <form method="POST" action="?/logout" use:enhance>
            <button type="submit"><LogOut size={14} /> Owner sign out</button>
          </form>
        {:else}
          <button type="button" onclick={() => ownerDialog?.showModal()}><KeyRound size={14} /> Owner access</button>
        {/if}
      </div>
    </footer>
  {/if}
</div>

<dialog class="details-dialog" bind:this={detailsDialog} onclose={() => (selectedPlayerId = null)}>
  {#if selectedPlayer}
    <div class="dialog-shell">
      <button class="dialog-close" type="button" onclick={() => detailsDialog.close()} aria-label="Close details"><X size={19} /></button>
      <div class="dialog-profile">
        <Avatar src={selectedPlayer.avatar} name={selectedPlayer.displayName} size="xl" />
        <div>
          <span class="eyebrow">PLAYER BREAKDOWN</span>
          <h2>{selectedPlayer.displayName}</h2>
          <p>{selectedPlayer.alias ? `@${selectedPlayer.nickname} · ` : ''}Level {selectedPlayer.skillLevel} · {selectedPlayer.elo.toLocaleString()} ELO</p>
        </div>
        <a href={selectedPlayer.faceitUrl} target="_blank" rel="noreferrer">FACEIT <ArrowUpRight size={14} /></a>
      </div>

      <div class="dialog-hero-stat">
        <div>
          <span>AVERAGE SWING <i>{selectedPlayer.swingSource === 'faceit' ? 'FACEIT' : 'EST.'}</i></span>
          <strong class:positive={selectedPlayer.swing >= 0} class:negative={selectedPlayer.swing < 0}>{formatSwing(selectedPlayer.swing)}</strong>
          <p>Across {selectedPlayer.statsMatches} statistically complete shared matches.</p>
        </div>
        <Sparkline values={selectedPlayer.trend} label={`${selectedPlayer.displayName} swing trend`} />
      </div>

      <div class="dialog-stat-grid">
        <div><span>WIN RATE</span><strong>{selectedPlayer.winRate.toFixed(0)}%</strong><small>{selectedPlayer.wins}W · {selectedPlayer.losses}L</small></div>
        <div><span>ADR</span><strong>{selectedPlayer.adr.toFixed(0)}</strong><small>damage / round</small></div>
        <div><span>K/D</span><strong>{selectedPlayer.kd.toFixed(2)}</strong><small>{selectedPlayer.kr.toFixed(2)} kills / round</small></div>
        <div><span>ENTRY</span><strong>{selectedPlayer.entrySuccess === null ? '—' : `${selectedPlayer.entrySuccess.toFixed(0)}%`}</strong><small>success rate</small></div>
      </div>

      <div class="dialog-section">
        <div class="dialog-section-heading"><h3>Map split</h3><span>Shared matches only</span></div>
        {#if selectedPlayer.maps.length}
          <div class="dialog-map-list">
            {#each selectedPlayer.maps as map}
              <div><strong>{map.map}</strong><span>{map.matches} played</span><b>{formatSwing(map.swing)}</b><span>{map.winRate.toFixed(0)}% W</span><span>{map.adr.toFixed(0)} ADR</span></div>
            {/each}
          </div>
        {:else}<p class="muted-copy">No complete map statistics in this window.</p>{/if}
      </div>

      <div class="dialog-section">
        <div class="dialog-section-heading"><h3>Recent together</h3><span>{selectedPlayer.matches} total in view</span></div>
        <div class="dialog-match-list">
          {#each selectedPlayer.recentMatches.slice(0, 5) as match}
            <a href={match.faceitUrl} target="_blank" rel="noreferrer">
              <i class:win={match.result === 'W'}>{match.result}</i><strong>{match.map}</strong><span>{match.score}</span><span>{match.kills}–{match.deaths}</span><b class:positive={match.swing >= 0} class:negative={match.swing < 0}>{formatSwing(match.swing)}</b>
            </a>
          {/each}
        </div>
      </div>

      {#if data.isOwner}
        <form class="alias-form" method="POST" action="?/rename" use:enhance>
          <input type="hidden" name="playerId" value={selectedPlayer.playerId} />
          <label for="alias"><Pencil size={15} /><span><strong>Private owner control</strong><small>Set a public display name. Leave blank to reset.</small></span></label>
          <div><input id="alias" name="alias" maxlength="32" value={selectedPlayer.alias || ''} placeholder={selectedPlayer.nickname} /><button type="submit">Save alias</button></div>
          {#if form?.renameError}<p class="form-error">{form.renameError}</p>{/if}
        </form>
      {/if}
    </div>
  {/if}
</dialog>

<dialog class="owner-dialog" bind:this={ownerDialog}>
  <button class="dialog-close" type="button" onclick={() => ownerDialog.close()} aria-label="Close owner access"><X size={19} /></button>
  <div class="owner-dialog-icon"><KeyRound size={22} /></div>
  <span class="eyebrow">OWNER ACCESS</span>
  <h2>Unlock alias controls.</h2>
  <p>The access key is checked on the server and never included in the public dashboard.</p>
  {#if data.ownerAccessConfigured}
    <form method="POST" action="?/unlock" use:enhance={unlockEnhance}>
      <label for="owner-token">Access key</label>
      <input id="owner-token" name="token" type="password" autocomplete="current-password" required />
      {#if form?.ownerError}<p class="form-error">{form.ownerError}</p>{/if}
      <button class="primary-button" type="submit">Unlock dashboard</button>
    </form>
  {:else}
    <p class="form-error">Owner access is not configured on this server.</p>
  {/if}
</dialog>

<style>
  :global(:root) {
    --accent: #ff5c35;
    --accent-soft: rgba(255, 92, 53, 0.12);
    --accent-border: rgba(255, 92, 53, 0.32);
    --background: #0b0b0c;
    --background-soft: #101011;
    --surface: #141415;
    --surface-raised: #1a1a1c;
    --surface-quiet: #101012;
    --border: #272729;
    --border-strong: #353537;
    --border-subtle: #202022;
    --text: #d8d5cf;
    --text-strong: #f5f2ec;
    --text-muted: #87847e;
    --positive: #7bd9a5;
    --positive-soft: rgba(123, 217, 165, 0.12);
    --negative: #ff7d76;
    --negative-soft: rgba(255, 125, 118, 0.12);
    --shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
    color-scheme: dark;
    font-family: Inter, "Segoe UI", ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-synthesis: none;
  }

  :global(:root[data-theme='light']) {
    --background: #f2f0ea;
    --background-soft: #ebe9e3;
    --surface: #faf9f5;
    --surface-raised: #ffffff;
    --surface-quiet: #f0eee8;
    --border: #d9d6cf;
    --border-strong: #c7c3ba;
    --border-subtle: #e3e0d9;
    --text: #4f4c47;
    --text-strong: #171715;
    --text-muted: #77736c;
    --positive: #16774b;
    --positive-soft: rgba(22, 119, 75, 0.1);
    --negative: #c13f38;
    --negative-soft: rgba(193, 63, 56, 0.1);
    --shadow: 0 24px 70px rgba(34, 31, 25, 0.13);
    color-scheme: light;
  }

  :global(*) { box-sizing: border-box; }
  :global(html) { background: var(--background); scroll-behavior: smooth; }
  :global(body) { background: var(--background); color: var(--text); margin: 0; min-width: 320px; }
  :global(button), :global(input), :global(select) { font: inherit; }
  :global(button), :global(a) { -webkit-tap-highlight-color: transparent; }
  :global(button:focus-visible), :global(a:focus-visible), :global(input:focus-visible), :global(select:focus-visible) { outline: 2px solid var(--accent); outline-offset: 3px; }

  .page-shell {
    background:
      radial-gradient(circle at 18% 7%, rgba(255, 92, 53, 0.07), transparent 22rem),
      linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px),
      var(--background);
    background-size: auto, 38px 38px, 38px 38px, auto;
    min-height: 100vh;
    transition: opacity 160ms ease;
  }

  .page-shell.is-loading { opacity: 0.72; }
  .site-header, main, footer { margin: 0 auto; max-width: 1440px; padding-left: clamp(1rem, 4vw, 4rem); padding-right: clamp(1rem, 4vw, 4rem); }
  .site-header { align-items: center; border-bottom: 1px solid var(--border-subtle); display: flex; height: 82px; justify-content: space-between; }
  .brand, .footer-brand { align-items: center; color: var(--text-strong); display: flex; gap: 0.7rem; text-decoration: none; }
  .brand-mark { color: var(--accent); font-size: 1.35rem; font-weight: 900; letter-spacing: -0.08em; }
  .brand > span:last-child, .footer-brand > span:last-child { display: grid; line-height: 1; }
  .brand strong, .footer-brand strong { font-size: 0.78rem; letter-spacing: 0.17em; }
  .brand small, .footer-brand small { color: var(--text-muted); font-size: 0.54rem; letter-spacing: 0.13em; margin-top: 0.28rem; }
  .header-actions { align-items: center; display: flex; gap: 0.55rem; }
  .icon-button, .text-button, .profile-link, .refresh-button { align-items: center; background: transparent; border: 1px solid var(--border); color: var(--text); cursor: pointer; display: inline-flex; height: 38px; justify-content: center; text-decoration: none; transition: 160ms ease; }
  .icon-button { border-radius: 50%; width: 38px; }
  .text-button { border-radius: 999px; gap: 0.45rem; padding: 0 0.85rem; }
  .profile-link { border: 0; gap: 0.5rem; margin-left: 0.35rem; }
  .profile-link span { color: var(--text-strong); font-size: 0.78rem; font-weight: 650; }
  .icon-button:hover, .text-button:hover, .refresh-button:hover { background: var(--surface); border-color: var(--border-strong); color: var(--text-strong); }

  main { padding-bottom: 7rem; }
  .hero { align-items: stretch; display: grid; gap: clamp(2rem, 6vw, 6rem); grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.75fr); padding-bottom: 4.5rem; padding-top: clamp(4rem, 9vw, 8.5rem); }
  .hero-copy { align-self: center; }
  .eyebrow-row { align-items: center; display: flex; flex-wrap: wrap; gap: 1rem; }
  .eyebrow { align-items: center; color: var(--accent); display: inline-flex; font-size: 0.65rem; font-style: normal; font-weight: 750; gap: 0.42rem; letter-spacing: 0.16em; }
  .data-source { border-left: 1px solid var(--border-strong); color: var(--text-muted); font-size: 0.7rem; padding-left: 1rem; }
  .hero h1 { color: var(--text-strong); font-size: clamp(3.4rem, 8.1vw, 7.8rem); font-weight: 650; letter-spacing: -0.075em; line-height: 0.82; margin: 1.5rem 0 1.8rem; max-width: 850px; }
  .hero h1 em { color: var(--accent); font-family: Georgia, 'Times New Roman', serif; font-weight: 400; }
  .hero-copy > p { color: var(--text-muted); font-size: clamp(0.95rem, 1.4vw, 1.12rem); line-height: 1.7; margin: 0; max-width: 600px; }

  .owner-card { align-self: end; background: linear-gradient(145deg, var(--surface-raised), var(--surface-quiet)); border: 1px solid var(--border); box-shadow: var(--shadow); min-height: 245px; padding: 1.45rem; position: relative; }
  .owner-card::before { background: var(--accent); content: ''; height: 2px; left: -1px; position: absolute; top: -1px; width: 34%; }
  .owner-topline { align-items: center; display: grid; gap: 0.9rem; grid-template-columns: auto 1fr auto; }
  .muted-label { color: var(--text-muted); font-size: 0.58rem; letter-spacing: 0.15em; }
  .owner-topline h2 { color: var(--text-strong); font-size: 1.12rem; letter-spacing: -0.02em; margin: 0.2rem 0; }
  .owner-country { color: var(--text-muted); font-size: 0.62rem; letter-spacing: 0.08em; }
  .level-badge { background: var(--accent); color: #fff; font-size: 0.65rem; font-weight: 800; padding: 0.38rem 0.48rem; }
  .owner-metrics { border-top: 1px solid var(--border); display: grid; gap: 1rem; grid-template-columns: 0.7fr 0.7fr 1.4fr; margin-top: 1.55rem; padding-top: 1.2rem; }
  .owner-metrics > div { display: grid; gap: 0.25rem; }
  .owner-metrics span { color: var(--text-muted); font-size: 0.58rem; letter-spacing: 0.12em; }
  .owner-metrics strong { color: var(--text-strong); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1.45rem; }
  .form-dots > div { display: flex; flex-wrap: wrap; gap: 0.28rem; }
  .form-dots i { align-items: center; background: var(--negative-soft); color: var(--negative); display: inline-flex; font-size: 0.58rem; font-style: normal; font-weight: 800; height: 21px; justify-content: center; width: 21px; }
  .form-dots i.win { background: var(--positive-soft); color: var(--positive); }

  .control-strip { align-items: center; background: var(--surface-quiet); border: 1px solid var(--border); display: flex; min-height: 62px; padding: 0.7rem 0.8rem 0.7rem 1.15rem; }
  .lookback-control { align-items: center; display: flex; gap: 0.75rem; }
  .lookback-control > span { color: var(--text-muted); font-size: 0.59rem; letter-spacing: 0.14em; }
  select, input { background: var(--surface); border: 1px solid var(--border-strong); border-radius: 0; color: var(--text-strong); min-height: 38px; padding: 0 0.75rem; }
  .lookback-control select { border: 0; font-size: 0.77rem; font-weight: 650; }
  .window-copy { align-items: center; color: var(--text-muted); display: flex; flex: 1; font-size: 0.7rem; gap: 0.55rem; justify-content: center; }
  .window-copy strong { color: var(--text); font-weight: 600; }
  .live-dot { background: var(--positive); border-radius: 50%; box-shadow: 0 0 0 4px var(--positive-soft); height: 6px; width: 6px; }
  .refresh-button { border: 0; gap: 0.45rem; padding: 0 0.65rem; }
  .refresh-button:disabled { cursor: wait; opacity: 0.55; }
  :global(.spin) { animation: spin 800ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .metric-grid { border-bottom: 1px solid var(--border); border-left: 1px solid var(--border); display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 1rem; }
  .metric { border-right: 1px solid var(--border); border-top: 1px solid var(--border); min-height: 168px; padding: 1.25rem; }
  .metric.featured { background: var(--accent-soft); }
  .metric-heading { align-items: center; color: var(--text-muted); display: flex; font-size: 0.6rem; gap: 0.45rem; letter-spacing: 0.12em; min-height: 20px; }
  .metric-heading .estimated-pill { margin-left: auto; }
  .estimated-pill { background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--accent); font-size: 0.52rem; font-style: normal; font-weight: 800; letter-spacing: 0.1em; padding: 0.25rem 0.32rem; }
  .estimated-pill.official { background: var(--positive-soft); border-color: var(--positive); color: var(--positive); }
  .metric > strong { color: var(--text-strong); display: block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: clamp(2rem, 3.5vw, 3.2rem); font-weight: 500; letter-spacing: -0.06em; margin-top: 1.1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .metric > strong.name-value { font-family: inherit; font-size: clamp(1.35rem, 2.4vw, 2.15rem); font-weight: 650; }
  .metric p { color: var(--text-muted); font-size: 0.72rem; margin: 0.45rem 0 0; }
  .positive { color: var(--positive) !important; }
  .negative { color: var(--negative) !important; }

  .spotlight-section, .leaderboard-section, .history-section { padding-top: 7rem; }
  .section-heading { align-items: end; display: flex; justify-content: space-between; margin-bottom: 2rem; }
  .section-heading > div:first-child { align-items: flex-start; display: flex; gap: 1.1rem; }
  .section-index { border-top: 1px solid var(--accent); color: var(--accent); font-family: ui-monospace, monospace; font-size: 0.62rem; padding-top: 0.4rem; width: 28px; }
  .section-heading h2, .panel-heading h2 { color: var(--text-strong); font-size: clamp(1.6rem, 3vw, 2.65rem); font-weight: 600; letter-spacing: -0.055em; margin: 0.35rem 0 0; }
  .section-heading > p { color: var(--text-muted); font-size: 0.72rem; line-height: 1.6; margin: 0; max-width: 390px; text-align: right; }
  .spotlight-grid { display: grid; gap: 1rem; grid-template-columns: repeat(3, 1fr); }
  .spotlight-card { background: var(--surface); border: 1px solid var(--border); color: var(--text); cursor: pointer; display: grid; min-width: 0; padding: 1.3rem; position: relative; text-align: left; transition: transform 180ms ease, border-color 180ms ease, background 180ms ease; }
  .spotlight-card:hover { background: var(--surface-raised); border-color: var(--border-strong); transform: translateY(-3px); }
  .spotlight-rank { color: var(--border-strong); font-family: ui-monospace, monospace; font-size: 2.6rem; font-weight: 600; position: absolute; right: 1rem; top: 0.55rem; }
  .spotlight-person { align-items: center; display: flex; gap: 0.8rem; min-width: 0; position: relative; z-index: 1; }
  .spotlight-person > div { min-width: 0; }
  .spotlight-person h3 { color: var(--text-strong); font-size: 1rem; margin: 0 0 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .spotlight-person span { color: var(--text-muted); font-size: 0.65rem; }
  .spotlight-swing { align-items: baseline; display: flex; gap: 0.8rem; margin-top: 2rem; }
  .spotlight-swing span { color: var(--text-muted); font-size: 0.58rem; letter-spacing: 0.14em; }
  .spotlight-swing strong { font-family: ui-monospace, monospace; font-size: 2.45rem; font-weight: 500; letter-spacing: -0.07em; }
  .spotlight-card :global(svg[role='img']) { margin: 0.3rem 0 1.2rem; width: 100%; }
  .spotlight-bottom { align-items: center; border-top: 1px solid var(--border); display: grid; font-size: 0.67rem; gap: 0.6rem; grid-template-columns: 1fr 1fr 1fr auto; padding-top: 0.9rem; }
  .spotlight-bottom span { color: var(--text-muted); }
  .spotlight-bottom b { color: var(--text-strong); display: block; font-family: ui-monospace, monospace; font-size: 0.8rem; margin-bottom: 0.15rem; }

  .section-heading.compact { align-items: center; }
  .table-tools { align-items: center; display: flex; gap: 0.55rem; }
  .search-box { align-items: center; background: var(--surface); border: 1px solid var(--border); display: flex; gap: 0.4rem; padding-left: 0.7rem; }
  .search-box input { background: transparent; border: 0; font-size: 0.72rem; min-height: 38px; width: 140px; }
  .search-box input:focus { outline: 0; }
  .sort-box select { font-size: 0.7rem; }
  .table-wrap { border: 1px solid var(--border); overflow-x: auto; }
  table { border-collapse: collapse; min-width: 1080px; width: 100%; }
  th { background: var(--surface-quiet); color: var(--text-muted); font-size: 0.57rem; font-weight: 650; letter-spacing: 0.12em; padding: 0.85rem 0.9rem; text-align: left; text-transform: uppercase; }
  th.primary-column { color: var(--accent); }
  td { border-top: 1px solid var(--border-subtle); color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; padding: 0.85rem 0.9rem; }
  tbody tr { background: transparent; transition: background 140ms ease; }
  tbody tr:hover { background: var(--surface-quiet); }
  .rank-cell { color: var(--text-muted); font-size: 0.66rem; width: 44px; }
  .player-cell { align-items: center; background: transparent; border: 0; color: var(--text); cursor: pointer; display: flex; font-family: inherit; gap: 0.7rem; min-width: 215px; padding: 0; text-align: left; }
  .player-cell > span { display: grid; gap: 0.22rem; min-width: 0; }
  .player-cell strong { color: var(--text-strong); font-family: Inter, sans-serif; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .player-cell small, .cell-note { color: var(--text-muted); font-size: 0.6rem; }
  .player-cell > :global(svg) { color: var(--accent); }
  .swing-cell { min-width: 105px; }
  .swing-cell > strong { font-size: 0.88rem; }
  .swing-track { background: var(--border-subtle); height: 2px; margin-top: 0.5rem; position: relative; width: 92px; }
  .swing-track::after { background: var(--border-strong); content: ''; height: 6px; left: 50%; position: absolute; top: -2px; width: 1px; }
  .swing-track i { background: var(--positive); height: 2px; position: absolute; top: 0; }
  .swing-track i.negative-bar { background: var(--negative); }
  .mini-form { display: flex; gap: 3px; margin-top: 0.4rem; }
  .mini-form i { background: var(--negative); border-radius: 50%; height: 4px; opacity: 0.75; width: 4px; }
  .mini-form i.win { background: var(--positive); }
  .row-action { align-items: center; background: transparent; border: 0; color: var(--text-muted); cursor: pointer; display: inline-flex; padding: 0.4rem; }
  .row-action:hover { color: var(--accent); }
  .mobile-player-list { display: none; }
  .empty-filter, .no-squad-state { border: 1px solid var(--border); color: var(--text-muted); padding: 3rem; text-align: center; }

  .intel-grid { display: grid; gap: 1rem; grid-template-columns: 1.2fr 0.8fr; padding-top: 7rem; }
  .map-panel, .pulse-panel { background: var(--surface); border: 1px solid var(--border); padding: clamp(1.2rem, 3vw, 2rem); }
  .panel-heading { align-items: flex-start; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; padding-bottom: 1.4rem; }
  .panel-heading :global(svg) { color: var(--accent); }
  .panel-heading h2 { font-size: 1.7rem; }
  .map-list { display: grid; }
  .map-row { align-items: center; border-bottom: 1px solid var(--border-subtle); display: grid; gap: 1rem; grid-template-columns: minmax(100px, 0.7fr) minmax(120px, 1.5fr) 50px 60px; padding: 0.9rem 0; }
  .map-row > div:first-child { display: grid; gap: 0.2rem; }
  .map-row strong { color: var(--text-strong); font-size: 0.78rem; }
  .map-row span { color: var(--text-muted); font-size: 0.62rem; }
  .map-bar { background: var(--border-subtle); height: 4px; }
  .map-bar i { background: var(--accent); display: block; height: 100%; }
  .insight-list { display: grid; }
  .insight-list > div { align-items: center; border-bottom: 1px solid var(--border-subtle); display: grid; gap: 0.9rem; grid-template-columns: auto 1fr; padding: 1rem 0; }
  .insight-icon { align-items: center; background: var(--accent-soft); color: var(--accent); display: inline-flex; height: 36px; justify-content: center; width: 36px; }
  .insight-icon.positive-bg { background: var(--positive-soft); color: var(--positive); }
  .insight-list p { display: grid; gap: 0.3rem; margin: 0; }
  .insight-list strong { color: var(--text-strong); font-size: 0.8rem; }
  .insight-list p span { color: var(--text-muted); font-size: 0.68rem; line-height: 1.45; }

  .match-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .match-strip > a { background: var(--surface); border: 1px solid var(--border); border-left-width: 3px; color: var(--text); display: grid; gap: 0.75rem; margin: 0 -1px -1px 0; min-height: 158px; padding: 0.85rem; position: relative; text-decoration: none; transition: background 150ms ease, transform 150ms ease; }
  .match-strip > a:hover { background: var(--surface-raised); transform: translateY(-2px); z-index: 1; }
  .match-strip > a { border-left-color: var(--negative); }
  .match-strip > a.win { border-left-color: var(--positive); }
  .result-mark { color: var(--negative); font-family: ui-monospace, monospace; font-size: 0.62rem; font-weight: 800; }
  .match-strip > a.win .result-mark { color: var(--positive); }
  .match-strip > a > div { display: grid; gap: 0.2rem; }
  .match-strip strong, .match-strip b { color: var(--text-strong); }
  .match-strip strong { font-size: 0.75rem; }
  .match-strip span { color: var(--text-muted); font-size: 0.6rem; }
  .match-strip b { font-family: ui-monospace, monospace; font-size: 1.15rem; }
  .match-strip :global(svg:not(.avatar svg)) { color: var(--text-muted); position: absolute; right: 0.7rem; top: 0.7rem; }
  .match-avatars { display: flex !important; margin-top: auto; }
  .match-avatars > :global(*) { margin-left: -7px; }
  .match-avatars > :global(*:first-child) { margin-left: 0; }
  .no-squad-state { margin-top: 4rem; }
  .no-squad-state h2 { color: var(--text-strong); }

  footer { align-items: center; border-top: 1px solid var(--border); display: grid; gap: 2rem; grid-template-columns: 0.7fr 1.6fr 0.7fr; min-height: 150px; }
  .method-note { align-items: flex-start; color: var(--text-muted); display: flex; font-size: 0.63rem; gap: 0.55rem; line-height: 1.55; }
  .method-note p { margin: 0; }
  .footer-actions { align-items: flex-end; display: flex; flex-direction: column; gap: 0.5rem; }
  .footer-actions > span { color: var(--text-muted); font-size: 0.6rem; }
  .footer-actions button { align-items: center; background: transparent; border: 0; color: var(--text-muted); cursor: pointer; display: flex; font-size: 0.65rem; gap: 0.35rem; padding: 0; }
  .footer-actions button:hover { color: var(--text-strong); }

  dialog { background: var(--surface); border: 1px solid var(--border-strong); box-shadow: var(--shadow); color: var(--text); margin: auto; max-height: calc(100vh - 2rem); padding: 0; }
  dialog::backdrop { backdrop-filter: blur(8px); background: rgba(0, 0, 0, 0.67); }
  .details-dialog { max-width: 720px; width: calc(100% - 2rem); }
  .dialog-shell { padding: clamp(1.2rem, 4vw, 2.2rem); position: relative; }
  .dialog-close { align-items: center; background: var(--surface-quiet); border: 1px solid var(--border); color: var(--text-muted); cursor: pointer; display: inline-flex; height: 36px; justify-content: center; position: absolute; right: 1rem; top: 1rem; width: 36px; z-index: 2; }
  .dialog-profile { align-items: center; display: grid; gap: 1rem; grid-template-columns: auto 1fr auto; padding-right: 2rem; }
  .dialog-profile h2 { color: var(--text-strong); font-size: 1.7rem; letter-spacing: -0.04em; margin: 0.35rem 0 0.2rem; }
  .dialog-profile p { color: var(--text-muted); font-size: 0.68rem; margin: 0; }
  .dialog-profile > a { align-items: center; color: var(--text); display: flex; font-size: 0.65rem; gap: 0.3rem; text-decoration: none; }
  .dialog-hero-stat { align-items: center; background: var(--surface-quiet); border: 1px solid var(--border); display: grid; grid-template-columns: 1fr auto; margin-top: 1.5rem; padding: 1.2rem; }
  .dialog-hero-stat > div { display: grid; }
  .dialog-hero-stat span { color: var(--text-muted); font-size: 0.58rem; letter-spacing: 0.12em; }
  .dialog-hero-stat span i { color: var(--accent); font-style: normal; }
  .dialog-hero-stat strong { font-family: ui-monospace, monospace; font-size: 2.3rem; font-weight: 500; margin-top: 0.35rem; }
  .dialog-hero-stat p { color: var(--text-muted); font-size: 0.64rem; margin: 0.2rem 0 0; }
  .dialog-stat-grid { border-left: 1px solid var(--border); display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 1rem; }
  .dialog-stat-grid > div { border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); border-top: 1px solid var(--border); display: grid; gap: 0.25rem; padding: 0.85rem; }
  .dialog-stat-grid span { color: var(--text-muted); font-size: 0.55rem; letter-spacing: 0.1em; }
  .dialog-stat-grid strong { color: var(--text-strong); font-family: ui-monospace, monospace; font-size: 1.15rem; }
  .dialog-stat-grid small { color: var(--text-muted); font-size: 0.55rem; }
  .dialog-section { margin-top: 1.6rem; }
  .dialog-section-heading { align-items: baseline; display: flex; justify-content: space-between; margin-bottom: 0.65rem; }
  .dialog-section h3 { color: var(--text-strong); font-size: 0.9rem; margin: 0; }
  .dialog-section-heading span, .muted-copy { color: var(--text-muted); font-size: 0.6rem; }
  .dialog-map-list, .dialog-match-list { border: 1px solid var(--border); }
  .dialog-map-list > div, .dialog-match-list > a { align-items: center; border-top: 1px solid var(--border-subtle); display: grid; font-size: 0.65rem; gap: 0.6rem; grid-template-columns: 1fr 0.7fr 0.8fr 0.6fr 0.65fr; padding: 0.7rem; }
  .dialog-map-list > div:first-child, .dialog-match-list > a:first-child { border-top: 0; }
  .dialog-map-list strong, .dialog-map-list b { color: var(--text-strong); }
  .dialog-map-list span { color: var(--text-muted); }
  .dialog-match-list > a { color: var(--text); grid-template-columns: 24px 1fr 0.7fr 0.7fr 0.8fr; text-decoration: none; }
  .dialog-match-list i { color: var(--negative); font-style: normal; font-weight: 800; }
  .dialog-match-list i.win { color: var(--positive); }
  .alias-form { background: var(--accent-soft); border: 1px solid var(--accent-border); margin-top: 1.5rem; padding: 1rem; }
  .alias-form > label { align-items: center; color: var(--accent); display: flex; gap: 0.65rem; }
  .alias-form label span { display: grid; gap: 0.2rem; }
  .alias-form label strong { color: var(--text-strong); font-size: 0.7rem; }
  .alias-form label small { color: var(--text-muted); font-size: 0.58rem; }
  .alias-form > div { display: grid; gap: 0.5rem; grid-template-columns: 1fr auto; margin-top: 0.8rem; }
  .alias-form input { min-width: 0; }
  .alias-form button, .primary-button { align-items: center; background: var(--accent); border: 1px solid var(--accent); color: #fff; cursor: pointer; display: inline-flex; font-size: 0.7rem; font-weight: 700; gap: 0.45rem; justify-content: center; min-height: 40px; padding: 0 1rem; }
  .form-error { color: var(--negative) !important; font-size: 0.68rem !important; }

  .owner-dialog { padding: 2rem; position: relative; width: min(420px, calc(100% - 2rem)); }
  .owner-dialog-icon { align-items: center; background: var(--accent-soft); color: var(--accent); display: flex; height: 48px; justify-content: center; margin-bottom: 1.2rem; width: 48px; }
  .owner-dialog h2 { color: var(--text-strong); font-size: 1.8rem; letter-spacing: -0.05em; margin: 0.45rem 0; }
  .owner-dialog > p { color: var(--text-muted); font-size: 0.72rem; line-height: 1.6; }
  .owner-dialog form { display: grid; gap: 0.6rem; margin-top: 1.2rem; }
  .owner-dialog label { color: var(--text-muted); font-size: 0.62rem; }
  .owner-dialog input { width: 100%; }

  .error-state { display: grid; min-height: calc(100vh - 82px); place-content: center; text-align: center; }
  .error-state h1 { color: var(--text-strong); font-size: clamp(2.5rem, 7vw, 5rem); letter-spacing: -0.07em; margin: 1rem 0 0.5rem; }
  .error-state p { color: var(--text-muted); }
  .error-state .primary-button { margin: 1.5rem auto 0; }
  .sr-only { height: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; width: 1px; clip: rect(0, 0, 0, 0); white-space: nowrap; }

  @media (max-width: 1100px) {
    .hero { gap: 2rem; grid-template-columns: 1fr 390px; }
    .hero h1 { font-size: clamp(3.3rem, 8vw, 5.7rem); }
    .metric-grid { grid-template-columns: repeat(2, 1fr); }
    .spotlight-grid { grid-template-columns: 1fr 1fr; }
    .spotlight-card:nth-child(3) { display: none; }
    .match-strip { grid-template-columns: repeat(3, 1fr); }
    footer { grid-template-columns: 1fr 2fr; padding-bottom: 2rem; padding-top: 2rem; }
    .footer-actions { align-items: flex-start; grid-column: 2; }
  }

  @media (max-width: 800px) {
    .site-header { height: 70px; }
    .text-button span, .profile-link > span, .profile-link > :global(svg:last-child) { display: none; }
    .hero { grid-template-columns: 1fr; padding-bottom: 2.5rem; padding-top: 4.5rem; }
    .hero h1 { font-size: clamp(3.5rem, 16vw, 6rem); }
    .owner-card { align-self: stretch; }
    .control-strip { align-items: stretch; flex-wrap: wrap; gap: 0.75rem; }
    .window-copy { justify-content: flex-start; order: 3; width: 100%; }
    .refresh-button { margin-left: auto; }
    .spotlight-section, .leaderboard-section, .history-section, .intel-grid { padding-top: 5rem; }
    .section-heading { align-items: flex-start; flex-direction: column; gap: 1rem; }
    .section-heading > p { text-align: left; }
    .section-heading.compact { align-items: stretch; }
    .table-tools { width: 100%; }
    .search-box { flex: 1; }
    .search-box input { width: 100%; }
    .table-wrap { display: none; }
    .mobile-player-list { border: 1px solid var(--border); display: grid; }
    .mobile-player-list > button { align-items: center; background: var(--surface); border: 0; border-top: 1px solid var(--border-subtle); color: var(--text); cursor: pointer; display: grid; gap: 0.6rem; grid-template-columns: 28px auto 1fr auto auto; min-width: 0; padding: 0.85rem; text-align: left; }
    .mobile-player-list > button:first-child { border-top: 0; }
    .mobile-rank { color: var(--text-muted); font-family: ui-monospace, monospace; font-size: 0.62rem; }
    .mobile-name { display: grid; gap: 0.2rem; min-width: 0; }
    .mobile-name strong { color: var(--text-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mobile-name small { color: var(--text-muted); font-size: 0.58rem; }
    .mobile-player-list > button > strong { font-family: ui-monospace, monospace; font-size: 0.72rem; }
    .intel-grid { grid-template-columns: 1fr; }
    .match-strip { grid-template-columns: repeat(2, 1fr); }
    footer { grid-template-columns: 1fr; }
    .footer-actions { grid-column: auto; }
  }

  @media (max-width: 560px) {
    .brand small, .footer-brand small { display: none; }
    .header-actions { gap: 0.3rem; }
    .text-button { border-radius: 50%; padding: 0; width: 38px; }
    .hero h1 { font-size: clamp(3.2rem, 18vw, 5rem); }
    .data-source { border: 0; padding: 0; width: 100%; }
    .owner-card { padding: 1rem; }
    .owner-topline { grid-template-columns: auto 1fr; }
    .level-badge { grid-column: 1 / -1; justify-self: start; }
    .owner-metrics { gap: 0.5rem; grid-template-columns: 1fr 1fr; }
    .form-dots { grid-column: 1 / -1; }
    .metric-grid { grid-template-columns: 1fr; }
    .metric { min-height: 140px; }
    .spotlight-grid { grid-template-columns: 1fr; }
    .spotlight-card:nth-child(2) { display: none; }
    .table-tools { align-items: stretch; flex-direction: column; }
    .sort-box select { width: 100%; }
    .map-row { gap: 0.6rem; grid-template-columns: 90px 1fr 42px; }
    .map-row > span:last-child { display: none; }
    .match-strip { grid-template-columns: 1fr; }
    .match-strip > a { min-height: 130px; }
    .dialog-profile { grid-template-columns: auto 1fr; padding-right: 1.6rem; }
    .dialog-profile > a { grid-column: 1 / -1; }
    .dialog-stat-grid { grid-template-columns: repeat(2, 1fr); }
    .dialog-hero-stat { grid-template-columns: 1fr; }
    .dialog-hero-stat > :global(svg) { margin-top: 1rem; width: 100%; }
    .dialog-map-list > div { grid-template-columns: 1fr 0.7fr 0.7fr; }
    .dialog-map-list > div span:last-child, .dialog-map-list > div span:nth-last-child(2) { display: none; }
    .dialog-match-list > a { grid-template-columns: 22px 1fr 0.7fr 0.8fr; }
    .dialog-match-list > a span:nth-of-type(2) { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(html) { scroll-behavior: auto; }
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
</style>
