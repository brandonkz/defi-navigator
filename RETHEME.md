# Retheme all HTML pages to match the gold DeFi Yield brand

## Files to update
1. yields.html
2. warroom.html  
3. defi-navigator.html

## Color scheme (from css/style.css)
- Background: #080604
- Card bg: #12100a
- Card hover: #1a1610
- Border: rgba(218, 165, 32, 0.15)
- Text: #f5edd6
- Text secondary: #c4b898
- Muted: #8a7d65
- Gold: #daa520
- Gold light: #ffd700
- Gold warm: #e8b923
- Gold dark: #b8860b
- Green: #5eead4
- Red: #f87171
- Gold glow: rgba(255, 215, 0, 0.08)

## Requirements
1. Replace ALL inline CSS colors with the gold theme above
2. Dark warm backgrounds (NOT pure black #000, use #080604)
3. NO white backgrounds anywhere — all dark
4. Gold accents for links, borders, highlights, headings
5. Green for positive values, Red for negative
6. Add consistent header to each page matching this format:
```html
<header style="display:flex;align-items:center;justify-content:space-between;padding:14px 5vw;background:rgba(8,6,4,0.94);backdrop-filter:blur(20px);border-bottom:1px solid rgba(218,165,32,0.15);position:sticky;top:0;z-index:10">
  <a href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none">
    <img src="logo.webp" alt="DeFi Yield" style="height:34px;filter:drop-shadow(0 0 8px rgba(255,215,0,0.3))">
    <span style="font-size:1.15rem;font-weight:800;background:linear-gradient(160deg,#ffd700,#daa520,#b8860b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">DeFi Yield</span>
  </a>
  <nav style="display:flex;gap:24px">
    <a href="/" style="color:#8a7d65;text-decoration:none;font-size:0.88rem;font-weight:500">Dashboard</a>
    <a href="/yields.html" style="color:#8a7d65;text-decoration:none;font-size:0.88rem;font-weight:500">Yields</a>
    <a href="https://dex.defiyield.live" target="_blank" style="color:#8a7d65;text-decoration:none;font-size:0.88rem;font-weight:500">DEX</a>
    <a href="https://app.hyperliquid.xyz/join/DEFIYIELD" target="_blank" style="color:#8a7d65;text-decoration:none;font-size:0.88rem;font-weight:500">Hyperliquid</a>
    <a href="/warroom.html" style="color:#8a7d65;text-decoration:none;font-size:0.88rem;font-weight:500">War Room</a>
  </nav>
</header>
```
7. Update favicon references to favicon.webp
8. Update page titles to include "DeFi Yield" brand
9. Keep all functionality/JS intact — only change visual styling
10. Tables: dark bg, gold header text, subtle gold borders
11. Buttons: gold gradient background with dark text
12. Cards/panels: #12100a bg with rgba(218,165,32,0.15) border
13. Add subtle gold glow effect on body: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(218,165,32,0.07), transparent 60%)

Do NOT touch index.html or anything in css/ or js/ folders.
Do NOT change any JavaScript functionality.
Only update the inline CSS and HTML structure for visual consistency.
