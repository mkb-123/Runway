"use client";

import * as XLSX from "xlsx";
import { useData } from "@/context/data-context";
import { useScenarioData } from "@/context/use-scenario-data";
import {
  ACCOUNT_TYPE_LABELS,
  TAX_WRAPPER_LABELS,
  getAccountTaxWrapper,
  getPersonContributionTotals,
  getHouseholdGrossIncome,
  annualiseContribution,
  annualiseOutgoing,
} from "@/types";
import type { TaxWrapper, HouseholdData, SnapshotsData } from "@/types";
import { getDeferredBonus, getPropertyEquity, getAnnualMortgagePayment, getMortgageRemainingMonths } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { calculateSchoolYearsRemaining, calculateTotalSchoolFeeCost, calculateSchoolStartDate, calculateSchoolEndDate, findLastSchoolFeeYear } from "@/lib/school-fees";
import {
  calculateIncomeTax,
  calculateNI,
  calculateTakeHomePay,
  calculateStudentLoan,
} from "@/lib/tax";
import {
  calculateAdjustedRequiredPot,
  calculateRetirementCountdown,
  calculatePensionBridge,
  calculateCoastFIRE,
  calculateRequiredSavings,
  calculateAge,
  calculateTaxEfficiencyScore,
  calculateTaperedAnnualAllowance,
  projectFinalValue,
  getMidScenarioRate,
} from "@/lib/projections";
import { calculateIHT, yearsSince } from "@/lib/iht";
import {
  getUnrealisedGains,
  calculateBedAndISA,
  determineCgtRate,
  calculateBedAndISABreakEven,
} from "@/lib/cgt";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { generateRecommendations } from "@/lib/recommendations";
import { calculateHouseholdStatePension } from "@/lib/aggregations";
import { generateCashFlowTimeline } from "@/lib/cash-flow";
import { generateDeferredTranches, totalProjectedDeferredValue } from "@/lib/deferred-bonus";
import { FileSpreadsheet, Printer } from "lucide-react";
import Link from "next/link";

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

