import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { COLOR_PRESETS } from "@/types/builder";

interface ColorMapEditorProps {
  /** e.g. { "0": "#FF4444", "1": "#39FF14", "2": "#FFBF00" } */
  colorMap: Record<string, string>;
  onChange: (map: Record<string, string>) => void;
  /** Default color when no mapping matches */
  defaultColor?: string;
  onDefaultColorChange?: (color: string) => void;
}

export default function ColorMapEditor({ colorMap, onChange, defaultColor, onDefaultColorChange }: ColorMapEditorProps) {
  const [newValue, setNewValue] = useState("");
  const [newColor, setNewColor] = useState("#39FF14");

  const entries = Object.entries(colorMap);

  const addEntry = () => {
    if (newValue.trim() === "") return;
    onChange({ ...colorMap, [newValue.trim()]: newColor });
    setNewValue("");
  };

  const removeEntry = (key: string) => {
    const copy = { ...colorMap };
    delete copy[key];
    onChange(copy);
  };

  const updateColor = (key: string, color: string) => {
    onChange({ ...colorMap, [key]: color });
  };

  return (
    <div className="space-y-3">
      <Label className="text-[10px] text-muted-foreground">
        Mapeamento Valor → Cor
      </Label>
      <p className="text-[8px] text-muted-foreground/70">
        Defina qual cor usar para cada valor retornado pelo Zabbix. Ex: 0 = Vermelho (down), 1 = Verde (up).
      </p>

      {/* Existing entries */}
      <div className="space-y-1">
        {entries.map(([value, color]) => (
          <div key={value} className="flex items-center gap-2 group">
            <Input
              value={value}
              disabled
              className="h-6 text-[9px] font-mono w-16 flex-shrink-0"
            />
            <span className="text-[9px] text-muted-foreground">=</span>
            <div className="flex items-center gap-1 flex-1">
              <div
                className="w-5 h-5 rounded-full border border-border/50 flex-shrink-0"
                style={{ background: color }}
              />
              <Input
                type="color"
                value={color}
                onChange={(e) => updateColor(value, e.target.value)}
                className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer flex-shrink-0"
              />
              <span className="text-[8px] font-mono text-muted-foreground">{color}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeEntry(value)}
              className="h-5 w-5 opacity-0 group-hover:opacity-100 text-neon-red"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new entry */}
      <div className="flex items-center gap-1.5">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Valor (ex: 0)"
          className="h-6 text-[9px] font-mono w-20"
          onKeyDown={(e) => e.key === "Enter" && addEntry()}
        />
        <span className="text-[9px] text-muted-foreground">=</span>
        <div className="flex items-center gap-1">
          {["#FF4444", "#39FF14", "#FFBF00", "#3B82F6", "#8B5CF6"].map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              className={`w-4 h-4 rounded-full border transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ background: c }}
            />
          ))}
          <Input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={addEntry}
          disabled={!newValue.trim()}
          className="h-6 w-6 text-neon-green"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {/* Default color */}
      {onDefaultColorChange && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/20">
          <Label className="text-[9px] text-muted-foreground whitespace-nowrap">Cor padrão (sem match):</Label>
          <div
            className="w-4 h-4 rounded-full border border-border/50"
            style={{ background: defaultColor || "#A0A0A0" }}
          />
          <Input
            type="color"
            value={defaultColor || "#A0A0A0"}
            onChange={(e) => onDefaultColorChange(e.target.value)}
            className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer"
          />
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-[8px] text-muted-foreground/50 italic">
          Nenhum mapeamento definido. Adicione valores e cores acima.
        </p>
      )}
    </div>
  );
}
