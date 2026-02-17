import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import DynamicIcon from "@/components/builder/DynamicIcon";

interface AnimatedIconProps {
  iconName: string;
  color: string;
  size?: string;
  /** Raw numeric value for speed-based animations (e.g. fan RPM) */
  value?: number | null;
  /** Is the status critical/error? */
  isCritical?: boolean;
  /** Is the status healthy/online? */
  isHealthy?: boolean;
}

/** Detects icon "category" for conditional animations */
function getIconCategory(name: string): "fan" | "router" | "switch" | "server" | "antenna" | "link" | "generic" {
  const lower = name.toLowerCase();
  if (lower.includes("fan") || lower.includes("ventilador") || lower.includes("ventoinha") || lower.includes("cooling"))
    return "fan";
  if (lower.includes("router") || lower.includes("roteador") || lower.includes("gateway"))
    return "router";
  if (lower.includes("switch") || lower.includes("hub"))
    return "switch";
  if (lower.includes("server") || lower.includes("servidor") || lower.includes("rack") || lower.includes("dell") || lower.includes("idrac"))
    return "server";
  if (lower.includes("antenna") || lower.includes("antena") || lower.includes("olt") || lower.includes("onu") || lower.includes("radio") || lower.includes("wireless") || lower.includes("wifi") || lower.includes("signal"))
    return "antenna";
  if (lower.includes("link") || lower.includes("ethernet") || lower.includes("cable") || lower.includes("fiber") || lower.includes("fibra"))
    return "link";
  return "generic";
}

export default function AnimatedIcon({ iconName, color, size = "w-8 h-8", value, isCritical, isHealthy }: AnimatedIconProps) {
  const isIconify = iconName.includes(":");
  const category = getIconCategory(iconName);

  // --- FAN: continuous spin, speed proportional to value ---
  if (category === "fan") {
    const rpm = value && value > 0 ? Math.max(0.3, Math.min(4, value / 3000)) : 1.5;
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: rpm, repeat: Infinity, ease: "linear" }}
        style={{ color, filter: `drop-shadow(0 0 6px ${color}80)` }}
        className={`${size} inline-flex items-center justify-center`}
      >
        {isIconify ? (
          <Icon icon={iconName} className={size} style={{ color }} />
        ) : (
          <DynamicIcon name={iconName} className={size} style={{ color }} />
        )}
      </motion.div>
    );
  }

  // --- ROUTER / SWITCH / SERVER: pulse glow ---
  if (["router", "switch", "server"].includes(category)) {
    const pulseSpeed = isCritical ? 0.5 : isHealthy ? 2 : 1.2;
    const glowIntensity = isCritical ? "0 0 16px" : "0 0 8px";

    return (
      <motion.div
        animate={{
          scale: isCritical ? [1, 1.15, 1] : isHealthy ? [1, 1.05, 1] : 1,
          filter: [
            `drop-shadow(${glowIntensity} ${color}60)`,
            `drop-shadow(${glowIntensity} ${color})`,
            `drop-shadow(${glowIntensity} ${color}60)`,
          ],
        }}
        transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
        className={`${size} inline-flex items-center justify-center`}
      >
        {isIconify ? (
          <Icon icon={iconName} className={size} style={{ color }} />
        ) : (
          <DynamicIcon name={iconName} className={size} style={{ color }} />
        )}
      </motion.div>
    );
  }

  // --- ANTENNA: radio wave pulse rings ---
  if (category === "antenna") {
    return (
      <div className="relative inline-flex items-center justify-center">
        {isHealthy && (
          <>
            <motion.div
              className="absolute rounded-full border border-current"
              style={{ borderColor: `${color}40`, width: "140%", height: "140%" }}
              animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.div
              className="absolute rounded-full border border-current"
              style={{ borderColor: `${color}30`, width: "140%", height: "140%" }}
              animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
            />
          </>
        )}
        {isCritical && (
          <motion.div
            className="absolute rounded-full"
            style={{ backgroundColor: `${color}20`, width: "160%", height: "160%" }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
        <motion.div
          style={{ color, filter: `drop-shadow(0 0 6px ${color}80)` }}
          className={`${size} relative z-10`}
        >
          {isIconify ? (
            <Icon icon={iconName} className={size} style={{ color }} />
          ) : (
            <DynamicIcon name={iconName} className={size} style={{ color }} />
          )}
        </motion.div>
      </div>
    );
  }

  // --- LINK: blink/flash for activity ---
  if (category === "link") {
    return (
      <motion.div
        animate={isHealthy ? { opacity: [1, 0.5, 1] } : isCritical ? { opacity: [1, 0.2, 1] } : {}}
        transition={{ duration: isCritical ? 0.4 : 1.5, repeat: Infinity }}
        style={{ color, filter: `drop-shadow(0 0 4px ${color}60)` }}
        className={`${size} inline-flex items-center justify-center`}
      >
        {isIconify ? (
          <Icon icon={iconName} className={size} style={{ color }} />
        ) : (
          <DynamicIcon name={iconName} className={size} style={{ color }} />
        )}
      </motion.div>
    );
  }

  // --- GENERIC: subtle breathe effect ---
  return (
    <motion.div
      animate={isCritical ? { scale: [1, 1.1, 1] } : isHealthy ? { opacity: [0.85, 1, 0.85] } : {}}
      transition={{ duration: isCritical ? 0.7 : 3, repeat: Infinity, ease: "easeInOut" }}
      style={{ color, filter: `drop-shadow(0 0 6px ${color}80)` }}
      className={`${size} inline-flex items-center justify-center`}
    >
      {isIconify ? (
        <Icon icon={iconName} className={size} style={{ color }} />
      ) : (
        <DynamicIcon name={iconName} className={size} style={{ color }} />
      )}
    </motion.div>
  );
}
