# ChooChoo Train: Frontend Design & Component Specification

---

## 1. Design Philosophy & Core Principles

**Theme:** Playful, Nostalgic, and Digital. We are building a "social experiment" that should feel like a game. The aesthetic marries the charm of 8-bit video games and retro train ticket stubs with the clean, modern context of a Farcaster mini-app.

**Library:** `retroUi`

**Core Principles:**

-   **Clarity Over Clutter:** The mobile view is small. Every element must have a clear purpose. We will use cards and dividers to create a clean, scannable hierarchy.
-   **Status-Driven UI:** The user's experience is entirely dependent on their relationship with the train. The UI must instantly communicate their status: Are they the current holder? A past passenger? Or a new observer?
-   **Delightful Feedback:** Actions, loading states, and transitions should be accompanied by subtle, on-theme animations and sounds. The train should feel alive.

---

## 2. Visual Language

### Color Palette

Inspired by classic train tickets and early video games.

-   **Primary Background:** `#FDF6E3` (A warm, off-white, like aged paper)
-   **Card Background:** `#FFFFFF` (Clean white for primary content cards)
-   **Primary Accent (for buttons, links):** `#D9534F` (A retro, slightly muted red)
-   **Secondary Accent (for highlights, borders):** `#5BC0DE` (A cool, calming blue)
-   **Text (Headings):** `#333333` (Dark charcoal, not pure black)
-   **Text (Body):** `#555555` (Slightly lighter gray for readability)
-   **Disabled State:** `#DDDDDD` (Light gray for disabled buttons/text)

### Typography

-   **Headings:** A pixel or block-style font. `"Press Start 2P"` or `"Silkscreen"` from Google Fonts would be perfect.
-   **Body/UI Text:** A clean, readable sans-serif. `"IBM Plex Mono"` or `"Roboto Mono"` would provide a slightly technical, monospaced feel that complements the retro theme.

---

## 3. Layout & Views

The app will be a single, scrollable view that dynamically renders components based on user status.

1.  **Header:** Displays the app title and logo.
2.  **NFT Display:** A prominent section showcasing the ChooChoo Train NFT itself.
3.  **Status & Action Section:** The dynamic core of the app. This section changes completely based on the user's status.
4.  **Journey History:** A timeline of the train's most recent stops.
5.  **Footer:** Links to the contract, art credits, etc.

---

## 4. High-Level Component Breakdown

These are the main components to be built by composing elements from `components/base`.

### `Header.tsx`

-   **Appearance:** A simple, clean bar at the top.
-   **Contents:** The ChooChoo Train logo (a pixelated train icon) and the title "ChooChoo Train" in the heading font.

### `NFTDisplay.tsx`

-   **Appearance:** A large, eye-catching card that takes up the full width of the screen.
-   **Contents:** The NFT image. Below the image, display `ChooChoo Train #0`.
-   **Animation (Optional):** The train image could have a subtle idle animation, like puffing smoke or gently rocking on the tracks.

### `StatusCard.tsx`

-   **Appearance:** A bordered card that clearly explains the user's current situation.
-   **States:**
    -   **Current Holder View:** "You are the current passenger! It's your turn to decide the next stop."
    -   **Previous Passenger View:** "You have a ticket! ChooChoo is now at [Current Holder's Address/ENS]."
    -   **New User View:** "Welcome to ChooChoo Train! A social experiment on rails. Reply to the latest cast to get a chance to be the next passenger."
    -   **Winner View:** "Congratulations! You've been selected as the next passenger. The train is on its way to you."

### `ActionPanel.tsx`

-   **Appearance:** A dedicated section below the `StatusCard` for the primary user action.
-   **States:**
    -   **Current Holder:** A large, primary `Button` that says "Send the Train!".
    -   **Previous Passenger (Train Stuck):** A secondary `Button` that says "Yoink the Train!". This button should only appear after the yoink period is active and should have a `Tooltip` explaining the rules.
    -   **Loading State:** When the "Send Train" button is clicked, it should become disabled, and a `Spinner` should appear with the text "Finding the next station..."
    -   **All Other Users:** This panel is hidden.

### `JourneyTimeline.tsx`

-   **Appearance:** A vertical list of `JourneyTimelineItem` components.
-   **Contents:** Displays the last 3-5 stops. Each item shows the ticket NFT (`#1`, `#2`, etc.) and the passenger who received it.

### `JourneyTimelineItem.tsx`

-   **Appearance:** A horizontal row within the timeline.
-   **Contents:**
    -   Left: A small `Avatar` of the passenger.
    -   Center: The passenger's username and truncated address.
    -   Right: The ticket number they received (e.g., "Ticket #42").

---

## 5. Base Component Library (`components/base`)

This is the required set of atomic components needed from the `retroUi` library to build the UI described above. Each should be simple, un-opinionated, and highly reusable.

-   [ ] **`Container.tsx`**: A `div` with standardized padding and max-width to wrap main page sections.
-   [ ] **`Card.tsx`**: A styled container with a border (pixelated style), subtle box-shadow, and border-radius. It should accept a `variant` prop (e.g., `default`, `highlighted`).
-   [ ] **`Button.tsx`**: The core action element.
    -   **Props:** `variant` (`primary`, `secondary`), `disabled`, `isLoading`.
    -   **Appearance:** Pixelated borders, solid background color. Should have clear `:hover` and `:active` states.
    -   When `isLoading` is true, it should show a `Spinner` inside.
-   [ ] **`Typography.tsx`**: A single component to handle all text rendering.
    -   **Props:** `variant` (`h1`, `h2`, `body`, `caption`), `as` (to render as `h1`, `p`, `span`, etc.).
    -   This ensures font consistency.
-   [ ] **`Avatar.tsx`**: Renders a user's profile picture.
    -   **Props:** `src`, `size` (`sm`, `md`, `lg`).
    -   **Appearance:** Should have a pixelated border or be rendered in a circle/square with a border.
-   [ ] **`Spinner.tsx`**: A simple loading indicator.
    -   **Appearance:** Could be a classic spinning circle or a custom 8-bit animation (e.g., spinning train wheel).
-   [ ] **`Icon.tsx`**: For rendering small SVG icons (e.g., the train logo in the header).
-   [ ] **`Divider.tsx`**: A horizontal line to separate content sections. Should have a pixelated or dashed style.
-   [ ] **`Tooltip.tsx`**: A small popover that appears on hover to provide extra information. Essential for the "Yoink" button.
-   [ ] **`Image.tsx`**: A wrapper for the Next.js `<Image>` component with default styling (e.g., `width: 100%`, `height: auto`).

---

## 6. Sound Design (Optional but Recommended)

-   **On Load:** A brief, cheerful train whistle.
-   **Button Click:** A satisfying "click" or "clack" sound.
-   **Train Sent (Success):** A "choo-choo!" sound effect with a success notification.
