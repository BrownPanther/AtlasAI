import { createContext, useContext, useEffect, useState } from 'react'
import { expenses as initialExpenses } from '../data/mockData'

const ExpenseContext = createContext(null)
const TOTAL_BUDGET = 35000

function load() {
  const saved = localStorage.getItem('voyagr_expenses')
  return saved ? JSON.parse(saved) : initialExpenses
}

export function ExpenseProvider({ children }) {
  const [expenseList, setExpenseList] = useState(load)

  useEffect(() => {
    localStorage.setItem('voyagr_expenses', JSON.stringify(expenseList))
  }, [expenseList])

  const addExpense = (expense) => {
    setExpenseList((list) => [
      { id: `e_${Date.now()}`, date: 'Today', ...expense },
      ...list,
    ])
  }

  const totalSpent = expenseList.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <ExpenseContext.Provider value={{ expenseList, addExpense, totalSpent, totalBudget: TOTAL_BUDGET }}>
      {children}
    </ExpenseContext.Provider>
  )
}

export const useExpenses = () => useContext(ExpenseContext)