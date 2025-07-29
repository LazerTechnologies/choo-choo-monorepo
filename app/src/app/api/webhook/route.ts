export async function POST() {
  // This app doesn't use notifications, so we just return success
  // for any webhook requests from Farcaster
  return Response.json({ success: true });
}
