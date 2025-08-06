# ChooChoo Implementation Checklist

once the current holder has come to the mini-app to send a cast that they're the current holder, they can either choose to manually send the train or leave it up to chance, implement the workflow, ensuring that all of these flags are set properly so we can keep track of the state of the app and where in the journey we are:

- [ ] add a button for the `send-train` endpoint for the `current-holder` if they're connected, and they've casted (which would mean that the `current-cast-hash` is set in Redis)
- [ ] add a `/app/src/components/base/Switch.tsx` that lets the `current-holder` toggle between manual send, or leaving the next passenger up to chance
- [ ] if the `current-holder` toggles leave it to chance, set a `useRandomWinner` key in Redis to `true`, otherwise, `false`. also add a `winnerSelectionStart` key with a timestamp set 30 min in the future, a `isPublicSendEnabled : false` kv pair in Redis, and a `send-train` button in the frontend that everyone in the app can see (but starts as disabled)
- [ ] after the `winnerSelectionStart` timestamp is up, set `isPublicSendEnabled : true` in Redis, and enable the public `send-train` button

this allows the current holder to choose whether or not the public can pick a winner, while simultaneously allowing time for people to begin responding to the cast before the public button is enabled, ensure that flags are cleared/set at the proper time in the flow to make the UI work properly

- [ ] make a new choochoo cast text key for `PUBLIC_SEND_OPEN` that says "anyone can now go to the mini-app and pick a random user to receive" and cast it out as soon as `isPublicSendEnabled` gets set to true

- [ ] make sure existing endpoints (`send-train`, `yoink`, `admin-send-train`, `user-send-train`) clear or set these new flags to preserve the flow for future users

- [ ] add a widget to display the `current-cast-hash` as a visible cast inside the app if the `useRandomWinner` key is set to true, this should be visible to all users regardless of whether or not they're the current user, and link to the cast hash in Farcaster: farcaster/xyz/<cashhash>

## fixes

- [x] the journey timeline items are showing as negative numbers, something is up with the calculation, should determine the held time when the data is moved from current to previous holder, and then append it to redis so it doesn't have to be calculated on the fly

## home pages

- [ ] update the FAQ questions and text
- [ ] update the description on the homepage
- [ ] get final design notes from yon et al.

## other

- [x] update the FID input on the home page for the current user to a username selection input (see Neynar docs for how to)
- [x] create a `UsernameInput` component that can be reused on the home page and on the admin page where FID is now being used
