import { useState } from 'react'
import {
  PlusCircle,
  Wallet,
  ArrowUpRight,
  TrendingDown,
  PieChart,
  Coffee,
  Plane,
  Hotel,
  Compass,
  Tag,
  AlertCircle,
} from 'lucide-react'
import { useExpenses } from '../context/ExpenseContext'

const categories = ['Transport', 'Hotel', 'Food', 'Activities', 'Other']

const categoryIcons = {
  Food: Coffee,
  Transport: Plane,
  Hotel: Hotel,
  Activities: Compass,
  Other: Tag,
}

export default function Expenses() {
  const { expenseList, addExpense, totalSpent, totalBudget } = useExpenses()
  const [form, setForm] = useState({ label: '', amount: '', category: 'Food' })

  const remaining = totalBudget - totalSpent
  const percentUsed = Math.min(Math.round((totalSpent / (totalBudget || 1)) * 100), 100)

  const handleAdd = (e) => {
    e.preventDefault()
    if (!form.label || !form.amount) return
    addExpense({
      ...form,
      amount: Number(form.amount),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    })
    setForm({ label: '', amount: '', category: 'Food' })
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <section className="mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100/80 dark:bg-[#2d2739]/80 border border-slate-200 dark:border-white/15 text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-[#d0bcff] mb-3">
          <Wallet size={14} />
          <span>Autonomous Budget Intelligence</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white tracking-tight">
          Trip Spending & Allocation
        </h1>
        <p className="text-sm text-slate-500 dark:text-[#cbc3d7] mt-1 max-w-xl">
          Real-time expense tracking synchronized with your AI-synthesized trip budget ceiling.
        </p>
      </section>

      {/* Stat Strip Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white/90 dark:bg-[#1e192a]/80 backdrop-blur-xl border border-slate-200 dark:border-white/15 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#cbc3d7]">
            <span className="uppercase font-bold tracking-wider text-[10px]">Total Outflow</span>
            <TrendingDown size={16} className="text-pink-500 dark:text-[#ffb0cd]" />
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">
              ₹{totalSpent.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-500 dark:text-[#cbc3d7] ml-2">across {expenseList.length} items</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/90 dark:bg-[#1e192a]/80 backdrop-blur-xl border border-slate-200 dark:border-white/15 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#cbc3d7]">
            <span className="uppercase font-bold tracking-wider text-[10px]">Target Cap</span>
            <PieChart size={16} className="text-[#a078ff]" />
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">
              ₹{totalBudget.toLocaleString('en-IN')}
            </span>
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#383244] overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#a078ff] to-[#ffb0cd] transition-all duration-500"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500 dark:text-[#cbc3d7] mt-1 block">{percentUsed}% allocated</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/90 dark:bg-[#1e192a]/80 backdrop-blur-xl border border-slate-200 dark:border-white/15 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#cbc3d7]">
            <span className="uppercase font-bold tracking-wider text-[10px]">Discretionary Headroom</span>
            <ArrowUpRight size={16} className={remaining < 0 ? 'text-red-400' : 'text-purple-600 dark:text-[#d0bcff]'} />
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl md:text-3xl font-bold ${
                remaining < 0 ? 'text-red-400' : 'text-emerald-300'
              }`}
            >
              ₹{remaining.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-500 dark:text-[#cbc3d7] ml-2">
              {remaining < 0 ? 'Budget overrun' : 'Remaining reserve'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: List + Add Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expenses List */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-[#d0bcff]">
              Recorded Line Items
            </h3>
            <span className="text-xs text-slate-500 dark:text-[#cbc3d7]">{expenseList.length} expenses</span>
          </div>

          {expenseList.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white/60 dark:bg-[#1e192a]/60 border border-slate-200 dark:border-white/10 text-center text-slate-500 dark:text-[#cbc3d7]">
              <Wallet size={32} className="mx-auto text-[#a078ff] mb-2 opacity-60" />
              <p className="text-sm font-semibold text-slate-800 dark:text-white">No expenses recorded yet</p>
              <p className="text-xs mt-1">Add your transit, dining, or lodge expenses using the form.</p>
            </div>
          ) : (
            expenseList.map((item) => {
              const Icon = categoryIcons[item.category] || Tag
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-[#231d2e]/70 backdrop-blur-md border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-slate-300 dark:border-white/20 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#383244] flex items-center justify-center text-purple-600 dark:text-[#d0bcff] shrink-0 border border-slate-200 dark:border-white/10">
                      <Icon size={18} />
                    </div>
                    <div>
                      <strong className="text-sm font-semibold text-slate-800 dark:text-white block">{item.label}</strong>
                      <span className="text-xs text-slate-500 dark:text-[#cbc3d7]">
                        {item.category} {item.date ? `• ${item.date}` : ''}
                      </span>
                    </div>
                  </div>
                  <strong className="text-base font-bold text-slate-800 dark:text-white">
                    ₹{item.amount.toLocaleString('en-IN')}
                  </strong>
                </div>
              )
            })
          )}
        </div>

        {/* Add Expense Console */}
        <form
          onSubmit={handleAdd}
          className="p-6 rounded-2xl bg-white/95 dark:bg-[#1e192a]/85 backdrop-blur-xl border border-slate-300 dark:border-white/20 shadow-xl flex flex-col gap-4 h-fit"
        >
          <div className="flex items-center gap-2">
            <PlusCircle size={18} className="text-[#a078ff]" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Log an Outflow</h3>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-[#cbc3d7] uppercase tracking-wider">
              Description
            </label>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Cedar Cafe Lunch, SUV Fuel"
              className="p-3 rounded-xl bg-white dark:bg-[#110b1c] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-xs font-medium focus:outline-none focus:border-[#a078ff]"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-[#cbc3d7] uppercase tracking-wider">
              Amount (₹)
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="750"
              min="1"
              className="p-3 rounded-xl bg-white dark:bg-[#110b1c] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-xs font-medium focus:outline-none focus:border-[#a078ff]"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-[#cbc3d7] uppercase tracking-wider">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="p-3 rounded-xl bg-white dark:bg-[#110b1c] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-xs font-medium focus:outline-none focus:border-[#a078ff]"
            >
              {categories.map((c) => (
                <option key={c} value={c} className="bg-[#1e192a] text-slate-800 dark:text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#7c3aed] text-slate-800 dark:text-white text-xs font-bold shadow-md hover:scale-[1.02] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <PlusCircle size={15} />
            <span>Record Outflow</span>
          </button>
        </form>
      </div>
    </div>
  )
}
