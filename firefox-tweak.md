## Firefox Tweak for Long Chat Performance

For users experiencing lag, high CPU usage, or slow scrolling in very long chats, there is a **hidden Firefox parameter** that can dramatically improve responsiveness:

**Preference:** `dom.timeout.background_throttling_max_budget`  
**Default:** `50` (ms)  
**Recommended:** `1000` (ms)  

### What it does

This setting controls how much "budget" in milliseconds Firefox allows for background throttled timers (like `setTimeout`/`setInterval`) before throttling them. Essentially, it defines how aggressively Firefox batches timer-driven tasks when a tab is active or partially backgrounded.

Increasing this value means:

- **Longer scheduling intervals:** Firefox processes timers in larger batches instead of tiny bursts.  
- **Reduced CPU spikes:** Instead of executing thousands of micro-updates in rapid succession, tasks are spread out, reducing thread contention and avoiding cache thrashing.  
- **Smoother DOM updates:** With fewer interruptions, layout, style recalculations, and painting occur more predictably, improving scroll and rendering performance in DOM-heavy pages like ChatGPT Web.  
- **Lower memory overhead:** Because timers and JS tasks are handled more efficiently, the browser avoids unnecessary repeated DOM reads/writes, indirectly reducing RAM spikes.

### Why it helps ChatGPT Web

ChatGPT's web interface has a complex, highly dynamic DOM. Each message, interactive button, and streaming update triggers recalculations, repaints, and event handling. On very long chats:

- The browser can struggle with **sequential, micro-batched updates**, leading to CPU saturation on a single core.  
- Layout and paint operations become **serialized**, making scrolling, typing, and UI interaction laggy.  
- Detached or collapsed messages help, but the underlying JS and timer scheduling can still create bottlenecks.

By increasing `dom.timeout.background_throttling_max_budget`, you give the browser **more time to batch and schedule tasks efficiently**, which complements scripts that collapse, freeze, or degrade visual elements. The result is:

- Reduced per-message CPU spikes  
- More consistent scroll performance  
- Overall smoother user experience on extremely long conversations

### How to apply

1. Open a new tab in Firefox.  
2. Navigate to `about:config` and accept the risk warning.  
3. Search for `dom.timeout.background_throttling_max_budget`.  
4. Change its value from `50` to `1000`.  
5. Restart Firefox for changes to fully apply.

**Note:** This tweak is safe for typical usage but may affect other background timers across all tabs. Start with `1000` and adjust if you notice unexpected behavior.
