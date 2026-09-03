import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_SETTINGS, getSettings, settingsItem, type Settings } from '@/lib/settings';

const TOGGLES: { key: keyof Settings; title: string; description: string }[] = [
  {
    key: 'darkMessages',
    title: 'Dark messages',
    description: 'Darken the opened-message reading pane.',
  },
  {
    key: 'showToggle',
    title: 'In-page toggle',
    description: "Show the sun/moon button in Gmail's toolbar.",
  },
];

function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then((value) => {
      setSettings(value);
      setLoaded(true);
    });
  }, []);

  const toggle = (key: keyof Settings, checked: boolean) => {
    const next = { ...settings, [key]: checked };
    setSettings(next);
    settingsItem.setValue(next);
  };

  return (
    <main className="flex flex-col">
      <header className="flex flex-col gap-1 px-4 py-3">
        <h1 className="font-semibold text-base leading-none">Gmail Shade</h1>
        <p className="text-muted-foreground text-xs">
          Darkens the message Gmail leaves white.
        </p>
      </header>
      <Separator />
      <div className="flex flex-col px-4">
        {TOGGLES.map(({ key, title, description }, index) => (
          <div key={key}>
            {index > 0 && <Separator />}
            <Label className="w-full items-start justify-between gap-3 py-3 text-sm/4">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span>{title}</span>
                <span className="font-normal text-muted-foreground text-xs">{description}</span>
              </span>
              <Switch
                checked={settings[key]}
                disabled={!loaded}
                onCheckedChange={(checked) => toggle(key, checked)}
              />
            </Label>
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
