import { SignalLayerApp } from "./signal-layer-app";
import { LoginScreen } from "./login-screen";
import { getChatGPTUser } from "./chatgpt-auth";
import { getSessionEmail } from "../lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Prefer our own email session; fall back to the hosting platform's identity header.
  const sessionEmail = await getSessionEmail();
  const chatGPTUser = sessionEmail ? null : await getChatGPTUser();
  const email = sessionEmail ?? chatGPTUser?.email ?? null;
  if (!email) return <LoginScreen />;
  const name = chatGPTUser?.displayName ?? email.split("@")[0];
  return <SignalLayerApp user={{ name, email }} />;
}
