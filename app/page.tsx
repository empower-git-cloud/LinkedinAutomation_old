import { SignalLayerApp } from "./signal-layer-app";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return <SignalLayerApp user={user ? { name: user.displayName, email: user.email } : null} />;
}
