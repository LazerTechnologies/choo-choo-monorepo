# Write Data with Managed Signers

the app is currently using Sign In With Neynar, but it's not working great for everyone. we need to:

- remove the sign-in with neynar button from the `/app/src/components/ui/Header.tsx` and create a new custom sign-in using the info below.
- refactor the `/app/src/components/ui/CastingWidget.tsx` to use the new flow instead of requiring neynar sign in for signers

Dependencies (already installed)

Environment Variables (already added)

```
NEYNAR_API_KEY=...
FARCASTER_DEVELOPER_MNEMONIC=...
```

## directory structure

I have added the below files required already, you just need to use them.

```
└── app
    ├── api
    │   ├── signer
    │   │   └── route.ts
    │   └── user-cast
    │       └── route.ts
    └── ...
└── lib
    └── neynarClient.ts
└── utils
    ├── getFid.ts
    └── getSignedKey.ts
└── .env.local
└── ...
```

We are doing a couple of things here, so let’s break it down.
We first use the createSigner to create a signer, and then we use the appAccountKey.signKeyRequest function from the @farcaster/hub-nodejs package to create a sign key request. Finally, we use the registerSignedKey function from the neynarClient to register the signedKey. registerSignedKey returns signer_approved_url that needs to be handled (more on that later)

## frontend

Now, the app is ready to serve requests. You must build the frontend to handle these requests

- calling the `api/signer` endpoint will return:

```
{
  "signer_uuid": "1234-abcd-5678-efgh",
  "public_key": "0xabcdef1234567890...",
  "status": "pending_approval",
  "signer_approval_url": "https://client.warpcast.com/deeplinks/signed-key-request?token=0xf707aebde...d049"
}
```

## fetching signers for a user

use fetchSigners api to fetch signers for the user. The Neynar Client Instantiation and API calls (fetchNonce and fetchSigners) should ideally be performed on the backend to protect your API key and maintain security.

when we send the cast, set `sponsored_by_neynar` to true as shown below:

getSignedKey.ts

```ts
const options = {
  sponsor: {
    sponsored_by_neynar: true,
  },
};

const signedKey = await neynarClient.registerSignedKey(
  createSigner.signer_uuid,
  fid,
  deadline,
  signature,
  options
);
```

signedKey will have signer_approval_url. Make it available (either by creating a QR Code for the desktop application or allowing user to deeplink into warpcast by clicking on it in mobile device).

- Convert signer_approved_url to a QR code
- If the user is using the application on desktop, then display the QR code in a popup (like how we display the `/app/src/components/ui/NFTImageModal.tsx` so it just pops up over the app and they can close it) and ask the user to scan this QR code. If the user is on mobile, ask them to click the link. This will deeplink the user into Warpcast, and they will be able to sign into the app.
