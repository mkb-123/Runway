"use client";

import * as XLSX from "xlsx";
import { useData } from "@/context/data-context";
import { useScenarioData } from "@/context/use-scenario-data";
import {
  ACCOUNT_TYPE_LABELS,
  TAX_WRAPPER_LABELS,
  getAccountTaxWrapper,
  getPersonContributionTotals,
  annualiseContribution,
  annualiseOutgoing,
} from "@/types";
import type { TaxWrapper, HouseholdData } from "@/types";
import { getDeferredBonus } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";
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
  calculateProRataStatePension,
  calculateAge,
  calculateTaxEfficiencyScore,
  calculateTaperedAnnualAllowance,
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
import { FileSpreadsheet, Printer } from "lucide-react";
import Link from "next/link";

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

/** Format currency for Excel (just the number, column formatting handles £ sign) */
function curr(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build the full financial report workbook from household data */
function buildFullWorkbook(household: HouseholdData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const getPersonName = (personId: string) =>
    household.persons.find((p) => p.id === personId)?.name ?? personId;

  // ============================
  // Sheet 1: Accounts
  // ============================
  const accountRows = household.accounts.map((a) => ({
    Person: getPersonName(a.personId),
    "Account Name": a.name,
    Provider: a.provider,
    Type: ACCOUNT_TYPE_LABELS[a.type],
    "Tax Wrapper": TAX_WRAPPER_LABELS[getAccountTaxWrapper(a.type)],
    "Current Value (£)": curr(a.currentValue),
  }));

  // Add person subtotals
  for (const person of household.persons) {
    const total = household.accounts
      .filter((a) => a.personId === person.id)
      .reduce((s, a) => s + a.currentValue, 0);
    accountRows.push({
      Person: person.name,
      "Account Name": "SUBTOTAL",
      Provider: "",
      Type: "",
      "Tax Wrapper": "",
      "Current Value (£)": curr(total),
    });
  }
  const grandTotal = household.accounts.reduce((s, a) => s + a.currentValue, 0);
  accountRows.push({
    Person: "TOTAL",
    "Account Name": "GRAND TOTAL",
    Provider: "",
    Type: "",
    "Tax Wrapper": "",
    "Current Value (£)": curr(grandTotal),
  });

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accountRows), "Accounts");

  // ============================
  // Sheet 2: Wrapper Summary
  // ============================
  const wrapperTotals = new Map<TaxWrapper, number>();
  for (const a of household.accounts) {
    const w = getAccountTaxWrapper(a.type);
    wrapperTotals.set(w, (wrapperTotals.get(w) ?? 0) + a.currentValue);
  }
  const wrapperRows = Array.from(wrapperTotals.entries()).map(([wrapper, value]) => ({
    "Tax Wrapper": TAX_WRAPPER_LABELS[wrapper],
    "Value (£)": curr(value),
    "% of Net Worth": grandTotal > 0 ? formatPercent(value / grandTotal) : "0%",
  }));
  wrapperRows.push({
    "Tax Wrapper": "TOTAL",
    "Value (£)": curr(grandTotal),
    "% of Net Worth": "100%",
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wrapperRows), "Wrapper Summary");

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
      { Person: "", Item: "Total Gross", "Value (£)": curr(totalGross) },
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
  const isaAllowance = UK_TAX_CONSTANTS.isaAnnualAllowance;

  for (const person of household.persons) {
    const inc = household.income.find((i) => i.personId === person.id);
    const discretionary = getPersonContributionTotals(household.contributions, person.id);
    const employeePension = inc?.employeePensionContribution ?? 0;
    const employerPension = inc?.employerPensionContribution ?? 0;
    const totalPensionUsed = employeePension + employerPension + discretionary.pensionContribution;

    // Tapered allowance
    const grossSalary = inc?.grossSalary ?? 0;
    const adjustedIncome = grossSalary + (inc?.employerPensionContribution ?? 0);
    const effectiveAllowance = calculateTaperedAnnualAllowance(grossSalary, adjustedIncome);

    pensionRows.push(
      { Person: person.name, Item: "Employee Pension", "Value (£)": curr(employeePension) },
      { Person: "", Item: "Employer Pension", "Value (£)": curr(employerPension) },
      { Person: "", Item: "Discretionary Pension", "Value (£)": curr(discretionary.pensionContribution) },
      { Person: "", Item: "TOTAL Pension Used", "Value (£)": curr(totalPensionUsed) },
      { Person: "", Item: "Standard Annual Allowance", "Value (£)": curr(pensionAllowance) },
      { Person: "", Item: "Tapered Annual Allowance", "Value (£)": curr(effectiveAllowance) },
      { Person: "", Item: "Effective Allowance", "Value (£)": curr(effectiveAllowance) },
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
  const totalStatePension = household.persons.reduce(
    (sum, p) => sum + calculateProRataStatePension(p.niQualifyingYears ?? 0),
    0
  );
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
  const grossIncome = household.income.reduce((s, i) => s + i.grossSalary, 0);
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
    const required = calculateRequiredSavings(grandTotal, requiredPot, retAge - currentAge, midRate);
    retRows.push({
      Item: `To reach ${formatCurrency(target * 1000)} target`,
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
  const inEstate = ihtConfig.estimatedPropertyValue + isaValue + giaValue + cashValue + pbValue;

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
    { Item: "Property Value", "Value (£)": curr(ihtConfig.estimatedPropertyValue) },
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
    const cgtRate = inc
      ? determineCgtRate(inc.grossSalary, inc.employeePensionContribution, inc.pensionContributionMethod)
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
  // Sheet 9: Committed Outgoings
  // ============================
  const outgoingItems = household.committedOutgoings.map((o) => ({
    Category: o.category as string,
    Label: o.label || o.category,
    Amount: curr(o.amount),
    Frequency: o.frequency as string,
    "Annual (£)": annualiseOutgoing(o.amount, o.frequency),
  }));
  const totalOutgoings = outgoingItems.reduce((s, r) => s + r["Annual (£)"], 0);
  const outgoingRows = [
    ...outgoingItems.map((r) => ({ ...r, "Annual (£)": curr(r["Annual (£)"]) })),
    { Category: "TOTAL", Label: "", Amount: "", Frequency: "", "Annual (£)": curr(totalOutgoings) },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(outgoingRows), "Outgoings");

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

  return wb;
}

export default function ExportPage() {
  const { household } = useData();
  const scenarioData = useScenarioData();
  const scenarioHousehold = scenarioData.household;

  function exportFullReport() {
    const wb = buildFullWorkbook(household);
    downloadWorkbook(wb, `runway-full-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportScenarioComparison() {
    const baseWb = buildFullWorkbook(household);
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
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader title="Export Data" description="Download comprehensive financial reports as Excel workbooks." />

      {/* Full Report — primary CTA */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/8 via-primary/4 to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            Full Financial Report
          </CardTitle>
          <CardDescription>
            Comprehensive workbook with 11 sheets covering all computations: accounts, income &amp; tax,
            contributions, pension allowances, retirement analysis, IHT, CGT &amp; Bed &amp; ISA,
            committed outgoings, tax efficiency, and recommendations.
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
