import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DASHBOARD_PRESETS, PRESET_CATEGORIES, type DashboardPreset, type PresetCategory } from "@/data/dashboardPresets";
import DynamicIcon from "./DynamicIcon";
import { LayoutTemplate, ChevronRight } from "lucide-react";

interface Props {
  onSelect: (preset: DashboardPreset) => void;
}

export default function PresetGallery({ onSelect }: Props) {
  const [activeCategory, setActiveCategory] = useState<PresetCategory | "all">("all");

  const filtered = useMemo(
    () =>
      activeCategory === "all"
        ? DASHBOARD_PRESETS
        : DASHBOARD_PRESETS.filter((p) => p.category === activeCategory),
    [activeCategory],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <LayoutTemplate className="w-4 h-4 text-neon-green" />
        <h3 className="text-[10px] font-display uppercase tracking-widest text-muted-foreground">
          Templates Prontos
        </h3>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-2 py-0.5 rounded-full text-[9px] font-display uppercase transition-colors border ${
            activeCategory === "all"
              ? "bg-neon-green/15 text-neon-green border-neon-green/30"
              : "border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
          }`}
        >
          Todos
        </button>
        {PRESET_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-2 py-0.5 rounded-full text-[9px] font-display uppercase transition-colors border flex items-center gap-1 ${
              activeCategory === cat.key
                ? "border-current"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
            }`}
            style={activeCategory === cat.key ? { color: cat.color, borderColor: `${cat.color}50` } : undefined}
          >
            <DynamicIcon name={cat.icon} className="w-2.5 h-2.5" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Preset cards */}
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {filtered.map((preset) => {
            const cat = PRESET_CATEGORIES.find((c) => c.key === preset.category);
            return (
              <motion.button
                key={preset.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(preset)}
                className="w-full text-left glass-card rounded-lg p-3 border border-border/30 hover:border-opacity-60 transition-all group cursor-pointer"
                style={{
                  borderColor: `${preset.accent}20`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `${preset.accent}15`, border: `1px solid ${preset.accent}30` }}
                  >
                    <DynamicIcon name={preset.icon} className="w-4 h-4" style={{ color: preset.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-display font-semibold text-foreground group-hover:text-neon-green transition-colors truncate">
                        {preset.name}
                      </span>
                      {cat && (
                        <span
                          className="text-[8px] px-1 py-px rounded-full font-display uppercase flex-shrink-0"
                          style={{ color: cat.color, background: `${cat.color}15`, border: `1px solid ${cat.color}25` }}
                        >
                          {cat.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-tight line-clamp-2 mt-0.5">
                      {preset.description}
                    </p>
                    <span className="text-[8px] text-muted-foreground/60 font-mono mt-0.5 block">
                      {preset.widgets.length} widgets pré-configurados
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-neon-green transition-colors flex-shrink-0" />
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
