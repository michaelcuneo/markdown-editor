<script lang="ts">
  import SiTypescript from '@icons-pack/svelte-simple-icons/icons/SiTypescript';
  import SiSST from '@icons-pack/svelte-simple-icons/icons/SiSst';
</script>

<footer class="site-footer">
  <span>Built with love by &nbsp;<a href="https://michaelcuneo.com" target="_blank" rel="noopener">Michael Cuneo</a></span>
  <span> | </span>
  <span class="icon"><a href="https://www.typescriptlang.org/"><SiTypescript /></a></span>
  <span class="icon"><SiSST /></span>
</footer>

<style>
@media (prefers-color-scheme: dark) {
  .site-footer {
    background-color: var(--footer-bg-dark);
    color: var(--footer-text-dark);
    border-top: 1px solid var(--footer-border-dark);
  }
}
@media (prefers-color-scheme: light) {
  .site-footer {
    background-color: var(--footer-bg-light);
    color: var(--footer-text-light);
    border-top: 1px solid var(--footer-border-light);
  }
}
.site-footer {
  padding: 1rem 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  position: sticky;
  bottom: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
  background-color: color-mix(in srgb, var(--footer-bg-dark) 90%, transparent);
}
.site-footer a {
  color: inherit;
  text-decoration: underline;
}
.site-footer a:hover {
  color: var(--color-accent);
}
.icon {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
span {
  display: flex;
  align-items: center;
}
</style>