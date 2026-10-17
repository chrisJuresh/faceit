<script lang="ts">
  let { data } = $props();
</script>

<p>{data.squad?.players.length ?? 'no squad'} players · {data.live?.matches.length ?? 'no live'} live</p>
