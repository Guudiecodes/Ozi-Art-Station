import { HeroForm } from "@/components/AdminForms";
import { getSettings } from "@/lib/db";
export const dynamic = "force-dynamic";
export default function Hero() {
  const s = getSettings();
  return (<><h1 className="ah">Home page</h1><HeroForm s={{ heroTitle: s.heroTitle, heroText: s.heroText, showSwitcher: s.showSwitcher, autoSwitch: s.autoSwitch, switchSeconds: s.switchSeconds, heroCharacter: s.heroCharacter, characters: s.characters }} /></>);
}
