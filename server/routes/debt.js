const express = require('express');
const router = express.Router();
const db = require('../db');
const { callAI } = require('../services/claude');
const { sendError } = require('../utils/errors');

// GET /api/debt — list all debts for user
router.get('/', (req, res) => {
  try {
    const debts = db.prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY interest_rate DESC').all(req.userId);
    res.json({ success: true, data: debts });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/debt — add a debt
router.post('/', (req, res) => {
  try {
    const { validateString, validatePositiveAmount, validateRate } = require('../utils/validate');
    const name = validateString(req.body.name, 'Name', 100);
    const balance = validatePositiveAmount(req.body.balance, 'Balance');
    const interest_rate = validateRate(req.body.interest_rate, 'Interest rate', 0, 100);
    const min_payment = validatePositiveAmount(req.body.min_payment, 'Minimum payment');
    const result = db.prepare(
      'INSERT INTO debts (user_id, name, balance, interest_rate, min_payment, original_amount) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.userId, name, balance, interest_rate, min_payment, balance);
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
    sendError(res, err);
  }
});

// DELETE /api/debt/:id — remove a debt
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM debts WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/debt/:id/payment — log a payment against a debt
router.post('/:id/payment', (req, res) => {
  try {
    const debt = db.prepare('SELECT * FROM debts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!debt) return res.status(404).json({ success: false, error: 'Debt not found' });
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Amount must be positive' });
    const newBalance = Math.max(0, debt.balance - amount);
    db.prepare('UPDATE debts SET balance = ? WHERE id = ?').run(newBalance, debt.id);
    res.json({ success: true, data: { id: debt.id, new_balance: newBalance, original_amount: debt.original_amount } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/debt/plan — calculate payoff plan
router.post('/plan', async (req, res) => {
  try {
    const { strategy, extra_payment } = req.body;
    const debts = db.prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY interest_rate DESC').all(req.userId);

    if (debts.length === 0) {
      return res.json({ success: true, data: { debts: [], totalDebt: 0, totalInterest: 0, debtFreeDate: null, aiSummary: '' } });
    }

    // Sort by strategy
    const sorted = [...debts];
    if (strategy === 'snowball') {
      sorted.sort((a, b) => a.balance - b.balance);
    } else {
      sorted.sort((a, b) => b.interest_rate - a.interest_rate);
    }

    const extraMonthly = parseFloat(extra_payment) || 0;

    // Simulate payoff
    const debtState = sorted.map(d => ({
      id: d.id,
      name: d.name,
      originalBalance: d.balance,
      balance: d.balance,
      rate: d.interest_rate / 100 / 12, // monthly rate
      minPayment: d.min_payment,
      totalInterest: 0,
      monthsToPayoff: 0,
      monthlyPayment: d.min_payment,
      paidOff: false,
    }));

    let totalInterest = 0;
    let months = 0;
    const maxMonths = 600; // 50 year cap

    while (debtState.some(d => !d.paidOff) && months < maxMonths) {
      months++;
      let extraLeft = extraMonthly;

      for (const d of debtState) {
        if (d.paidOff) continue;

        // Apply interest (round to avoid floating point drift)
        const interest = Math.round(d.balance * d.rate * 100) / 100;
        d.balance = Math.round((d.balance + interest) * 100) / 100;
        d.totalInterest += interest;
        totalInterest += interest;

        // Apply minimum payment
        const payment = Math.min(d.balance, d.minPayment);
        d.balance = Math.round((d.balance - payment) * 100) / 100;

        if (d.balance <= 0.01) {
          d.paidOff = true;
          d.monthsToPayoff = months;
          d.balance = 0;
          extraLeft += d.minPayment; // freed up payment rolls to next
        }
      }

      // Apply extra payment to first unpaid debt (debt avalanche/snowball)
      for (const d of debtState) {
        if (d.paidOff || extraLeft <= 0) continue;
        const extraApplied = Math.min(d.balance, extraLeft);
        d.balance -= extraApplied;
        extraLeft -= extraApplied;
        if (d.balance <= 0.01) {
          d.paidOff = true;
          d.monthsToPayoff = months;
          d.balance = 0;
          extraLeft += d.minPayment;
        }
      }
    }

    // Set months for any not yet paid off
    debtState.forEach(d => {
      if (!d.paidOff) d.monthsToPayoff = maxMonths;
    });

    const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
    const maxMonthsToPayoff = Math.max(...debtState.map(d => d.monthsToPayoff));
    const debtFreeDate = new Date();
    debtFreeDate.setMonth(debtFreeDate.getMonth() + maxMonthsToPayoff);

    // Also calculate without extra payment for comparison
    let totalInterestNoExtra = 0;
    let monthsNoExtra = 0;
    if (extraMonthly > 0) {
      const noExtraState = sorted.map(d => ({
        balance: d.balance,
        rate: d.interest_rate / 100 / 12,
        minPayment: d.min_payment,
        paidOff: false,
      }));
      while (noExtraState.some(d => !d.paidOff) && monthsNoExtra < maxMonths) {
        monthsNoExtra++;
        for (const d of noExtraState) {
          if (d.paidOff) continue;
          const interest = Math.round(d.balance * d.rate * 100) / 100;
          d.balance = Math.round((d.balance + interest) * 100) / 100;
          totalInterestNoExtra += interest;
          const payment = Math.min(d.balance, d.minPayment);
          d.balance = Math.round((d.balance - payment) * 100) / 100;
          if (d.balance <= 0.01) { d.paidOff = true; d.balance = 0; }
        }
      }
    }

    const interestSaved = extraMonthly > 0 ? totalInterestNoExtra - totalInterest : 0;
    const monthsSaved = extraMonthly > 0 ? monthsNoExtra - maxMonthsToPayoff : 0;

    // AI summary
    let aiSummary = '';
    try {
      const debtSummary = debtState.map((d, i) => `#${i + 1} ${d.name}: $${d.originalBalance.toFixed(0)} at ${(d.rate * 12 * 100).toFixed(1)}%, $${d.totalInterest.toFixed(0)} in interest, ${d.monthsToPayoff} months`).join('. ');
      aiSummary = await callAI(
        'Give a 1-2 sentence plain English debt payoff tip based on this data. Be specific with numbers. No disclaimers.',
        `Strategy: ${strategy}. Extra payment: $${extraMonthly}/mo. ${debtSummary}. Total interest: $${totalInterest.toFixed(0)}.${interestSaved > 0 ? ` Saving $${interestSaved.toFixed(0)} with extra payments.` : ''}`
      );
    } catch {
      if (debtState.length > 0) {
        const first = debtState[0];
        aiSummary = `Focus on ${first.name} first — it's costing you the most in interest at ${(first.rate * 12 * 100).toFixed(1)}% APR.`;
      }
    }

    res.json({
      success: true,
      data: {
        debts: debtState.map((d, i) => ({
          id: d.id,
          order: i + 1,
          name: d.name,
          originalBalance: d.originalBalance,
          interestRate: (d.rate * 12 * 100).toFixed(1),
          totalInterest: d.totalInterest,
          monthsToPayoff: d.monthsToPayoff,
          monthlyPayment: d.minPayment + (i === 0 ? extraMonthly : 0),
        })),
        totalDebt,
        totalInterest,
        debtFreeDate: debtFreeDate.toISOString(),
        monthsToFreedom: maxMonthsToPayoff,
        interestSaved,
        monthsSaved,
        strategy,
        aiSummary,
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
