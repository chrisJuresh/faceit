<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';

  let {
    isOwner,
    configured,
    error = null
  }: { isOwner: boolean; configured: boolean; error?: string | null } = $props();

  let dialog = $state<HTMLDialogElement>();

  const unlock: SubmitFunction = () => {
    return async ({ result, update }) => {
      await update();
      if (result.type === 'success') dialog?.close();
    };
  };
</script>

{#if isOwner}
  <form method="POST" action="?/logout" use:enhance>
    <button class="text-button" type="submit">Lock names</button>
  </form>
{:else if configured}
  <button class="text-button" type="button" onclick={() => dialog?.showModal()}>Edit names</button>
  <dialog bind:this={dialog} class="owner-dialog" aria-labelledby="owner-title">
    <form method="POST" action="?/unlock" use:enhance={unlock}>
      <h2 id="owner-title">Edit display names</h2>
      <label>
        Access key
        <input name="token" type="password" autocomplete="current-password" required />
      </label>
      {#if error}<p class="error">{error}</p>{/if}
      <div class="actions">
        <button type="button" class="text-button" onclick={() => dialog?.close()}>Cancel</button>
        <button type="submit">Unlock</button>
      </div>
    </form>
  </dialog>
{/if}
