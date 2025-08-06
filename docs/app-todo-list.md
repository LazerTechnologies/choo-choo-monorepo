# ChooChoo Implementation Checklist

- [ ] add a button for the `send-train` endpoint for the `current-holder` if they're connected
- [ ] add a widget to display the `current-cast-hash` as a cast inside the app if the connected user is not the current holder
- [ ] add a button for the `current-holder` to leave the next passenger up to chance
- [ ] if the `current-holder` leaves it up to chance, set a `useRandomWinner` key in Redis, and a `winnerSelectionStart` key with a timestamp set 30 min in the future, a `isPublicSendEnabled : false` kv pair in Redis, and a `send-train` button in the frontend that everyone in the app can see (but starts as disabled)
- [ ] after the `winnerSelectionStart` timestamp is up, set `isPublicSendEnabled : true` in Redis, and enable the public `send-train` button

this allows the current holder to choose whether or not the public can pick a winner, while simultaneously allowing time for people to begin responding to the cast before the public button is enabled

- [ ] make a new choochoo cast text key for `PUBLIC_SEND_OPEN` that says "anyone can now go to the mini-app and pick a random user to receive" and cast it out as soon as `isPublicSendEnabled` gets set to true

- [ ] make sure existing endpoints (`send-train`, `yoink`, `admin-send-train`, `user-send-train`) clear or set these new flags to preserve the flow for future users

## other

- [ ] update the FID input on the home page for the current user to a username selection input (see Neynar docs for how to)
- [ ] create a `UsernameInput` component that can be reused on the home page and on the admin page where FID is now being used
