import { QUALITY_PROFILES, type QualityMode } from "../game";
import { Button, Field, Section, Segmented, Slider, Toggle } from "./kit";
import { useSettings } from "./stores";
import { ThemePicker } from "./ThemePicker";

const QUALITY_OPTIONS: { value: QualityMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  ...QUALITY_PROFILES.map((p) => ({ value: p.id, label: p.label })),
];

export function SettingsPanel() {
  const { settings, update, reset } = useSettings();

  return (
    <div className="space-y-7">
      <Section title="Graphics">
        <Field label="Quality" hint={settings.quality === "auto" ? "adapts to your frame rate" : undefined}>
          <Segmented value={settings.quality} options={QUALITY_OPTIONS} onChange={(quality) => update({ quality })} />
        </Field>
        <Field label="Field of view" hint={`${settings.fov}°`}>
          <Slider label="Field of view" value={settings.fov} min={55} max={100} step={1} onChange={(fov) => update({ fov })} />
        </Field>
      </Section>

      <Section title="Controls">
        <Field label="Camera sensitivity" hint={`${settings.lookSensitivity.toFixed(2)}×`}>
          <Slider
            label="Camera sensitivity"
            value={settings.lookSensitivity}
            min={0.2}
            max={3}
            step={0.05}
            onChange={(lookSensitivity) => update({ lookSensitivity })}
          />
        </Field>
        <Toggle checked={settings.invertY} onChange={(invertY) => update({ invertY })} label="Invert vertical camera" />
      </Section>

      <Section title="World">
        <Field label="Day length" hint={settings.dayLengthMinutes === 0 ? "frozen" : `${settings.dayLengthMinutes} min`}>
          <Slider
            label="Day length"
            value={settings.dayLengthMinutes}
            min={0}
            max={30}
            step={1}
            onChange={(dayLengthMinutes) => update({ dayLengthMinutes })}
          />
        </Field>
        <Field label="World seed">
          <div className="flex gap-2">
            <input
              type="number"
              aria-label="World seed"
              value={settings.seed}
              onChange={(event) => update({ seed: Math.trunc(Number(event.target.value)) || 0 })}
              className="w-full rounded-control border bg-canvas px-3 py-2 font-mono text-sm text-text-primary shadow-inset"
            />
            <Button onClick={() => update({ seed: Math.floor(Math.random() * 1_000_000_000) })}>Random</Button>
          </div>
        </Field>
      </Section>

      <Section title="Appearance">
        <ThemePicker />
      </Section>

      <Section title="Advanced">
        <Toggle checked={settings.showDebug} onChange={(showDebug) => update({ showDebug })} label="Show performance overlay" />
        <Button variant="ghost" onClick={reset}>
          Reset all options
        </Button>
      </Section>
    </div>
  );
}