/** Format currency for Excel (just the number, column formatting handles £ sign) */
function curr(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Inject an Excel formula into a worksheet cell */
function setFormula(ws: XLSX.WorkSheet, ref: string, formula: string): void {
  ws[ref] = { t: "n", f: formula };
}

/** Project gross value of a deferred tranche at vesting, accounting for growth */
function projectTrancheGrossValue(tranche: { grantDate: string; vestingDate: string; amount: number; estimatedAnnualReturn: number }): number {
  const grant = new Date(tranche.grantDate);
  const vest = new Date(tranche.vestingDate);
  const years = (vest.getTime() - grant.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return years > 0 ? tranche.amount * Math.pow(1 + tranche.estimatedAnnualReturn, years) : tranche.amount;
}

/** Build the full financial report workbook from household data */
function buildFullWorkbook(household: HouseholdData, snapshots?: SnapshotsData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const reportDate = new Date().toISOString().slice(0, 10);

  const getPersonName = (personId: string) =>
    household.persons.find((p) => p.id === personId)?.name ?? personId;

  // ============================
  // Sheet 0: Cover
  // ============================
  const coverRows = [
    { "Runway Financial Report": "" },
    { "Runway Financial Report": `Generated: ${reportDate}` },
    { "Runway Financial Report": `Household: ${household.persons.map((p) => p.name).join(" & ")}` },
    { "Runway Financial Report": `Persons: ${household.persons.length}` },
    { "Runway Financial Report": `Accounts: ${household.accounts.length}` },
    { "Runway Financial Report": "" },
    { "Runway Financial Report": "IMPORTANT: All values are point-in-time as at the valuation date above." },
    { "Runway Financial Report": "Tax calculations use 2024/25 rates and are estimates only." },
    { "Runway Financial Report": "Projections assume constant growth rates and are not guaranteed." },
    { "Runway Financial Report": "This report is not financial advice. Consult a qualified adviser." },
    { "Runway Financial Report": "" },
    { "Runway Financial Report": "Sheets included:" },
    { "Runway Financial Report": "1. Summary — One-page household overview" },
    { "Runway Financial Report": "2. Accounts — All investment accounts with subtotals" },
    { "Runway Financial Report": "3. Wrapper Summary — Net worth by tax wrapper" },
    { "Runway Financial Report": "4. Income & Tax — Gross pay, tax bands, take-home, household tax summary" },
    { "Runway Financial Report": "5. Contributions — Savings into ISA, pension, GIA" },
    { "Runway Financial Report": "6. Allowances — Pension & ISA allowance usage" },
    { "Runway Financial Report": "7. Retirement — Target pot, FIRE, pension bridge" },
    { "Runway Financial Report": "8. IHT — Estate value, thresholds, liability" },
    { "Runway Financial Report": "9. CGT & Bed ISA — Unrealised gains, break-even" },
    { "Runway Financial Report": "10. Outgoings — Committed spending with annual totals" },
    { "Runway Financial Report": "11. Tax Efficiency — Savings allocation score" },
    { "Runway Financial Report": "12. Recommendations — Actionable financial advice" },
    { "Runway Financial Report": "13. Properties — Property values, mortgages, equity" },
    { "Runway Financial Report": "14. Children & Fees — School fee projections" },
    { "Runway Financial Report": "15. Snapshot History — Monthly net worth history" },
    { "Runway Financial Report": "16. 24-Month Cash Flow — Month-by-month income vs outgoings" },
    { "Runway Financial Report": "17. Deferred Bonus — Vesting schedule & projected values (net-of-tax)" },
    { "Runway Financial Report": "18. Free Cash Summary — Liquid position after commitments" },
    { "Runway Financial Report": "19. Growth Projections — Salary & pot trajectories, post-fee scenarios" },
    { "Runway Financial Report": "20. Vesting Day Planner — Tax-year-aware waterfall allocation" },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(coverRows), "Cover");

  // Grand total of investable assets (used across multiple sheets)
  const grandTotal = household.accounts.reduce((s, a) => s + a.currentValue, 0);
  const isaAllowance = UK_TAX_CONSTANTS.isaAnnualAllowance;

  // ============================
  // Sheet: One-Page Summary (Tom-friendly overview)
  // ============================
  {
    const propertyEquityTotal = household.properties.reduce((s, p) => s + getPropertyEquity(p), 0);
    const totalNW = grandTotal + propertyEquityTotal;
    const cashTotal = household.accounts
      .filter((a) => ["cash_savings", "cash_isa", "premium_bonds"].includes(a.type))
      .reduce((s, a) => s + a.currentValue, 0);
    const emergTarget = household.emergencyFund.monthlyEssentialExpenses * household.emergencyFund.targetMonths;

    // Annual income — use take-home (net) income, not gross
    const hhGrossIncome = getHouseholdGrossIncome(household.income, household.bonusStructures);
    let hhNetIncome = 0;
    for (const inc of household.income) {
      const th = calculateTakeHomePay(inc);
      hhNetIncome += th.takeHome;
    }
    // Add net cash bonus (after marginal tax)
    for (const bonus of household.bonusStructures) {
      const cashBonus = bonus.cashBonusAnnual;
      if (cashBonus > 0) {
        const inc = household.income.find((i) => i.personId === bonus.personId);
        if (inc) {
          const taxWithout = calculateIncomeTax(inc.grossSalary, inc.employeePensionContribution, inc.pensionContributionMethod).tax;
          const niWithout = calculateNI(inc.grossSalary, inc.employeePensionContribution, inc.pensionContributionMethod).ni;
          const taxWith = calculateIncomeTax(inc.grossSalary + cashBonus, inc.employeePensionContribution, inc.pensionContributionMethod).tax;
          const niWith = calculateNI(inc.grossSalary + cashBonus, inc.employeePensionContribution, inc.pensionContributionMethod).ni;
          hhNetIncome += cashBonus - (taxWith - taxWithout) - (niWith - niWithout);
        }
      }
    }

    // Annual commitments
    const schoolFees = household.committedOutgoings
      .filter((o) => o.linkedChildId)
      .reduce((s, o) => s + annualiseOutgoing(o.amount, o.frequency), 0);
    const mortgageFromOutgoings = household.committedOutgoings
      .filter((o) => o.category === "mortgage")
      .reduce((s, o) => s + annualiseOutgoing(o.amount, o.frequency), 0);
    const mortgageFromProp = household.properties.reduce((s, p) => s + getAnnualMortgagePayment(p), 0);
    const annualMortg = Math.max(mortgageFromOutgoings, mortgageFromProp);
    const otherComm = household.committedOutgoings
      .filter((o) => !o.linkedChildId && o.category !== "mortgage")
      .reduce((s, o) => s + annualiseOutgoing(o.amount, o.frequency), 0);
    const lifestyle = household.emergencyFund.monthlyLifestyleSpending * 12;
    const totalAnnualSpend = schoolFees + annualMortg + otherComm + lifestyle;
    const annualSurplus = hhNetIncome - totalAnnualSpend;

    // Allowance headroom per person
    const personAllowances: { name: string; isaRemaining: number; pensionRemaining: number }[] = [];
    for (const person of household.persons) {
      const c = getPersonContributionTotals(household.contributions, person.id);
      const inc = household.income.find((i) => i.personId === person.id);
      const empPens = (inc?.employeePensionContribution ?? 0) + (inc?.employerPensionContribution ?? 0);
      const totalPens = empPens + c.pensionContribution;
      const bonus = household.bonusStructures.find((b) => b.personId === person.id);
      const threshInc = (inc?.grossSalary ?? 0) + (bonus?.cashBonusAnnual ?? 0);
      const adjInc = threshInc + (inc?.employerPensionContribution ?? 0);
      const effAllow = calculateTaperedAnnualAllowance(threshInc, adjInc);
      personAllowances.push({
        name: person.name,
        isaRemaining: Math.max(0, isaAllowance - c.isaContribution),
        pensionRemaining: Math.max(0, effAllow - totalPens),
      });
    }

    // School fees
    const totalSchoolFeeCost = household.children.reduce((s, c) => s + calculateTotalSchoolFeeCost(c), 0);
    const lastFeeYr = findLastSchoolFeeYear(household.children);
    const yearsToFeeEnd = lastFeeYr ? Math.max(0, lastFeeYr - new Date().getFullYear()) : 0;

    // Retirement status
    const totalStatePens = calculateHouseholdStatePension(household.persons);
    const reqPot = calculateAdjustedRequiredPot(
      household.retirement.targetAnnualIncome,
      household.retirement.withdrawalRate,
      household.retirement.includeStatePension,
      totalStatePens
    );
    const progress = reqPot > 0 ? (grandTotal / reqPot) * 100 : 0;
    const retGap = Math.max(0, reqPot - grandTotal);
    const retStatus = retGap <= 0 ? "On track" : `${formatCurrency(retGap)} shortfall`;

    const summaryRows: Record<string, string | number>[] = [
      { Item: `Runway — Household Summary (${reportDate})`, "Value": "" },
      { Item: "", "Value": "" },
      { Item: "--- Net Worth ---", "Value": "" },
      { Item: "Total Net Worth (investable + property)", "Value": curr(totalNW) },
      { Item: "Investable Net Worth (excl. property)", "Value": curr(grandTotal) },
      { Item: "Cash Position", "Value": curr(cashTotal) },
      { Item: "Emergency Fund Target", "Value": curr(emergTarget) },
      { Item: "Cash vs Target", "Value": cashTotal >= emergTarget ? "Buffer met" : `${formatCurrency(emergTarget - cashTotal)} gap` },
      { Item: "", "Value": "" },
      { Item: "--- Income vs Commitments (Annual) ---", "Value": "" },
      { Item: "Gross Household Income", "Value": curr(hhGrossIncome) },
      { Item: "Net Household Income (after tax & NI)", "Value": curr(hhNetIncome) },
      { Item: "Mortgage", "Value": curr(annualMortg) },
      { Item: "School Fees", "Value": curr(schoolFees) },
      { Item: "Other Committed", "Value": curr(otherComm) },
      { Item: "Lifestyle", "Value": curr(lifestyle) },
      { Item: "Total Annual Spend", "Value": curr(totalAnnualSpend) },
      { Item: "Annual Surplus (net income - spend)", "Value": curr(annualSurplus) },
      { Item: "", "Value": "" },
    ];

    // Allowance headroom per person
    summaryRows.push({ Item: "--- Allowance Headroom ---", "Value": "" });
    for (const pa of personAllowances) {
      summaryRows.push(
        { Item: `${pa.name} — ISA Remaining`, "Value": curr(pa.isaRemaining) },
        { Item: `${pa.name} — Pension Remaining`, "Value": curr(pa.pensionRemaining) },
      );
    }
    summaryRows.push({ Item: "", "Value": "" });

    // School fees
    if (household.children.length > 0) {
      summaryRows.push(
        { Item: "--- Education ---", "Value": "" },
        { Item: "Years of Fees Remaining", "Value": yearsToFeeEnd },
        { Item: "Total Remaining Cost", "Value": curr(totalSchoolFeeCost) },
        { Item: "Net Worth After Education Liability", "Value": curr(totalNW - totalSchoolFeeCost) },
        { Item: "", "Value": "" },
      );
    }

    // Retirement
    summaryRows.push(
      { Item: "--- Retirement ---", "Value": "" },
      { Item: "Required Pot", "Value": curr(reqPot) },
      { Item: "Current Progress", "Value": `${progress.toFixed(0)}%` },
      { Item: "Status", "Value": retStatus },
    );

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");
  }

  // ============================
  // Sheet 1: Accounts (with SUM formulas)
  // ============================
  const accountRows: Record<string, string | number>[] = household.accounts.map((a) => ({
    Person: getPersonName(a.personId),
    "Account Name": a.name,
    Provider: a.provider,
    Type: ACCOUNT_TYPE_LABELS[a.type],
    "Tax Wrapper": TAX_WRAPPER_LABELS[getAccountTaxWrapper(a.type)],
    "Current Value (£)": curr(a.currentValue),
  }));

  // Track row positions for SUM formulas (data starts at row 2 = index 1 in Excel)

  const subtotalRows: number[] = [];

  // Add person subtotals with SUM formulas
  const valueCol = "F"; // "Current Value (£)" is column F
  for (const person of household.persons) {
    const personAccountIndices: number[] = [];
    household.accounts.forEach((a, idx) => {
      if (a.personId === person.id) personAccountIndices.push(idx + 2); // +2 for header + 1-indexed
    });
    const subtotalRowIdx = accountRows.length + 2; // +2 for header + 1-indexed
    subtotalRows.push(subtotalRowIdx);

    // Placeholder row for subtotal (formula injected after sheet creation)
    accountRows.push({
      Person: person.name,
      "Account Name": "SUBTOTAL",
      Provider: "",
      Type: "",
      "Tax Wrapper": "",
      "Current Value (£)": 0,
    });
  }

  const grandTotalRowIdx = accountRows.length + 2;
  accountRows.push({
    Person: "TOTAL",
    "Account Name": "GRAND TOTAL",
    Provider: "",
    Type: "",
    "Tax Wrapper": "",
    "Current Value (£)": 0,
  });

  const accountsSheet = XLSX.utils.json_to_sheet(accountRows);

  // Inject SUM formulas for person subtotals
  let personIdx = 0;
  for (const person of household.persons) {
    const personAccountIndices: number[] = [];
    household.accounts.forEach((a, idx) => {
      if (a.personId === person.id) personAccountIndices.push(idx + 2);
    });
    if (personAccountIndices.length > 0) {
      const sumParts = personAccountIndices.map((r) => `${valueCol}${r}`).join(",");
      setFormula(accountsSheet, `${valueCol}${subtotalRows[personIdx]}`, `SUM(${sumParts})`);
    }
    personIdx++;
  }

  // Grand total = sum of subtotal rows
  if (subtotalRows.length > 0) {
    const grandSumParts = subtotalRows.map((r) => `${valueCol}${r}`).join(",");
    setFormula(accountsSheet, `${valueCol}${grandTotalRowIdx}`, `SUM(${grandSumParts})`);
  }

  XLSX.utils.book_append_sheet(wb, accountsSheet, "Accounts");

  // ============================
  // Sheet 2: Wrapper Summary (with SUM & percentage formulas)
  // ============================
  const wrapperTotals = new Map<TaxWrapper, number>();
  for (const a of household.accounts) {
    const w = getAccountTaxWrapper(a.type);
    wrapperTotals.set(w, (wrapperTotals.get(w) ?? 0) + a.currentValue);
  }
  const wrapperEntries = Array.from(wrapperTotals.entries());
  const wrapperRows = wrapperEntries.map(([wrapper, value]) => ({
    "Tax Wrapper": TAX_WRAPPER_LABELS[wrapper],
    "Value (£)": curr(value),
    "% of Net Worth": grandTotal > 0 ? curr(value / grandTotal) : 0,
  }));
  const wrapperDataCount = wrapperRows.length;
  wrapperRows.push({
    "Tax Wrapper": "TOTAL",
    "Value (£)": 0 as number,
    "% of Net Worth": 0 as number,
  });

  const wrapperSheet = XLSX.utils.json_to_sheet(wrapperRows);
  // SUM formula for total value
  const wTotalRow = wrapperDataCount + 2; // +1 header, +1 for 1-indexed
  setFormula(wrapperSheet, `B${wTotalRow}`, `SUM(B2:B${wTotalRow - 1})`);
  setFormula(wrapperSheet, `C${wTotalRow}`, `SUM(C2:C${wTotalRow - 1})`);
  // Percentage formulas for each wrapper row
  for (let i = 0; i < wrapperDataCount; i++) {
    setFormula(wrapperSheet, `C${i + 2}`, `IF(B$${wTotalRow}=0,0,B${i + 2}/B$${wTotalRow})`);
  }
  XLSX.utils.book_append_sheet(wb, wrapperSheet, "Wrapper Summary");

  // ============================
  // Sheet 3: Income & Tax
  // ============================
  const incomeRows: Record<string, string | number>[] = [];
  for (const person of household.persons) {
    const inc = household.income.find((i) => i.personId === person.id);
    if (!inc) continue;

    const bonus = household.bonusStructures.find((b) => b.personId === person.id);
    const cashBonus = bonus?.cashBonusAnnual ?? 0;
    const deferredBonus = bonus ? getDeferredBonus(bonus) : 0;
    const totalGross = inc.grossSalary + cashBonus;
    const taxResult = calculateIncomeTax(totalGross, inc.employeePensionContribution, inc.pensionContributionMethod);
    const niResult = calculateNI(totalGross, inc.employeePensionContribution, inc.pensionContributionMethod);
    const slGross = inc.pensionContributionMethod === "salary_sacrifice" ? totalGross - inc.employeePensionContribution : totalGross;
    const studentLoan = calculateStudentLoan(slGross, person.studentLoanPlan);
    const takeHome = calculateTakeHomePay(inc);

    incomeRows.push(
      { Person: person.name, Item: "Gross Salary", "Value (£)": curr(inc.grossSalary) },
      { Person: "", Item: "Cash Bonus", "Value (£)": curr(cashBonus) },
      { Person: "", Item: "Deferred Bonus (Annual)", "Value (£)": curr(deferredBonus) },
      ...(bonus && bonus.vestingYears > 0 ? [{ Person: "" as string, Item: "  Vesting Period", "Value (£)": `${bonus.vestingYears} years` as string | number }] : []),
      { Person: "", Item: "Total Gross (excl. deferred — taxed on vesting)", "Value (£)": curr(totalGross) },
      { Person: "", Item: "Employee Pension", "Value (£)": curr(inc.employeePensionContribution) },
      { Person: "", Item: "Employer Pension", "Value (£)": curr(inc.employerPensionContribution) },
      { Person: "", Item: `Pension Method`, "Value (£)": inc.pensionContributionMethod as string },
      { Person: "", Item: "Income Tax", "Value (£)": curr(taxResult.tax) },
      { Person: "", Item: "  Effective Tax Rate", "Value (£)": formatPercent(taxResult.effectiveRate) as string },
      { Person: "", Item: "National Insurance", "Value (£)": curr(niResult.ni) },
      { Person: "", Item: "Student Loan Repayment", "Value (£)": curr(studentLoan) },
      { Person: "", Item: "Take-Home Pay (Annual)", "Value (£)": curr(takeHome.takeHome) },
      { Person: "", Item: "Take-Home Pay (Monthly)", "Value (£)": curr(takeHome.monthlyTakeHome) },
      { Person: "", Item: "", "Value (£)": "" },
    );

    // Tax band breakdown
    for (const band of taxResult.breakdown) {
      incomeRows.push({
        Person: "",
        Item: `  Tax Band: ${band.band}`,
        "Value (£)": `${formatPercent(band.rate)} on ${formatCurrency(band.taxableAmount)} = ${formatCurrency(band.tax)}`,
      });
    }
    incomeRows.push({ Person: "", Item: "", "Value (£)": "" });
  }

  // Household Tax Summary at bottom of Income & Tax sheet
  if (household.persons.length > 0) {
    let hhGross = 0;
    let hhTax = 0;
    let hhNI = 0;
    let hhTakeHome = 0;
    const perPersonSummary: { name: string; gross: number; marginalRate: string; paStatus: string }[] = [];

    for (const person of household.persons) {
      const inc = household.income.find((i) => i.personId === person.id);
      if (!inc) continue;
      const bonus = household.bonusStructures.find((b) => b.personId === person.id);
      const cashBonus = bonus?.cashBonusAnnual ?? 0;
      const totalGross = inc.grossSalary + cashBonus;
      const taxResult = calculateIncomeTax(totalGross, inc.employeePensionContribution, inc.pensionContributionMethod);
      const niResult = calculateNI(totalGross, inc.employeePensionContribution, inc.pensionContributionMethod);
      const takeHome = calculateTakeHomePay(inc);

      hhGross += totalGross;
      hhTax += taxResult.tax;
      hhNI += niResult.ni;
      hhTakeHome += takeHome.takeHome;

      // Determine adjusted net income for PA taper check (matches tax.ts logic)
      let adjustedNet: number;
      if (inc.pensionContributionMethod === "salary_sacrifice" || inc.pensionContributionMethod === "net_pay") {
        adjustedNet = totalGross - inc.employeePensionContribution;
      } else if (inc.pensionContributionMethod === "relief_at_source") {
        adjustedNet = totalGross - (inc.employeePensionContribution / 0.8);
      } else {
        adjustedNet = totalGross;
      }
      const paThreshold = UK_TAX_CONSTANTS.personalAllowanceTaperThreshold;
      const fullPA = UK_TAX_CONSTANTS.personalAllowance;
      let paStatus = "Full";
      if (adjustedNet > paThreshold + fullPA * 2) {
        paStatus = "Zero (income > £125,140)";
      } else if (adjustedNet > paThreshold) {
        const reduced = Math.max(0, fullPA - Math.floor((adjustedNet - paThreshold) / 2));
        paStatus = `Tapered (£${reduced.toLocaleString()})`;
      }

      // Marginal rate: compute empirically (handles PA taper 60% trap)
      const taxOnGross = taxResult.tax + niResult.ni;
      const taxOnGrossPlusOne = calculateIncomeTax(totalGross + 1, inc.employeePensionContribution, inc.pensionContributionMethod).tax
        + calculateNI(totalGross + 1, inc.employeePensionContribution, inc.pensionContributionMethod).ni;
      const empiricalMarginal = taxOnGrossPlusOne - taxOnGross;
      const inTaperZone = adjustedNet > paThreshold && adjustedNet <= paThreshold + fullPA * 2;
      const marginalRate = inTaperZone
        ? `${formatPercent(empiricalMarginal)} (incl. PA taper)`
        : formatPercent(empiricalMarginal);

      perPersonSummary.push({ name: person.name, gross: totalGross, marginalRate, paStatus });
    }

    incomeRows.push(
      { Person: "", Item: "═══ HOUSEHOLD TAX SUMMARY ═══", "Value (£)": "" },
      { Person: "", Item: "Combined Gross Income", "Value (£)": curr(hhGross) },
      { Person: "", Item: "Combined Income Tax", "Value (£)": curr(hhTax) },
      { Person: "", Item: "Combined National Insurance", "Value (£)": curr(hhNI) },
      { Person: "", Item: "Combined Take-Home", "Value (£)": curr(hhTakeHome) },
      { Person: "", Item: "Household Effective Tax Rate", "Value (£)": hhGross > 0 ? formatPercent((hhTax + hhNI) / hhGross) : "0%" },
      { Person: "", Item: "", "Value (£)": "" },
    );

    for (const ps of perPersonSummary) {
      incomeRows.push(
        { Person: "", Item: `${ps.name} — Marginal Tax Rate`, "Value (£)": ps.marginalRate },
        { Person: "", Item: `${ps.name} — Personal Allowance`, "Value (£)": ps.paStatus },
      );
    }
    incomeRows.push({ Person: "", Item: "", "Value (£)": "" });
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeRows), "Income & Tax");

  // ============================
  // Sheet 4: Contributions
  // ============================
  const contribRows = household.contributions.map((c) => ({
    Person: getPersonName(c.personId),
    Target: c.target.toUpperCase(),
    Amount: curr(c.amount),
    Frequency: c.frequency,
    "Annual (£)": curr(annualiseContribution(c.amount, c.frequency)),
  }));

  // Add employment pension contributions
  for (const inc of household.income) {
    contribRows.push({
      Person: getPersonName(inc.personId),
      Target: "PENSION (Employee)",
      Amount: curr(inc.employeePensionContribution),
      Frequency: "annually",
      "Annual (£)": curr(inc.employeePensionContribution),
    });
    contribRows.push({
      Person: getPersonName(inc.personId),
      Target: "PENSION (Employer)",
      Amount: curr(inc.employerPensionContribution),
      Frequency: "annually",
      "Annual (£)": curr(inc.employerPensionContribution),
    });
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contribRows), "Contributions");

  // ============================
  // Sheet 5: Pension Allowance
  // ============================
  const pensionRows: Record<string, string | number>[] = [];
  const pensionAllowance = UK_TAX_CONSTANTS.pensionAnnualAllowance;

  for (const person of household.persons) {
    const inc = household.income.find((i) => i.personId === person.id);
    const discretionary = getPersonContributionTotals(household.contributions, person.id);
    const employeePension = inc?.employeePensionContribution ?? 0;
    const employerPension = inc?.employerPensionContribution ?? 0;
    const totalPensionUsed = employeePension + employerPension + discretionary.pensionContribution;

    // Tapered allowance — threshold income includes salary + bonus (HMRC PTM057100)
    const grossSalary = inc?.grossSalary ?? 0;
    const bonus = household.bonusStructures.find((b) => b.personId === person.id);
    const cashBonus = bonus?.cashBonusAnnual ?? 0;
    const thresholdIncome = grossSalary + cashBonus;
    const adjustedIncome = thresholdIncome + (inc?.employerPensionContribution ?? 0);
    const effectiveAllowance = calculateTaperedAnnualAllowance(thresholdIncome, adjustedIncome);

    pensionRows.push(
      { Person: person.name, Item: "Employee Pension", "Value (£)": curr(employeePension) },
      { Person: "", Item: "Employer Pension", "Value (£)": curr(employerPension) },
      { Person: "", Item: "Discretionary Pension", "Value (£)": curr(discretionary.pensionContribution) },
      { Person: "", Item: "TOTAL Pension Used", "Value (£)": curr(totalPensionUsed) },
      { Person: "", Item: "Standard Annual Allowance", "Value (£)": curr(pensionAllowance) },
      { Person: "", Item: "Effective Allowance (after taper)", "Value (£)": curr(effectiveAllowance) },
      { Person: "", Item: "Remaining Headroom", "Value (£)": curr(Math.max(0, effectiveAllowance - totalPensionUsed)) },
      { Person: "", Item: "", "Value (£)": "" },
      { Person: "", Item: "ISA Used", "Value (£)": curr(discretionary.isaContribution) },
      { Person: "", Item: "ISA Allowance", "Value (£)": curr(isaAllowance) },
      { Person: "", Item: "ISA Remaining", "Value (£)": curr(Math.max(0, isaAllowance - discretionary.isaContribution)) },
      { Person: "", Item: "", "Value (£)": "" },
    );
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pensionRows), "Allowances");

  // ============================
  // Sheet 6: Retirement
  // ============================
  const { retirement } = household;
  const totalStatePension = calculateHouseholdStatePension(household.persons);
  const requiredPot = calculateAdjustedRequiredPot(
    retirement.targetAnnualIncome,
    retirement.withdrawalRate,
    retirement.includeStatePension,
    totalStatePension
  );
  const progressPct = requiredPot > 0 ? (grandTotal / requiredPot) * 100 : 0;
  const discretionaryContribs = household.contributions.reduce(
    (s, c) => s + annualiseContribution(c.amount, c.frequency),
    0
  );
  const employmentPension = household.income.reduce(
    (s, i) => s + i.employeePensionContribution + i.employerPensionContribution,
    0
  );
  const totalAnnualContribs = discretionaryContribs + employmentPension;

  const primaryPerson = household.persons.find((p) => p.relationship === "self");
  const currentAge = primaryPerson ? calculateAge(primaryPerson.dateOfBirth) : 35;
  const retAge = primaryPerson?.plannedRetirementAge ?? 60;
  const pensionAccessAge = primaryPerson?.pensionAccessAge ?? 57;

  const midRate = retirement.scenarioRates[Math.floor(retirement.scenarioRates.length / 2)] ?? 0.07;
  const countdown = calculateRetirementCountdown(grandTotal, totalAnnualContribs, requiredPot, midRate);

  const accessibleWealth = household.accounts
    .filter((a) => getAccountTaxWrapper(a.type) !== "pension")
    .reduce((sum, a) => sum + a.currentValue, 0);
  const bridge = calculatePensionBridge(
    retAge,
    pensionAccessAge,
    retirement.targetAnnualIncome,
    accessibleWealth
  );

  const coastFireReached = calculateCoastFIRE(grandTotal, requiredPot, retAge, currentAge, midRate);
  const yearsToRetire = Math.max(0, retAge - currentAge);
  const coastFireNumber = yearsToRetire > 0 ? requiredPot / Math.pow(1 + midRate, yearsToRetire) : requiredPot;
  const grossIncome = getHouseholdGrossIncome(household.income, household.bonusStructures);
  const savingsRate = grossIncome > 0 ? (totalAnnualContribs / grossIncome) * 100 : 0;

  const retRows: Record<string, string | number>[] = [
    { Item: "Target Annual Income", "Value": curr(retirement.targetAnnualIncome) },
    { Item: "Withdrawal Rate (SWR)", "Value": formatPercent(retirement.withdrawalRate) },
    { Item: "Include State Pension", "Value": retirement.includeStatePension ? "Yes" : "No" },
    { Item: "Total State Pension (Annual)", "Value": curr(totalStatePension) },
    { Item: "Required Pot", "Value": curr(requiredPot) },
    { Item: "", "Value": "" },
    { Item: "Current Pot", "Value": curr(grandTotal) },
    { Item: "Progress", "Value": `${progressPct.toFixed(1)}%` },
    { Item: "Remaining", "Value": curr(Math.max(0, requiredPot - grandTotal)) },
    { Item: "", "Value": "" },
    { Item: "Time to Target (mid scenario)", "Value": countdown.years === 0 && countdown.months === 0 ? "Target reached" : `${countdown.years}y ${countdown.months}m` },
    { Item: "Current Age", "Value": currentAge },
    { Item: "Planned Retirement Age", "Value": retAge },
    { Item: "Pension Access Age", "Value": pensionAccessAge },
    { Item: "", "Value": "" },
    { Item: "Savings Rate", "Value": `${savingsRate.toFixed(1)}%` },
    { Item: "Coast FIRE Number", "Value": curr(coastFireNumber) },
    { Item: "Coast FIRE Reached?", "Value": coastFireReached ? "Yes" : "No" },
    { Item: "", "Value": "" },
    { Item: "--- Pension Bridge ---", "Value": "" },
    { Item: "Bridge Needed?", "Value": retAge < pensionAccessAge ? "Yes" : "No" },
    { Item: "Years to Bridge", "Value": Math.max(0, pensionAccessAge - retAge) },
    { Item: "Bridge Pot Required", "Value": curr(bridge.bridgePotRequired) },
    { Item: "Accessible Wealth (non-pension)", "Value": curr(accessibleWealth) },
    { Item: "Bridge Shortfall", "Value": curr(bridge.shortfall) },
    { Item: "Bridge Sufficient?", "Value": bridge.sufficient ? "Yes" : "No" },
    { Item: "", "Value": "" },
    { Item: "--- Scenario Analysis ---", "Value": "" },
  ];

  for (const rate of retirement.scenarioRates) {
    const cd = calculateRetirementCountdown(grandTotal, totalAnnualContribs, requiredPot, rate);
    retRows.push({
      Item: `Growth ${formatPercent(rate)}`,
      "Value": cd.years === 0 && cd.months === 0 ? "Target reached" : `${cd.years}y ${cd.months}m (age ~${currentAge + cd.years})`,
    });
  }

  const targets = [500, 1000, 2000, 3000];
  retRows.push({ Item: "", "Value": "" }, { Item: "--- Required Monthly Savings ---", "Value": "" });
  for (const target of targets) {
    const targetPot = target * 1000;
    const required = calculateRequiredSavings(targetPot, grandTotal, retAge - currentAge, midRate);
    retRows.push({
      Item: `To reach ${formatCurrency(targetPot)} target`,
      "Value": formatCurrency(required / 12) + "/month",
    });
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(retRows), "Retirement");

  // ============================
  // Sheet 7: IHT
  // ============================
  const ihtConfig = household.iht;
  const pensionValue = household.accounts
    .filter((a) => getAccountTaxWrapper(a.type) === "pension")
    .reduce((s, a) => s + a.currentValue, 0);
  const isaValue = household.accounts
    .filter((a) => getAccountTaxWrapper(a.type) === "isa")
    .reduce((s, a) => s + a.currentValue, 0);
  const giaValue = household.accounts
    .filter((a) => getAccountTaxWrapper(a.type) === "gia")
    .reduce((s, a) => s + a.currentValue, 0);
  const cashValue = household.accounts
    .filter((a) => getAccountTaxWrapper(a.type) === "cash")
    .reduce((s, a) => s + a.currentValue, 0);
  const pbValue = household.accounts
    .filter((a) => getAccountTaxWrapper(a.type) === "premium_bonds")
    .reduce((s, a) => s + a.currentValue, 0);
  const propertyValue = household.properties.reduce((s, p) => s + p.estimatedValue, 0);
  const mortgageBalance = household.properties.reduce((s, p) => s + p.mortgageBalance, 0);
  const propertyEquity = Math.max(0, propertyValue - mortgageBalance);
  const inEstate = propertyEquity + isaValue + giaValue + cashValue + pbValue;

  const giftsWithin7 = ihtConfig.gifts
    .filter((g) => yearsSince(g.date) < 7)
    .reduce((s, g) => s + g.amount, 0);

  const ihtResult = calculateIHT(
    inEstate,
    household.persons.length,
    giftsWithin7,
    ihtConfig.passingToDirectDescendants
  );

  const ihtRows: Record<string, string | number>[] = [
    { Item: "Total Net Worth", "Value (£)": curr(grandTotal) },
    { Item: "Property Value", "Value (£)": curr(propertyValue) },
    ...(mortgageBalance > 0 ? [{ Item: "Mortgage Balance", "Value (£)": curr(-mortgageBalance) }] : []),
    { Item: "Pension (Outside Estate)", "Value (£)": curr(pensionValue) },
    { Item: "ISA (In Estate)", "Value (£)": curr(isaValue) },
    { Item: "GIA (In Estate)", "Value (£)": curr(giaValue) },
    { Item: "Cash (In Estate)", "Value (£)": curr(cashValue) },
    { Item: "Premium Bonds (In Estate)", "Value (£)": curr(pbValue) },
    { Item: "", "Value (£)": "" },
    { Item: "Estate Value (excl. pensions)", "Value (£)": curr(inEstate) },
    { Item: "", "Value (£)": "" },
    { Item: "Nil Rate Band", "Value (£)": curr(ihtResult.effectiveNRB) },
    { Item: "Residence Nil Rate Band", "Value (£)": curr(ihtResult.effectiveRNRB) },
    { Item: "Combined Threshold", "Value (£)": curr(ihtResult.combinedThreshold) },
    { Item: "Gifts Within 7 Years", "Value (£)": curr(giftsWithin7) },
    { Item: "", "Value (£)": "" },
    { Item: "Taxable Amount", "Value (£)": curr(ihtResult.taxableAmount) },
    { Item: `IHT Payable (${formatPercent(UK_TAX_CONSTANTS.iht.rate)})`, "Value (£)": curr(ihtResult.ihtLiability) },
    { Item: "", "Value (£)": "" },
    { Item: "Passing to Direct Descendants?", "Value (£)": ihtConfig.passingToDirectDescendants ? "Yes" : "No" },
    { Item: "Number of Persons", "Value (£)": household.persons.length },
  ];

  // Gift tracker
  if (ihtConfig.gifts.length > 0) {
    ihtRows.push({ Item: "", "Value (£)": "" }, { Item: "--- Gift Tracker ---", "Value (£)": "" });
    for (const gift of ihtConfig.gifts) {
      const yrs = yearsSince(gift.date);
      ihtRows.push({
        Item: `${gift.description} (${gift.date})`,
        "Value (£)": `${formatCurrency(gift.amount)} — ${yrs.toFixed(1)} years ago ${yrs >= 7 ? "(FALLEN OUT)" : ""}`,
      });
    }
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ihtRows), "IHT");

  // ============================
  // Sheet 8: CGT & Bed & ISA
  // ============================
  const cgtRows: Record<string, string | number>[] = [];
  for (const person of household.persons) {
    const personAccounts = household.accounts.filter((a) => a.personId === person.id);
    const giaAccounts = personAccounts.filter((a) => a.type === "gia");
    const personGia = giaAccounts.reduce((s, a) => s + a.currentValue, 0);
    const gains = getUnrealisedGains(giaAccounts);
    const totalGain = gains.reduce((s, g) => s + g.unrealisedGain, 0);
    const inc = household.income.find((i) => i.personId === person.id);
    const bonus = household.bonusStructures.find((b) => b.personId === person.id);
    const cgtRate = inc
      ? determineCgtRate(inc.grossSalary + (bonus?.cashBonusAnnual ?? 0), inc.employeePensionContribution, inc.pensionContributionMethod)
      : UK_TAX_CONSTANTS.cgt.basicRate;
    const bedISA = calculateBedAndISA(totalGain, UK_TAX_CONSTANTS.cgt.annualExemptAmount, cgtRate);
    const breakEven = calculateBedAndISABreakEven(bedISA.cgtCost, personGia, cgtRate);

    cgtRows.push(
      { Person: person.name, Item: "GIA Value", "Value": curr(personGia) },
      { Person: "", Item: "Unrealised Gain", "Value": curr(totalGain) },
      { Person: "", Item: "CGT Rate", "Value": formatPercent(cgtRate) },
      { Person: "", Item: "Annual Exempt Amount", "Value": curr(UK_TAX_CONSTANTS.cgt.annualExemptAmount) },
      { Person: "", Item: "CGT Cost of Transfer", "Value": curr(bedISA.cgtCost) },
      { Person: "", Item: "Break-even Period", "Value": bedISA.cgtCost === 0 ? "Immediate" : `~${breakEven} years` },
      { Person: "", Item: "", "Value": "" },
    );
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cgtRows), "CGT & Bed ISA");

  // ============================
  // Sheet 9: Committed Outgoings (with SUM formula)
  // ============================
  const outgoingItems = household.committedOutgoings.map((o) => ({
    Category: o.category as string,
    Label: o.label || o.category,
    Amount: curr(o.amount),
    Frequency: o.frequency as string,
    "Annual (£)": curr(annualiseOutgoing(o.amount, o.frequency)),
  }));
  const totalOutgoings = outgoingItems.reduce((s, r) => s + r["Annual (£)"], 0);
  const outgoingDataCount = outgoingItems.length;
  const outgoingRows = [
    ...outgoingItems,
    { Category: "TOTAL", Label: "", Amount: "" as string | number, Frequency: "", "Annual (£)": 0 as number },
  ];
  const outgoingsSheet = XLSX.utils.json_to_sheet(outgoingRows);
  // SUM formula for annual total
  const oTotalRow = outgoingDataCount + 2;
  setFormula(outgoingsSheet, `E${oTotalRow}`, `SUM(E2:E${oTotalRow - 1})`);
  XLSX.utils.book_append_sheet(wb, outgoingsSheet, "Outgoings");

  // ============================
  // Sheet 10: Tax Efficiency
  // ============================
  const totISA = household.contributions
    .filter((c) => c.target === "isa")
    .reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0);
  const discPension = household.contributions
    .filter((c) => c.target === "pension")
    .reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0);
  const empPension = household.income.reduce(
    (s, i) => s + i.employeePensionContribution + i.employerPensionContribution,
    0
  );
  const totPension = discPension + empPension;
  const totGIA = household.contributions
    .filter((c) => c.target === "gia")
    .reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0);
  const taxEffScore = calculateTaxEfficiencyScore(totISA, totPension, totGIA);

  const effRows: Record<string, string | number>[] = [
    { Item: "ISA Contributions (Annual)", "Value (£)": curr(totISA) },
    { Item: "Pension Contributions (Total Annual)", "Value (£)": curr(totPension) },
    { Item: "  - Employment (Employee + Employer)", "Value (£)": curr(empPension) },
    { Item: "  - Discretionary", "Value (£)": curr(discPension) },
    { Item: "GIA Contributions (Annual)", "Value (£)": curr(totGIA) },
    { Item: "Total Annual Savings", "Value (£)": curr(totISA + totPension + totGIA) },
    { Item: "Tax-Advantaged (ISA + Pension)", "Value (£)": curr(totISA + totPension) },
    { Item: "Tax Efficiency Score", "Value (£)": formatPercent(taxEffScore) },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(effRows), "Tax Efficiency");

  // ============================
  // Sheet 11: Recommendations
  // ============================
  const recs = generateRecommendations(household);
  const recRows = recs.map((r) => ({
    Priority: r.priority.toUpperCase(),
    Title: r.title,
    Person: r.personName ?? "Household",
    Description: r.description,
    Impact: r.impact,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recRows), "Recommendations");

  // ============================
  // Sheet 12: Properties
  // ============================
  if (household.properties.length > 0) {
    const propRows = household.properties.map((p) => {
      const equity = getPropertyEquity(p);
      const owners = p.ownerPersonIds
        .map((id) => getPersonName(id))
        .join(", ");
      const annualPayment = getAnnualMortgagePayment(p);
      const remainingMonths = getMortgageRemainingMonths(p);

      return {
        Property: p.label,
        Owners: owners,
        "Estimated Value (£)": curr(p.estimatedValue),
        "Mortgage Balance (£)": curr(p.mortgageBalance),
        "Equity (£)": curr(equity),
        "Appreciation Rate": p.appreciationRate ? formatPercent(p.appreciationRate) : "—",
        "Mortgage Rate": p.mortgageRate ? formatPercent(p.mortgageRate) : "—",
        "Mortgage Term (years)": p.mortgageTerm ?? "—",
        "Remaining (months)": remainingMonths > 0 ? remainingMonths : "—",
        "Annual Payment (£)": annualPayment > 0 ? curr(annualPayment) : "—",
      };
    });

    const totalValue = household.properties.reduce((s, p) => s + p.estimatedValue, 0);
    const totalMortgage = household.properties.reduce((s, p) => s + p.mortgageBalance, 0);
    const totalEquity = household.properties.reduce((s, p) => s + getPropertyEquity(p), 0);
    propRows.push({
      Property: "TOTAL",
      Owners: "",
      "Estimated Value (£)": curr(totalValue),
      "Mortgage Balance (£)": curr(totalMortgage),
      "Equity (£)": curr(totalEquity),
      "Appreciation Rate": "",
      "Mortgage Rate": "",
      "Mortgage Term (years)": "" as string | number,
      "Remaining (months)": "" as string | number,
      "Annual Payment (£)": "" as string | number,
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(propRows), "Properties");
  }

  // ============================
  // Sheet 13: Children & School Fees
  // ============================
  if (household.children.length > 0) {
    const childRows: Record<string, string | number>[] = [];
    for (const child of household.children) {
      const yearsRemaining = calculateSchoolYearsRemaining(child);
      const totalCost = calculateTotalSchoolFeeCost(child);
      const startDate = calculateSchoolStartDate(child);
      const endDate = calculateSchoolEndDate(child);

      childRows.push(
        { Item: child.name, "Value": "" },
        { Item: "  Date of Birth", "Value": formatDate(child.dateOfBirth) },
        { Item: "  Annual Fee", "Value": curr(child.schoolFeeAnnual) },
        { Item: "  Fee Inflation Rate", "Value": child.feeInflationRate ? formatPercent(child.feeInflationRate) : "0%" },
        { Item: "  School Start", "Value": `Age ${child.schoolStartAge} (${formatDate(startDate)})` },
        { Item: "  School End", "Value": `Age ${child.schoolEndAge} (${formatDate(endDate)})` },
        { Item: "  Years Remaining", "Value": yearsRemaining },
        { Item: "  Total Remaining Cost", "Value": curr(totalCost) },
        { Item: "", "Value": "" },
      );
    }

    const totalAllChildren = household.children.reduce(
      (s, c) => s + calculateTotalSchoolFeeCost(c),
      0
    );
    childRows.push({ Item: "TOTAL School Fee Cost", "Value": curr(totalAllChildren) });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(childRows), "Children & Fees");
  }

  // ============================
  // Sheet 14: Snapshot History
  // ============================
  if (snapshots && snapshots.snapshots.length > 0) {
    const snapRows = snapshots.snapshots
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        const row: Record<string, string | number> = {
          Date: formatDate(s.date),
          "Total Net Worth (£)": curr(s.totalNetWorth),
        };
        for (const bp of s.byPerson) {
          row[`${getPersonName(bp.personId)} (£)`] = curr(bp.value);
        }
        for (const bw of s.byWrapper) {
          row[`${bw.wrapper.toUpperCase()} (£)`] = curr(bw.value);
        }
        return row;
      });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(snapRows), "Snapshot History");
  }

  // ============================
  // Sheet 15: 24-Month Cash Flow (with running cash balance)
  // ============================
  const cashFlowMonths = generateCashFlowTimeline(household);
  if (cashFlowMonths.length > 0) {
    // Starting cash position for running balance
    const startingCash = household.accounts
      .filter((a) => ["cash_savings", "cash_isa", "premium_bonds"].includes(a.type))
      .reduce((s, a) => s + a.currentValue, 0);

    // Check if mortgage is included in committed outgoings
    const hasMortgageOutgoing = household.committedOutgoings.some((o) => o.category === "mortgage");
    const mortgageAnnualPayment = household.properties.reduce((s, p) => s + getAnnualMortgagePayment(p), 0);
    const mortgageMonthly = mortgageAnnualPayment / 12;

    const cfRows = cashFlowMonths.map((m) => ({
      Month: m.month,
      "Salary Net (£)": curr(m.salary),
      "Bonus Net (£)": curr(m.bonus),
      "Vesting Net (£)": curr(m.deferredVesting),
      "Total Income (£)": 0 as number, // formula
      "Committed Outgoings (£)": curr(m.committedOutgoings),
      "Lifestyle (£)": curr(m.lifestyleSpending),
      ...(!hasMortgageOutgoing && mortgageMonthly > 0
        ? { "Mortgage (£)": curr(mortgageMonthly) }
        : {}),
      "Total Outgoings (£)": 0 as number, // formula
      "Net Cash Flow (£)": 0 as number, // formula
      "Running Cash Balance (£)": 0 as number, // formula
    }));

    const cfSheet = XLSX.utils.json_to_sheet(cfRows);

    // Column layout depends on whether mortgage column exists
    const hasMortgageCol = !hasMortgageOutgoing && mortgageMonthly > 0;
    const totalOutCol = hasMortgageCol ? "I" : "H";
    const netCashCol = hasMortgageCol ? "J" : "I";
    const runBalCol = hasMortgageCol ? "K" : "J";
    const lastDataCol = runBalCol;

    // Inject formulas per row
    for (let i = 0; i < cfRows.length; i++) {
      const r = i + 2; // 1-indexed, skip header
      setFormula(cfSheet, `E${r}`, `SUM(B${r}:D${r})`); // Total Income
      if (hasMortgageCol) {
        setFormula(cfSheet, `${totalOutCol}${r}`, `SUM(F${r}:H${r})`); // Total Outgoings (committed+lifestyle+mortgage)
      } else {
        setFormula(cfSheet, `${totalOutCol}${r}`, `SUM(F${r}:G${r})`); // Total Outgoings (committed+lifestyle)
      }
      setFormula(cfSheet, `${netCashCol}${r}`, `E${r}-${totalOutCol}${r}`); // Net Cash Flow
      // Running cash balance: starting cash + cumulative net cash flow
      if (i === 0) {
        setFormula(cfSheet, `${runBalCol}${r}`, `${curr(startingCash)}+${netCashCol}${r}`);
      } else {
        setFormula(cfSheet, `${runBalCol}${r}`, `${runBalCol}${r - 1}+${netCashCol}${r}`);
      }
    }

    // Totals row
    const cfTotalRow = cfRows.length + 2;
    cfSheet[`A${cfTotalRow}`] = { t: "s", v: "24-MONTH TOTAL" };
    for (const col of ["B", "C", "D", "E", "F", "G"]) {
      setFormula(cfSheet, `${col}${cfTotalRow}`, `SUM(${col}2:${col}${cfTotalRow - 1})`);
    }
    if (hasMortgageCol) {
      setFormula(cfSheet, `H${cfTotalRow}`, `SUM(H2:H${cfTotalRow - 1})`);
    }
    setFormula(cfSheet, `${totalOutCol}${cfTotalRow}`, `SUM(${totalOutCol}2:${totalOutCol}${cfTotalRow - 1})`);
    setFormula(cfSheet, `${netCashCol}${cfTotalRow}`, `SUM(${netCashCol}2:${netCashCol}${cfTotalRow - 1})`);

    // Summary metrics below the data
    const emergencyTarget = household.emergencyFund.monthlyEssentialExpenses * household.emergencyFund.targetMonths;

    let summaryRow = cfTotalRow + 1;
    cfSheet[`A${summaryRow}`] = { t: "s", v: "Starting Cash Balance" };
    cfSheet[`B${summaryRow}`] = { t: "n", v: curr(startingCash) };

    summaryRow++;
    cfSheet[`A${summaryRow}`] = { t: "s", v: "MIN Cash Balance (month)" };
    setFormula(cfSheet, `B${summaryRow}`, `MIN(${runBalCol}2:${runBalCol}${cfTotalRow - 1})`);
    const minBalRow = summaryRow;

    summaryRow++;
    cfSheet[`A${summaryRow}`] = { t: "s", v: "Lowest Balance Month" };
    setFormula(cfSheet, `B${summaryRow}`, `INDEX(A2:A${cfTotalRow - 1},MATCH(B${minBalRow},${runBalCol}2:${runBalCol}${cfTotalRow - 1},0))`);

    summaryRow++;
    cfSheet[`A${summaryRow}`] = { t: "s", v: "Emergency Fund Target" };
    cfSheet[`B${summaryRow}`] = { t: "n", v: curr(emergencyTarget) };

    summaryRow++;
    cfSheet[`A${summaryRow}`] = { t: "s", v: "Buffer Margin (MIN - Target)" };
    setFormula(cfSheet, `B${summaryRow}`, `B${minBalRow}-B${summaryRow - 1}`);

    summaryRow++;
    cfSheet[`A${summaryRow}`] = { t: "s", v: "Months with Negative Cash Flow" };
    setFormula(cfSheet, `B${summaryRow}`, `COUNTIF(${netCashCol}2:${netCashCol}${cfTotalRow - 1},"<0")`);

    summaryRow++;
    cfSheet[`A${summaryRow}`] = { t: "s", v: "Months with Positive Cash Flow" };
    setFormula(cfSheet, `B${summaryRow}`, `COUNTIF(${netCashCol}2:${netCashCol}${cfTotalRow - 1},">0")`);

    if (!hasMortgageOutgoing && mortgageMonthly > 0) {
      summaryRow++;
      cfSheet[`A${summaryRow}`] = { t: "s", v: "Note: Mortgage column added (not in committed outgoings)" };
    }
    cfSheet["!ref"] = `A1:${lastDataCol}${summaryRow}`;

    XLSX.utils.book_append_sheet(wb, cfSheet, "24-Month Cash Flow");
  }

  // ============================
  // Sheet 16: Deferred Bonus Schedule (with net-of-tax estimates)
  // ============================
  if (household.bonusStructures.some((b) => getDeferredBonus(b) > 0)) {
    const bonusRows: Record<string, string | number>[] = [];

    for (const bonus of household.bonusStructures) {
      const deferred = getDeferredBonus(bonus);
      if (deferred <= 0) continue;
      const personName = getPersonName(bonus.personId);
      const person = household.persons.find((p) => p.id === bonus.personId);
      const tranches = generateDeferredTranches(bonus);
      const totalProjected = totalProjectedDeferredValue(bonus);
      const inc = household.income.find((i) => i.personId === bonus.personId);

      bonusRows.push(
        { Item: `--- ${personName} ---`, "Value": "" },
        { Item: "Total Bonus (Annual)", "Value": curr(bonus.totalBonusAnnual) },
        { Item: "Cash Bonus (Annual)", "Value": curr(bonus.cashBonusAnnual) },
        { Item: "Deferred (Annual)", "Value": curr(deferred) },
        { Item: "Vesting Period", "Value": `${bonus.vestingYears} years` },
        { Item: "Vesting Gap", "Value": `${bonus.vestingGapYears ?? 0} years` },
        { Item: "Est. Annual Return", "Value": formatPercent(bonus.estimatedAnnualReturn) },
        { Item: "Total Projected Gross Value", "Value": curr(totalProjected) },
        { Item: "", "Value": "" },
      );

      // Group tranches by vesting month for combined marginal tax calculation
      // (when two tranches vest same month, second is taxed at higher marginal rate)
      const tranchesByMonth = new Map<string, typeof tranches>();
      for (const t of tranches) {
        const key = t.vestingDate.slice(0, 7); // YYYY-MM
        const group = tranchesByMonth.get(key) ?? [];
        group.push(t);
        tranchesByMonth.set(key, group);
      }

      bonusRows.push({ Item: "  Tranche Schedule:", "Value": "" });
      bonusRows.push({ Item: "  Vesting Date", "Value": "Gross → Est. Tax+NI → Net in Hand" });

      let totalEstNet = 0;
      let totalEstGross = 0;
      let totalEstTax = 0;

      for (const [, monthTranches] of tranchesByMonth) {
        // Compute gross projected value for all tranches in this month
        const projected = monthTranches.map((t) => ({
          tranche: t,
          gross: projectTrancheGrossValue(t),
        }));
        const combinedGross = projected.reduce((s, p) => s + p.gross, 0);

        // Calculate marginal tax on combined gross (grown salary + student loan)
        let combinedTax = 0;
        let combinedNet = combinedGross;
        if (inc) {
          // Grow salary to vesting date for accurate marginal rate
          const vestDate = new Date(monthTranches[0].vestingDate);
          const yearsToVest = Math.max(0, (vestDate.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000));
          const baseSalary = inc.grossSalary * Math.pow(1 + (inc.salaryGrowthRate ?? 0), yearsToVest);
          const pensionContrib = inc.employeePensionContribution;
          const pensionMethod = inc.pensionContributionMethod;
          const taxOnBase = calculateIncomeTax(baseSalary, pensionContrib, pensionMethod).tax;
          const niOnBase = calculateNI(baseSalary, pensionContrib, pensionMethod).ni;
          const taxOnCombined = calculateIncomeTax(baseSalary + combinedGross, pensionContrib, pensionMethod).tax;
          const niOnCombined = calculateNI(baseSalary + combinedGross, pensionContrib, pensionMethod).ni;
          // Include marginal student loan deduction
          const studentLoanPlan = person?.studentLoanPlan ?? "none";
          const slGross = pensionMethod === "salary_sacrifice" ? baseSalary - pensionContrib : baseSalary;
          const slOnBase = calculateStudentLoan(slGross, studentLoanPlan);
          const slOnCombined = calculateStudentLoan(slGross + combinedGross, studentLoanPlan);
          const marginalSL = slOnCombined - slOnBase;
          combinedTax = (taxOnCombined - taxOnBase) + (niOnCombined - niOnBase) + marginalSL;
          combinedNet = Math.max(0, combinedGross - combinedTax);
        }

        totalEstGross += combinedGross;
        totalEstTax += combinedTax;
        totalEstNet += combinedNet;

        // Show individual tranches within the month group
        if (projected.length === 1) {
          const p = projected[0];
          bonusRows.push({
            Item: `  ${formatDate(p.tranche.vestingDate)}`,
            "Value": `${formatCurrency(p.gross)} → ${formatCurrency(combinedTax)} tax → ${formatCurrency(combinedNet)} net`,
          });
        } else {
          // Multiple tranches same month — show each and the combined
          for (const p of projected) {
            bonusRows.push({
              Item: `  ${formatDate(p.tranche.vestingDate)} (tranche)`,
              "Value": `${formatCurrency(p.gross)} gross`,
            });
          }
          bonusRows.push({
            Item: `  Combined (${projected.length} tranches)`,
            "Value": `${formatCurrency(combinedGross)} → ${formatCurrency(combinedTax)} tax → ${formatCurrency(combinedNet)} net`,
          });
        }
      }

      bonusRows.push(
        { Item: "", "Value": "" },
        { Item: "  Total Gross", "Value": curr(totalEstGross) },
        { Item: "  Total Est. Tax + NI", "Value": curr(totalEstTax) },
        { Item: "  Total Net After Tax", "Value": curr(totalEstNet) },
        { Item: "  Note", "Value": "Tax: marginal rate on combined tranches per month, on top of base salary" },
      );

      bonusRows.push({ Item: "", "Value": "" });
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bonusRows), "Deferred Bonus");
  }

  // ============================
  // Sheet 17: Free Cash Summary (school fees separated from other outgoings)
  // ============================
  {
    const propertyEquityTotal = household.properties.reduce((s, p) => s + getPropertyEquity(p), 0);
    const totalSchoolFees = household.children.reduce((s, c) => s + calculateTotalSchoolFeeCost(c), 0);

    // Split committed outgoings: school fees vs mortgage vs other
    const schoolFeeOutgoings = household.committedOutgoings.filter((o) => o.linkedChildId);
    const mortgageOutgoings = household.committedOutgoings.filter((o) => o.category === "mortgage");
    const otherOutgoings = household.committedOutgoings.filter((o) => !o.linkedChildId && o.category !== "mortgage");
    const annualSchoolFees = schoolFeeOutgoings.reduce(
      (s, o) => s + annualiseOutgoing(o.amount, o.frequency), 0
    );
    const annualMortgageFromOutgoings = mortgageOutgoings.reduce(
      (s, o) => s + annualiseOutgoing(o.amount, o.frequency), 0
    );
    // If mortgage is in property data but not in committed outgoings, include it
    const annualMortgageFromProperty = household.properties.reduce(
      (s, p) => s + getAnnualMortgagePayment(p), 0
    );
    // Use the higher of committed outgoings vs property-derived to avoid under-counting multi-property mortgages
    const annualMortgage = Math.max(annualMortgageFromOutgoings, annualMortgageFromProperty);
    const mortgageSource = annualMortgageFromOutgoings > 0
      ? (annualMortgageFromProperty > annualMortgageFromOutgoings ? "property data (exceeds committed)" : "from committed outgoings")
      : "from property data";
    const annualOtherCommitted = otherOutgoings.reduce(
      (s, o) => s + annualiseOutgoing(o.amount, o.frequency), 0
    );
    const annualLifestyle = household.emergencyFund.monthlyLifestyleSpending * 12;
    const annualTotalSpend = annualSchoolFees + annualMortgage + annualOtherCommitted + annualLifestyle;

    const cashAccounts = household.accounts
      .filter((a) => ["cash_savings", "cash_isa", "premium_bonds"].includes(a.type))
      .reduce((s, a) => s + a.currentValue, 0);
    const accessibleWealth = household.accounts
      .filter((a) => getAccountTaxWrapper(a.type) !== "pension")
      .reduce((s, a) => s + a.currentValue, 0);
    const monthsRunway = annualTotalSpend > 0 ? (cashAccounts / (annualTotalSpend / 12)) : 999;

    const lastFeeYear = findLastSchoolFeeYear(household.children);
    const yearsUntilFeesEnd = lastFeeYear ? Math.max(0, lastFeeYear - new Date().getFullYear()) : 0;
    const totalNetWorthWithProperty = grandTotal + propertyEquityTotal;

    const freeRows: Record<string, string | number>[] = [
      { Item: `Valuation Date: ${reportDate}`, "Value (£)": "" },
      { Item: "", "Value (£)": "" },
      { Item: "--- Liquid Position ---", "Value (£)": "" },
      { Item: "Liquid Cash (Cash + Cash ISA + Premium Bonds)", "Value (£)": curr(cashAccounts) },
      { Item: "Accessible Wealth (non-pension)", "Value (£)": curr(accessibleWealth) },
      { Item: "Total Net Worth (incl. property)", "Value (£)": curr(totalNetWorthWithProperty) },
      { Item: "", "Value (£)": "" },
      { Item: "--- Annual Commitments (broken down) ---", "Value (£)": "" },
      { Item: `Mortgage (${mortgageSource})`, "Value (£)": curr(annualMortgage) },
      { Item: "School Fees (annual)", "Value (£)": curr(annualSchoolFees) },
      { Item: "Other Committed Outgoings (annual)", "Value (£)": curr(annualOtherCommitted) },
      { Item: "Lifestyle Spending (annual)", "Value (£)": curr(annualLifestyle) },
      { Item: "Total Annual Spend", "Value (£)": curr(annualTotalSpend) },
      { Item: "", "Value (£)": "" },
      { Item: "--- Survival Metrics ---", "Value (£)": "" },
      { Item: "Cash Runway (months)", "Value (£)": Math.round(monthsRunway) },
      { Item: "Emergency Fund Target", "Value (£)": curr(household.emergencyFund.monthlyEssentialExpenses * household.emergencyFund.targetMonths) },
      { Item: "Emergency Fund Gap", "Value (£)": curr(Math.max(0, household.emergencyFund.monthlyEssentialExpenses * household.emergencyFund.targetMonths - cashAccounts)) },
      { Item: "", "Value (£)": "" },
      { Item: "--- Education Exposure ---", "Value (£)": "" },
      { Item: "Total Remaining School Fees (lump)", "Value (£)": curr(totalSchoolFees) },
      { Item: "Years Until Fees End", "Value (£)": yearsUntilFeesEnd > 0 ? yearsUntilFeesEnd : "N/A" },
      { Item: "Annual School Fees Freed Up", "Value (£)": curr(annualSchoolFees) },
      { Item: "", "Value (£)": "" },
      { Item: "--- Net Position ---", "Value (£)": "" },
      { Item: "Net Worth", "Value (£)": curr(totalNetWorthWithProperty) },
      { Item: "Less: Total Remaining School Fees", "Value (£)": curr(-totalSchoolFees) },
      { Item: "Net Worth After Education Liability", "Value (£)": curr(totalNetWorthWithProperty - totalSchoolFees) },
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(freeRows), "Free Cash Summary");
  }

  // ============================
  // Sheet 18: Growth Projections
  // ============================
  {
    const midRate = getMidScenarioRate(household.retirement.scenarioRates);
    const projRows: Record<string, string | number>[] = [];

    // Salary growth trajectories per person
    projRows.push({ Item: "--- Salary Growth Projections ---", "Value": "" });
    for (const person of household.persons) {
      const inc = household.income.find((i) => i.personId === person.id);
      if (!inc) continue;
      const growthRate = inc.salaryGrowthRate ?? 0;
      const retAge = person.plannedRetirementAge;
      const currentAge = calculateAge(person.dateOfBirth);
      const yearsToRetire = Math.max(0, retAge - currentAge);

      projRows.push({ Item: `${person.name}`, "Value": "" });
      projRows.push({ Item: "  Current Salary", "Value": curr(inc.grossSalary) });
      projRows.push({ Item: "  Growth Rate", "Value": formatPercent(growthRate) });

      // 5-year intervals
      for (let y = 5; y <= yearsToRetire; y += 5) {
        const projected = inc.grossSalary * Math.pow(1 + growthRate, y);
        projRows.push({ Item: `  Salary in ${y} years (age ${currentAge + y})`, "Value": curr(projected) });
      }
      // At retirement
      if (yearsToRetire > 0) {
        const atRetirement = inc.grossSalary * Math.pow(1 + growthRate, yearsToRetire);
        projRows.push({ Item: `  Salary at retirement (age ${retAge})`, "Value": curr(atRetirement) });
      }
      projRows.push({ Item: "", "Value": "" });
    }

    // Pot growth projections
    projRows.push({ Item: "--- Portfolio Growth Projections ---", "Value": "" });
    projRows.push({ Item: `Growth Rate Assumed`, "Value": formatPercent(midRate) });

    const primaryPerson = household.persons.find((p) => p.relationship === "self");
    const currentAge = primaryPerson ? calculateAge(primaryPerson.dateOfBirth) : 35;
    const retAge = primaryPerson?.plannedRetirementAge ?? 60;
    const yearsToRetire = Math.max(0, retAge - currentAge);
    const totalAnnualContribs = household.contributions.reduce(
      (s, c) => s + annualiseContribution(c.amount, c.frequency), 0
    ) + household.income.reduce(
      (s, i) => s + i.employeePensionContribution + i.employerPensionContribution, 0
    );

    projRows.push({ Item: "Current Investable Net Worth", "Value": curr(grandTotal) });
    projRows.push({ Item: "Annual Contributions", "Value": curr(totalAnnualContribs) });

    // 5-year intervals
    for (let y = 5; y <= Math.max(yearsToRetire, 30); y += 5) {
      const projected = projectFinalValue(grandTotal, totalAnnualContribs, midRate, y);
      const label = y <= yearsToRetire ? ` (age ${currentAge + y})` : ` (age ${currentAge + y}, post-retirement)`;
      projRows.push({ Item: `  Projected in ${y} years${label}`, "Value": curr(projected) });
    }

    // Post-school-fees inflection point (Priya's key metric)
    const lastFeeYear = findLastSchoolFeeYear(household.children);
    if (lastFeeYear) {
      const yearsUntilFeesEnd = Math.max(0, lastFeeYear - new Date().getFullYear());
      const feeSavingsRecovered = household.children.reduce(
        (s, c) => s + c.schoolFeeAnnual * Math.pow(1 + (c.feeInflationRate ?? 0), yearsUntilFeesEnd), 0
      );
      projRows.push({ Item: "", "Value": "" });
      projRows.push({ Item: "--- Post-School-Fees Inflection ---", "Value": "" });
      projRows.push({ Item: "School fees end in", "Value": `${yearsUntilFeesEnd} years (${lastFeeYear})` });
      projRows.push({ Item: "Annual savings recovered (inflation-adjusted)", "Value": curr(feeSavingsRecovered) });
      projRows.push({ Item: "Contributions after fees end", "Value": curr(totalAnnualContribs + feeSavingsRecovered) });

      // Projected pot at fee-end, then 5 years after with boosted savings
      const potAtFeeEnd = projectFinalValue(grandTotal, totalAnnualContribs, midRate, yearsUntilFeesEnd);
      projRows.push({ Item: `Projected pot when fees end (${lastFeeYear})`, "Value": curr(potAtFeeEnd) });

      const boostedContribs = totalAnnualContribs + feeSavingsRecovered;

      // Scenario A: All recovered fees → investments
      projRows.push({ Item: "", "Value": "" });
      projRows.push({ Item: "Scenario A: All recovered fees → investments", "Value": "" });
      projRows.push({ Item: "  Additional annual investment", "Value": curr(feeSavingsRecovered) });
      const pot5A = projectFinalValue(potAtFeeEnd, boostedContribs, midRate, 5);
      projRows.push({ Item: `  Pot 5yr after fees end`, "Value": curr(pot5A) });
      const pot10A = projectFinalValue(potAtFeeEnd, boostedContribs, midRate, 10);
      projRows.push({ Item: `  Pot 10yr after fees end`, "Value": curr(pot10A) });

      // Scenario B: 50/50 split between mortgage overpay and investments
      const mortgageBalance = household.properties.reduce((s, p) => s + p.mortgageBalance, 0);
      if (mortgageBalance > 0) {
        const halfToInvest = feeSavingsRecovered / 2;
        const halfContribs = totalAnnualContribs + halfToInvest;
        projRows.push({ Item: "", "Value": "" });
        projRows.push({ Item: "Scenario B: 50% mortgage overpay / 50% invest", "Value": "" });
        projRows.push({ Item: "  To investments", "Value": curr(halfToInvest) });
        projRows.push({ Item: "  To mortgage overpay", "Value": curr(feeSavingsRecovered - halfToInvest) });
        const pot5B = projectFinalValue(potAtFeeEnd, halfContribs, midRate, 5);
        projRows.push({ Item: `  Pot 5yr after fees end`, "Value": curr(pot5B) });
        const pot10B = projectFinalValue(potAtFeeEnd, halfContribs, midRate, 10);
        projRows.push({ Item: `  Pot 10yr after fees end`, "Value": curr(pot10B) });
      }
    }

    // Per-person pension pot projections
    projRows.push({ Item: "", "Value": "" });
    projRows.push({ Item: "--- Per-Person Pension Projections ---", "Value": "" });
    for (const person of household.persons) {
      const personPensionAccounts = household.accounts.filter(
        (a) => a.personId === person.id && getAccountTaxWrapper(a.type) === "pension"
      );
      const personPensionValue = personPensionAccounts.reduce((s, a) => s + a.currentValue, 0);
      const inc = household.income.find((i) => i.personId === person.id);
      const employeePension = inc?.employeePensionContribution ?? 0;
      const employerPension = inc?.employerPensionContribution ?? 0;
      const discretionaryPension = household.contributions
        .filter((c) => c.personId === person.id && c.target === "pension")
        .reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0);
      const totalPersonPensionContrib = employeePension + employerPension + discretionaryPension;
      const personAge = calculateAge(person.dateOfBirth);
      const personRetAge = person.plannedRetirementAge;
      const yearsToPersonRet = Math.max(0, personRetAge - personAge);

      projRows.push({ Item: `${person.name}`, "Value": "" });
      projRows.push({ Item: "  Current Pension Pot", "Value": curr(personPensionValue) });
      projRows.push({ Item: "  Annual Pension Contributions", "Value": curr(totalPersonPensionContrib) });
      projRows.push({ Item: "  Years to Retirement", "Value": yearsToPersonRet });

      if (yearsToPersonRet > 0 && totalPersonPensionContrib > 0) {
        const projectedPot = projectFinalValue(personPensionValue, totalPersonPensionContrib, midRate, yearsToPersonRet);
        projRows.push({ Item: `  Projected Pension at ${personRetAge}`, "Value": curr(projectedPot) });
      } else if (yearsToPersonRet > 0) {
        const projectedPot = projectFinalValue(personPensionValue, 0, midRate, yearsToPersonRet);
        projRows.push({ Item: `  Projected Pension at ${personRetAge} (no contribs)`, "Value": curr(projectedPot) });
      }
      projRows.push({ Item: "", "Value": "" });
    }

    // Combined household pension projection with gap-to-target
    if (household.persons.length > 0) {
      let combinedProjected = 0;

      for (const person of household.persons) {
        const personPensionValue = household.accounts
          .filter((a) => a.personId === person.id && getAccountTaxWrapper(a.type) === "pension")
          .reduce((s, a) => s + a.currentValue, 0);
        const inc = household.income.find((i) => i.personId === person.id);
        const employeePension = inc?.employeePensionContribution ?? 0;
        const employerPension = inc?.employerPensionContribution ?? 0;
        const discretionaryPension = household.contributions
          .filter((c) => c.personId === person.id && c.target === "pension")
          .reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0);
        const personContrib = employeePension + employerPension + discretionaryPension;
        const personAge = calculateAge(person.dateOfBirth);
        const yearsToRet = Math.max(0, person.plannedRetirementAge - personAge);
        const projected = projectFinalValue(personPensionValue, personContrib, midRate, yearsToRet);
        combinedProjected += projected;
      }

      const totalStatePension = calculateHouseholdStatePension(household.persons);
      const requiredPot = calculateAdjustedRequiredPot(
        household.retirement.targetAnnualIncome,
        household.retirement.withdrawalRate,
        household.retirement.includeStatePension,
        totalStatePension
      );
      const gap = requiredPot - combinedProjected;

      const retAges = household.persons.map((p) => `${p.name} at ${p.plannedRetirementAge}`).join(", ");
      projRows.push(
        { Item: "--- Combined Household Pension ---", "Value": "" },
        { Item: `Combined Projected Pension at Retirement (${retAges})`, "Value": curr(combinedProjected) },
        { Item: "Required Pot (from Retirement config)", "Value": curr(requiredPot) },
        { Item: gap > 0 ? "Shortfall" : "Surplus", "Value": curr(Math.abs(gap)) },
        { Item: "", "Value": "" },
      );
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projRows), "Growth Projections");
  }

  // ============================
  // Sheet 19: Vesting Day Planner (all future tranches with cumulative allowance tracking)
  // ============================
  {
    const vestingRows: Record<string, string | number>[] = [];
    let hasVestingData = false;

    for (const person of household.persons) {
      const bonus = household.bonusStructures.find((b) => b.personId === person.id);
      if (!bonus || getDeferredBonus(bonus) <= 0) continue;
      hasVestingData = true;

      const inc = household.income.find((i) => i.personId === person.id);
      const tranches = generateDeferredTranches(bonus);
      const contribs = getPersonContributionTotals(household.contributions, person.id);
      const employeePension = inc?.employeePensionContribution ?? 0;
      const employerPension = inc?.employerPensionContribution ?? 0;
      const totalPensionUsed = employeePension + employerPension + contribs.pensionContribution;

      const grossSalary = inc?.grossSalary ?? 0;
      const cashBonus = bonus.cashBonusAnnual;
      const thresholdIncome = grossSalary + cashBonus;
      const adjustedIncome = thresholdIncome + employerPension;
      const effectiveAllowance = calculateTaperedAnnualAllowance(thresholdIncome, adjustedIncome);

      const emergencyTarget = household.emergencyFund.monthlyEssentialExpenses * household.emergencyFund.targetMonths;
      const totalCash = household.accounts
        .filter((a) => ["cash_savings", "cash_isa", "premium_bonds"].includes(a.type))
        .reduce((s, a) => s + a.currentValue, 0);
      const mortgageBalance = household.properties.reduce((s, p) => s + p.mortgageBalance, 0);

      vestingRows.push(
        { Item: `═══ ${person.name} — Vesting Day Planner ═══`, "Value": "" },
        { Item: `Valuation Date: ${reportDate}`, "Value": "" },
        { Item: "", "Value": "" },
      );

      // Current position
      vestingRows.push(
        { Item: "--- Current Position ---", "Value": "" },
        { Item: "Cash Buffer", "Value": curr(totalCash) },
        { Item: "Emergency Fund Target", "Value": curr(emergencyTarget) },
        { Item: "Mortgage Balance", "Value": curr(mortgageBalance) },
        { Item: "", "Value": "" },
      );

      // Show ALL future tranches with cumulative allowance erosion
      const now = new Date();
      const futureTranches = tranches.filter((t) => new Date(t.vestingDate) > now);

      if (futureTranches.length > 0) {
        vestingRows.push({ Item: "--- Vesting Schedule (tax year aware) ---", "Value": "" });

        // Tax year runs 6 April to 5 April. Determine which tax year a date falls in.
        const getTaxYear = (d: Date): string => {
          const month = d.getMonth(); // 0-indexed
          const day = d.getDate();
          const year = d.getFullYear();
          // Before 6 April = previous tax year
          if (month < 3 || (month === 3 && day < 6)) {
            return `${year - 1}/${year}`;
          }
          return `${year}/${year + 1}`;
        };

        // Track cumulative allowance usage per tax year
        let cumulativeISAUsed = contribs.isaContribution;
        let cumulativePensionUsed = totalPensionUsed;
        let cumulativeCashBuffer = totalCash;
        let currentTaxYear = getTaxYear(now);
        // Track cumulative gross for stacked tranche marginal tax
        let cumulativeGrossThisMonth = 0;
        let currentMonth = "";

        for (let i = 0; i < futureTranches.length; i++) {
          const t = futureTranches[i];
          const vest = new Date(t.vestingDate);
          const grossValue = projectTrancheGrossValue(t);
          const vestMonth = t.vestingDate.slice(0, 7);

          // Reset cumulative gross if different month
          if (vestMonth !== currentMonth) {
            cumulativeGrossThisMonth = 0;
            currentMonth = vestMonth;
          }

          // Check if we've crossed a tax year boundary — reset allowances
          const trancheTaxYear = getTaxYear(vest);
          if (trancheTaxYear !== currentTaxYear) {
            vestingRows.push(
              { Item: "", "Value": "" },
              { Item: `═══ New Tax Year: ${trancheTaxYear} ═══`, "Value": "" },
            );
            cumulativeISAUsed = 0; // Allowances reset
            cumulativePensionUsed = employeePension + employerPension; // Only employment pension carries
            currentTaxYear = trancheTaxYear;
          }

          // Marginal tax on this tranche, stacked on prior tranches this month
          // Grow salary to vesting date for accurate marginal rate
          let netValue = grossValue;
          if (inc) {
            const yearsToVest = Math.max(0, (vest.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000));
            const grownSalary = grossSalary * Math.pow(1 + (inc.salaryGrowthRate ?? 0), yearsToVest);
            const baseWithPrior = grownSalary + cumulativeGrossThisMonth;
            const taxOnPrior = calculateIncomeTax(baseWithPrior, inc.employeePensionContribution, inc.pensionContributionMethod).tax;
            const niOnPrior = calculateNI(baseWithPrior, inc.employeePensionContribution, inc.pensionContributionMethod).ni;
            const taxOnCombined = calculateIncomeTax(baseWithPrior + grossValue, inc.employeePensionContribution, inc.pensionContributionMethod).tax;
            const niOnCombined = calculateNI(baseWithPrior + grossValue, inc.employeePensionContribution, inc.pensionContributionMethod).ni;
            // Include marginal student loan
            const slGross = inc.pensionContributionMethod === "salary_sacrifice" ? baseWithPrior - inc.employeePensionContribution : baseWithPrior;
            const slOnPrior = calculateStudentLoan(slGross, person.studentLoanPlan);
            const slOnCombined = calculateStudentLoan(slGross + grossValue, person.studentLoanPlan);
            const marginalSL = slOnCombined - slOnPrior;
            netValue = Math.max(0, grossValue - (taxOnCombined - taxOnPrior) - (niOnCombined - niOnPrior) - marginalSL);
          }
          cumulativeGrossThisMonth += grossValue;

          vestingRows.push(
            { Item: "", "Value": "" },
            { Item: `--- Tranche ${i + 1}: ${formatDate(t.vestingDate)} (${trancheTaxYear}) ---`, "Value": "" },
            { Item: "Gross Value", "Value": curr(grossValue) },
            { Item: "Est. Net After Tax", "Value": curr(netValue) },
          );

          // Allowance headroom BEFORE this tranche
          const isaRemaining = Math.max(0, isaAllowance - cumulativeISAUsed);
          const pensionRemaining = Math.max(0, effectiveAllowance - cumulativePensionUsed);
          vestingRows.push(
            { Item: `ISA Remaining (${trancheTaxYear})`, "Value": curr(isaRemaining) },
            { Item: `Pension Remaining (${trancheTaxYear})`, "Value": curr(pensionRemaining) },
          );

          // Waterfall allocation for this tranche
          let remaining = netValue;
          vestingRows.push({ Item: "Suggested Allocation:", "Value": "" });

          // Step 1: Cash buffer
          const cashBufferGap = Math.max(0, emergencyTarget - cumulativeCashBuffer);
          const step1 = Math.min(remaining, cashBufferGap);
          if (step1 > 0) {
            vestingRows.push({ Item: "  1. Cash buffer top-up", "Value": curr(step1) });
            remaining -= step1;
            cumulativeCashBuffer += step1;
          } else {
            vestingRows.push({ Item: "  1. Cash buffer — met", "Value": "£0" });
          }

          // Step 2: ISA
          const step2 = Math.min(remaining, isaRemaining);
          vestingRows.push({ Item: "  2. ISA", "Value": curr(step2) });
          remaining -= step2;
          cumulativeISAUsed += step2;

          // Step 3: Pension
          const step3 = Math.min(remaining, pensionRemaining);
          vestingRows.push({ Item: "  3. Pension (tax relief)", "Value": curr(step3) });
          remaining -= step3;
          cumulativePensionUsed += step3;

          // Step 4: Remainder
          if (remaining > 0) {
            vestingRows.push({
              Item: mortgageBalance > 0 ? "  4. Mortgage overpay / GIA" : "  4. GIA",
              "Value": curr(remaining),
            });
          }
        }

        // Year-end summary
        vestingRows.push(
          { Item: "", "Value": "" },
          { Item: "--- Year-End Summary ---", "Value": "" },
          { Item: "Total ISA Used (projected)", "Value": curr(cumulativeISAUsed) },
          { Item: "Total Pension Used (projected)", "Value": curr(cumulativePensionUsed) },
          { Item: "", "Value": "" },
          { Item: "Note", "Value": "Allowance headroom decreases as earlier tranches are deployed." },
          { Item: "Note", "Value": "Tax estimates use cumulative marginal rates — tranches vesting in the same month are stacked on top of salary." },
          { Item: "Note", "Value": "Cash buffer projection does not account for monthly outgoings between vesting dates — review actual balance before acting." },
        );
      }

      vestingRows.push({ Item: "", "Value": "" });
    }

    if (hasVestingData) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vestingRows), "Vesting Day Planner");
    }
  }

  return wb;
}

