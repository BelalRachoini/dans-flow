# Polish the /confirmation Swish Return Page

Make the post-Swish landing page (`cms.dancevida.se/confirmation`) feel celebratory and on-brand, with a 2-second "verifying" stage followed by an animated success screen.

## Behavior

URL params read from `useSearchParams`: `status`, `order_id`, `amount`, `item_name`, `item_type`.

### When `status === "success"`

**Stage 1 — Verifying (2 seconds)**
- Dark olive/brown background (matching app sidebar tone)
- Centered Swish-blue spinner (`#00B9ED`, `animate-spin`)
- Title: "Verifierar din betalning..."
- Subtitle: "Vänta ett ögonblick"

After 2000 ms (`setTimeout` in `useEffect`), `isVerifying` flips to `false`.

**Stage 2 — Success**
- White card on dark background, centered, max-w-md
- Animated green checkmark (CheckCircle2, green-500) inside a soft green circle, popping in via `animate-scale-in` + `animate-fade-in`
- H1: "Betalning genomförd! 🎉"
- Subtitle: "Tack för ditt köp! Din bekräftelse har skickats till din e-post."
- Gold pill: `SEK {amount}` (primary/gold background, rounded-full, font-semibold) — only when `amount` present
- Item name line: `{item_name}` in larger semibold text — only when present
- Divider (`<Separator />` or `border-t`)
- Buttons stacked full-width:
  - Primary gold: "Visa mina biljetter" → `/biljetter`
  - Ghost/outline: "Gå till evenemang" → `/event`
- Footer micro-copy: "Dina biljetter finns under Mina Biljetter i menyn"

### When `status` missing or not `"success"`
- Same dark background, white card
- Amber `AlertTriangle` icon (amber-500)
- H1: "Något gick fel"
- Subtitle: "Om du betalat men inte fått bekräftelse, kontakta oss på info@dancevida.se"
- Button: "Gå tillbaka" → `/event`

## Technical notes

- Edit only `src/pages/Confirmation.tsx`. No routing or DB changes.
- Use existing design tokens: `bg-primary` for gold, `text-primary-foreground`, `Card`, `Button` (variant `default` for gold, `outline` for secondary).
- Dark page background: inline `bg-[hsl(40_30%_15%)]` to match the sidebar olive/brown family without adding new tokens.
- Spinner: `<Loader2 className="h-12 w-12 animate-spin" style={{ color: '#00B9ED' }} />`.
- Animations reuse existing Tailwind keyframes already in `tailwind.config.ts`: `animate-scale-in`, `animate-fade-in` on the checkmark wrapper. No new keyframes needed.
- Use `useSearchParams` from `react-router-dom` (already imported in current file) for params.
- Internal routes are `/biljetter` (tickets) and `/event` (events) — the request says `/tickets` and `/events`; we'll use the actual app routes so the buttons work. If you'd prefer the literal paths, let me know.
- No changes to the existing `getBackLink`/Link imports beyond what's needed; final file will use `useNavigate` for button clicks.

## Files touched
1. `src/pages/Confirmation.tsx` — rewrite to implement the two-stage flow above.
