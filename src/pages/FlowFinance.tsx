import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, Calendar, Settings2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import FinanceUploadWizard from "@/components/finance/FinanceUploadWizard";
import FinanceCharts from "@/components/finance/FinanceCharts";
import FinanceHeatmap from "@/components/finance/FinanceHeatmap";
import CashPressureChart from "@/components/finance/CashPressureChart";
import FinanceInsight from "@/components/finance/FinanceInsight";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function getMonthOptions() {
  const months: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    months.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value });
  }
  return months;
}

export default function FlowFinance() {
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [showSettings, setShowSettings] = useState(false);

  const selectedLabel = monthOptions.find(m => m.value === selectedMonth)?.label ?? "";

  const { data: transactions = [], refetch } = useQuery({
    queryKey: ["finance-transactions", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("month_reference", selectedMonth)
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed top-0 left-1/3 w-[1000px] h-[500px] bg-emerald-500/[0.015] rounded-full blur-[200px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 px-6 md:px-10 lg:px-14 py-8 md:py-12 space-y-10">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-emerald-400/60" />
            <h1 className="text-sm font-display font-bold text-foreground tracking-wider">
              <span className="text-emerald-400/80">FLOW</span>FINANCE
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-52 bg-card/40 border-border/30 rounded-lg h-9 text-xs font-mono text-foreground/80">
                <Calendar className="w-3 h-3 mr-2 text-muted-foreground/30" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-card/50 transition-all"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </motion.header>

        {/* ── Charts: S-Curve + Pressão de Caixa (Linhas) ── */}
        <FinanceCharts
          monthReference={selectedMonth}
          transactions={transactions}
        />

        {/* ── Cash Pressure Bars (Previsto / Realizado) ── */}
        <CashPressureChart
          transactions={transactions}
          monthReference={selectedMonth}
        />

        {/* ── Heatmap ── */}
        <FinanceHeatmap
          transactions={transactions}
          monthReference={selectedMonth}
        />

        {/* ── Insights ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <FinanceInsight
            transactions={transactions}
            monthLabel={selectedLabel}
          />
        </motion.div>

        {/* ── Settings Panel ── */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/10 p-6 md:p-8 max-h-[60vh] overflow-y-auto"
            >
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-mono tracking-[0.3em] text-muted-foreground/70 uppercase">
                    Importar & Gerenciar
                  </h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground/60 hover:bg-muted/20 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <FinanceUploadWizard
                  monthReference={selectedMonth}
                  onImportComplete={() => { refetch(); }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-10">
          <p className="text-[8px] font-mono text-muted-foreground/10 tracking-[0.4em] uppercase text-center">
            FlowPulse Intelligence
          </p>
        </div>
      </div>
    </div>
  );
}