export default function ExportPage() {
  const { household, snapshots } = useData();
  const scenarioData = useScenarioData();
  const scenarioHousehold = scenarioData.household;

  function exportFullReport() {
    const wb = buildFullWorkbook(household, snapshots);
    downloadWorkbook(wb, `runway-full-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportScenarioComparison() {
    const baseWb = buildFullWorkbook(household, snapshots);
    const scenarioWb = buildFullWorkbook(scenarioHousehold);

    // Merge: take base workbook, add scenario sheets with "Scenario - " prefix
    const wb = baseWb;
    for (const name of scenarioWb.SheetNames) {
      XLSX.utils.book_append_sheet(wb, scenarioWb.Sheets[name], `Scenario - ${name}`.slice(0, 31));
    }
    downloadWorkbook(wb, `runway-scenario-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportNetWorthOnly() {
    const ws = XLSX.utils.json_to_sheet(
      household.accounts.map((a) => ({
        Person: household.persons.find((p) => p.id === a.personId)?.name ?? a.personId,
        "Account Name": a.name,
        Provider: a.provider,
        Type: ACCOUNT_TYPE_LABELS[a.type],
        "Current Value": a.currentValue,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Net Worth");
    downloadWorkbook(wb, "net-worth-snapshot.xlsx");
  }

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader title="Export Data" description="Download comprehensive financial reports as Excel workbooks." />

      {/* Full Report — primary CTA */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/8 via-primary/4 to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            Full Financial Report
          </CardTitle>
          <CardDescription>
            Comprehensive workbook with up to 20 sheets — with live Excel SUM formulas for subtotals and running
            balances. Includes accounts, income &amp; tax (with household tax summary), contributions, allowances,
            retirement, IHT, CGT, outgoings, tax efficiency, recommendations, properties, school fees,
            snapshots, 24-month cash flow (with running balance), deferred bonus (net-of-tax),
            free cash summary, growth projections (per-person pension), and vesting day planner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportFullReport} size="lg" className="w-full gap-2">
            <FileSpreadsheet className="size-4" />
            Download Full Report
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
        {/* Scenario Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scenario Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Exports base data alongside what-if scenario data for side-by-side comparison.
            </p>
            {scenarioData.isScenarioMode ? (
              <Button onClick={exportScenarioComparison} className="w-full" variant="outline">
                Download Comparison
              </Button>
            ) : (
              <div>
                <Button disabled className="w-full" variant="outline">
                  Download Comparison
                </Button>
                <p className="mt-1 text-[11px] text-muted-foreground text-center">
                  Enable a What-If scenario first
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Net Worth Only */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net Worth Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Simple export of all accounts with current values.
            </p>
            <Button onClick={exportNetWorthOnly} className="w-full" variant="outline">
              Download Snapshot
            </Button>
          </CardContent>
        </Card>

        {/* Print */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Printer className="size-4" />
              Print Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Print-optimised PDF via your browser&apos;s &ldquo;Save as PDF&rdquo;.
            </p>
            <Link href="/" className="block">
              <Button variant="outline" className="w-full" onClick={() => setTimeout(() => window.print(), 300)}>
                Print Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Sheets included */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What&apos;s in the Full Report?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[
              "Cover",
              "Summary",
              "Accounts",
              "Wrapper Summary",
              "Income & Tax",
              "Contributions",
              "Allowances",
              "Retirement",
              "IHT",
              "CGT & Bed ISA",
              "Outgoings",
              "Tax Efficiency",
              "Recommendations",
              "Properties",
              "Children & Fees",
              "Snapshot History",
              "24-Month Cash Flow",
              "Deferred Bonus",
              "Free Cash Summary",
              "Growth Projections",
              "Vesting Day Planner",
            ].map((sheet) => (
              <Badge key={sheet} variant="secondary" className="justify-center py-1.5">
                {sheet}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
