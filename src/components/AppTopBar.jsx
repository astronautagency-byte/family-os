import { Bell, Settings2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AppTopBar({ onOpenSettings }) {
  const { profile, user } = useAuth();
  const name = profile?.display_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Family";
  const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  return <header className="app-topbar">
    <div className="topbar-avatar">{avatar?<img src={avatar} alt={name}/>:<span>{name.slice(0,1).toUpperCase()}</span>}</div>
    <div className="topbar-wordmark"><img src="/icons/icon-192.png" alt=""/><strong>FamOS</strong></div>
    <div className="topbar-actions"><button aria-label="Notifications"><Bell/><i>3</i></button><button aria-label="Settings" onClick={onOpenSettings}><Settings2/></button></div>
  </header>;
}
