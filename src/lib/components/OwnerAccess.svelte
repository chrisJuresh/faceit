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
    <span class="hint">Open a player to rename them.</span>
    <button class="text-button" type="submit">Done editing names</button>
  </form>
{:else if configured}
  <button class="text-button" type="button" onclick={() => dialog?.showModal()}>Edit names</button>
  <dialog bind:this={dialog} aria-labelledby="owner-title">
    <form method="POST" action="?/unlock" use:enhance={unlock}>
      <h2 id="owner-title">Edit display names</h2>
      <label for="owner-token">Access key</label>
      <input id="owner-token" name="token" type="password" autocomplete="current-password" required />
      {#if error}<p class="error">{error}</p>{/if}
      <div class="actions">
        <button type="button" class="text-button" onclick={() => dialog?.close()}>Cancel</button>
        <button type="submit" class="primary">Unlock</button>
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

  .hint {
    color: var(--muted);
  }

  dialog {
    background: var(--page);
    border: 1px solid var(--ink);
    color: var(--ink);
    max-width: calc(100vw - 32px);
    padding: 20px 22px;
    width: 360px;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }

  dialog form {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  h2 {
    border-bottom: 2px solid var(--ink);
    font: 500 22px/1.2 var(--serif);
    margin-bottom: 8px;
    padding-bottom: 8px;
  }

  label {
    color: var(--ink-2);
    font-size: 13px;
  }

  input {
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--rule-2);
    color: var(--ink);
    font-size: 14px;
    padding: 4px 0;
  }

  input:focus {
    border-bottom-color: var(--ink);
    outline: none;
  }

  .error {
    color: var(--loss-text);
    font-size: 13px;
  }

  .actions {
    align-items: baseline;
    display: flex;
    gap: 18px;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .primary {
    background: var(--ink);
    border: 0;
    color: var(--page);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
  }
</style>
