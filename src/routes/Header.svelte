<script lang="ts">
  import SiSvelte from '@icons-pack/svelte-simple-icons/icons/SiSvelte';
  import SiGithub from '@icons-pack/svelte-simple-icons/icons/SiGithub';
  import SiSlack from '@icons-pack/svelte-simple-icons/icons/SiSlack';
  import SiNpm from '@icons-pack/svelte-simple-icons/icons/SiNpm';
</script>

<header class="site-header">
  <h1 class="site-title">@michaelcuneo/markdown-editor</h1>
  <!-- link to github and slack -->
  <nav class="site-nav">
    <a href="https://github.com/michaelcuneo/markdown-editor" target="_blank" rel="noopener" class="icon-link"><SiGithub />Github</a>
    <a href="https://svelte.dev/chat" target="_blank" rel="noopener" class="icon-link"><SiSvelte />Svelte</a>
    <a href="https://join.slack.com/t/michaelcuneo/shared_invite/zt-2ewl9vs81-QWUZBWzHqkGiaN4XpqLXjg" target="_blank" rel="noopener" class="icon-link"><SiSlack />Slack</a>
    <a href="https://www.npmjs.com/package/@michaelcuneo/markdown-editor" target="_blank" rel="noopener" class="icon-link"><SiNpm />NPM</a>
  </nav>
</header>

<style>
@media (prefers-color-scheme: light) {
  .site-header {
    background-color: var(--header-bg-light);
    color: var(--header-text-light);
    border-bottom: 1px solid var(--header-border-light);
  }
}

@media (prefers-color-scheme: dark) {
  .site-header {
    background-color: var(--header-bg-dark);
    color: var(--header-text-dark);
    border-bottom: 1px solid var(--header-border-dark);
  }
}
  .site-header {
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(12px);
    background-color: color-mix(in srgb, var(--header-bg-dark) 90%, transparent);
  }
  .site-title {
    margin: 0;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
  }
  .site-nav {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }
  .site-nav a {
    margin-left: 1rem;
    text-decoration: none;
  }
  .site-nav a:hover {
    text-decoration: underline;
  }
  .icon-link {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: inherit;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.25s ease, transform 0.25s ease;
  }
  .icon-link:hover {
    color: var(--header-hover);
    transform: translateY(-1px);
  }
</style>