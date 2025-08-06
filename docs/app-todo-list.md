# ChooChoo Implementation Checklist

## Main Flow

once the current holder has come to the mini-app to send a cast that they're the current holder, they can either choose to manually send the train or leave it up to chance, implement the workflow, ensuring that all of these flags are set properly so we can keep track of the state of the app and where in the journey we are:

- [ ] add a button for the `send-train` endpoint for the `current-holder` if they're connected, and they've casted (which would mean that the `current-cast-hash` is set in Redis)
- [ ] use the `/app/src/components/base/Switch.tsx` component that I have already on the home page, it should let the `current-holder` toggle between manual send, or leaving the next passenger up to chance
- [ ] if the `current-holder` toggles leave it to chance, set a `useRandomWinner` key in Redis to `true`, otherwise, `false`. also add a `winnerSelectionStart` key with a timestamp set 30 min in the future, a `isPublicSendEnabled : false` kv pair in Redis, and a `send-train` button in the frontend that everyone in the app can see (but starts as disabled)
- [ ] after the `winnerSelectionStart` timestamp is up, set `isPublicSendEnabled : true` in Redis, and enable the public `send-train` button

that should cover the logic for switching between the two ways people can send a cast, this whole section for picking the next winner should go just below the "current stop" section of the home page, and above the "previous stops"

- [ ] make a new choochoo cast text key in `constants.ts` for `PUBLIC_SEND_OPEN` that says "anyone can now go to the mini-app and pick a random user to receive" and cast it out from the ChooChoo account as soon as `isPublicSendEnabled` gets set to true (see @send-cast endpoint)

- [ ] make sure existing endpoints (`send-train`, `yoink`, `admin-send-train`, `user-send-train`) update these new flags to their defaults before the user originally begins this flow to preserve the flow for future users

- [ ] add a widget that uses the `NeynarCastCard` to display the `current-cast-hash` as a visible cast inside the app just above the pick random winner button, if the `useRandomWinner` flag is set to true, this should be visible to all users regardless of whether or not they're the current user, and link to the cast hash in Farcaster: farcaster/xyz/<cashhash>

## fixes

- [x] the journey timeline items are showing as negative numbers, something is up with the calculation, should determine the held time when the data is moved from current to previous holder, and then append it to redis so it doesn't have to be calculated on the fly

## home pages

- [ ] update the FAQ questions and text
- [ ] update the description on the homepage
- [ ] get final design notes from yon et al.

## other

- [x] update the FID input on the home page for the current user to a username selection input (see Neynar docs for how to)
- [x] create a `UsernameInput` component that can be reused on the home page and on the admin page where FID is now being used

- [ ] have the choochoo account send out a cast when the initial holder is set saying that the journey has begun

- [ ] add a "isAppPaused" flag to redis that replaces the home screen with a construction page so we can fix things on the fly, this flag will be managed through the AdminPage , adding a toggle switch component to the bottom of the page with a light red background to indicate it's not something to be taken lightly
