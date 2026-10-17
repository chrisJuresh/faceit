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
    <span>Open a player to rename them</span>
    <button class="text-button" type="submit">Done editing names</button>
  </form>
{:else if configured}
  <button class="text-button" type="button" onclick={() => dialog?.showModal()}>Edit names</button>
  <dialog bind:this={dialog} aria-labelledby="owner-title">
    <form method="POST" action="?/unlock" use:enhance={unlock}>
      <h2 id="owner-title">Edit display names</h2>
      <label class="field-label" for="owner-token">Access key</label>
      <input id="owner-token" class="input" name="token" type="password" autocomplete="current-password" required />
      {#if error}<p class="error">{error}</p>{/if}
      <div class="actions">
        <button type="button" class="text-button" onclick={() => dialog?.close()}>Cancel</button>
        <button type="submit" class="text-button primary">Unlock</button>
      </div>
    </form>
  </dialog>
{/if}

<style>
  form {
    align-items: baseline;
    display: flex;
    gap: 12px;
  }

  dialog {
    background: var(--page);
    border: 1px solid var(--rule-2);
    border-radius: 2px;
    color: var(--ink);
    max-width: calc(100vw - 32px);
    padding: 18px 20px;
    width: 340px;
  }

  dialog::backdrop {
    background: color-mix(in srgb, var(--page) 70%, transparent);
  }

  dialog form {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  h2 {
    font: 600 15px/22px var(--sans);
    margin-bottom: 6px;
  }

  .actions {
    align-items: baseline;
    display: flex;
    gap: 16px;
    justify-content: flex-end;
    margin-top: 10px;
  }

  /* The dialog's main action: the same text button, in full ink. */
  .primary {
    color: var(--ink);
  }
</style>
