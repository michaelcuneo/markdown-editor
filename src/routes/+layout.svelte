<script lang="ts">
	import type { Snippet } from "svelte";
  import Header from './Header.svelte';
  import Footer from './Footer.svelte';
  import './app.css';

  let { children }: { children: Snippet  } = $props();  
</script>

<Header />
{@render children?.()}
<Footer />