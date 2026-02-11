import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  getHouseholdData,
  getTransactionsData,
  getFundById,
  getAccountById,
  getPersonById,
  getAccountsForPerson,
} from "@/lib/data";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import {
  calculateGainsForTaxYear,
  calculateSection104Pool,
  getUnrealisedGains,
  getTaxYear,
} from "@/lib/cgt";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";

export default function CGTPage() {
  const household = getHouseholdData();
  const { transactions } = getTransactionsData();
  const { persons, accounts } = household;

  const currentTaxYear = "2024/25";
  const annualAllowance = UK_TAX_CONSTANTS.cgt.annualExemptAmount;

  // Filter transactions for GIA accounts only (CGT only applies to GIA)
  const giaAccounts = accounts.filter((a) => a.type === "gia");
  const giaAccountIds = new Set(giaAccounts.map((a) => a.id));
  const giaTransactions = transactions.filter((tx) =>
    giaAccountIds.has(tx.accountId)
  );

  // Calculate gains for the current tax year
  const taxYearGains = calculateGainsForTaxYear(giaTransactions, currentTaxYear);
  const allowanceRemaining = Math.max(
    0,
    annualAllowance - Math.max(0, taxYearGains.netGain)
  );

  // Section 104 pools
  const section104Pools = calculateSection104Pool(giaTransactions);

  // Unrealised gains across all GIA accounts
  const unrealisedGains = getUnrealisedGains(giaAccounts, giaTransactions);

  // Sell transactions in the current tax year
  const currentYearSells = giaTransactions.filter(
    (tx) => tx.type === "sell" && getTaxYear(tx.date) === currentTaxYear
  );

  // Group unrealised gains and allowance usage by person
  const personGains = persons.map((person) => {
    const personGiaAccounts = giaAccounts.filter(
      (a) => a.personId === person.id
    );
    const personGiaAccountIds = new Set(personGiaAccounts.map((a) => a.id));
    const personGiaTransactions = giaTransactions.filter((tx) =>
      personGiaAccountIds.has(tx.accountId)
    );

    const personTaxYearGains = calculateGainsForTaxYear(
      personGiaTransactions,
      currentTaxYear
    );

    const personUnrealisedGains = unrealisedGains.filter((ug) =>
      personGiaAccountIds.has(ug.accountId)
    );

    const totalUnrealised = personUnrealisedGains.reduce(
      (sum, ug) => sum + ug.unrealisedGain,
      0
    );

    const usedAllowance = Math.max(0, personTaxYearGains.netGain);
    const remainingAllowance = Math.max(0, annualAllowance - usedAllowance);

    // Optimal crystallisation: crystallise gains up to the remaining allowance
    const optimalCrystallise = Math.min(
      Math.max(0, totalUnrealised),
      remainingAllowance
    );

    return {
      person,
      personTaxYearGains,
      personUnrealisedGains,
      totalUnrealised,
      usedAllowance,
      remainingAllowance,
      optimalCrystallise,
    };
  });

  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Capital Gains Tax</h1>
        <p className="text-muted-foreground mt-1">
          Track realised and unrealised gains across your General Investment
          Accounts.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>CGT Annual Allowance</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(annualAllowance)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">Per person, per tax year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Tax Year</CardDescription>
            <CardTitle className="text-2xl">{currentTaxYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">6 April 2024 - 5 April 2025</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Realised Gains This Year</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(taxYearGains.netGain)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {taxYearGains.totalGains > 0 && (
                <Badge variant="default" className="bg-green-600">
                  Gains {formatCurrency(taxYearGains.totalGains)}
                </Badge>
              )}
              {taxYearGains.totalLosses > 0 && (
                <Badge variant="destructive">
                  Losses {formatCurrency(taxYearGains.totalLosses)}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Allowance Remaining</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(allowanceRemaining)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              {taxYearGains.taxableGain > 0
                ? `Taxable gain: ${formatCurrency(taxYearGains.taxableGain)}`
                : "No taxable gain this year"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Realised Gains Table */}
      <Card>
        <CardHeader>
          <CardTitle>Realised Gains - {currentTaxYear}</CardTitle>
          <CardDescription>
            Disposals in the current tax year with HMRC matching rules applied
          </CardDescription>
        </CardHeader>
        <CardContent>
          {taxYearGains.disposals.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead className="text-right">Units Sold</TableHead>
                  <TableHead className="text-right">Proceeds</TableHead>
                  <TableHead className="text-right">Cost Basis</TableHead>
                  <TableHead className="text-right">Gain / Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxYearGains.disposals.map((disposal, idx) => {
                  const fund = getFundById(disposal.fundId);
                  return (
                    <TableRow key={`${disposal.date}-${disposal.fundId}-${idx}`}>
                      <TableCell>{formatDate(disposal.date)}</TableCell>
                      <TableCell className="font-medium">
                        {fund?.name ?? disposal.fundId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {disposal.rule === "same_day"
                            ? "Same Day"
                            : disposal.rule === "bed_and_breakfast"
                            ? "30-Day B&B"
                            : "Section 104"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(disposal.units)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(disposal.proceeds)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(disposal.costBasis)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          disposal.gain >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {disposal.gain >= 0 ? "+" : ""}
                        {formatCurrency(disposal.gain)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(
                      taxYearGains.disposals.reduce((s, d) => s + d.proceeds, 0)
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(
                      taxYearGains.disposals.reduce(
                        (s, d) => s + d.costBasis,
                        0
                      )
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold ${
                      taxYearGains.netGain >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {taxYearGains.netGain >= 0 ? "+" : ""}
                    {formatCurrency(taxYearGains.netGain)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              No disposals recorded in the {currentTaxYear} tax year.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 104 Pools */}
      <Card>
        <CardHeader>
          <CardTitle>Section 104 Pools</CardTitle>
          <CardDescription>
            Current pooled cost basis for each fund held in GIA accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {section104Pools.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead className="text-right">Pool Units</TableHead>
                  <TableHead className="text-right">Pooled Cost</TableHead>
                  <TableHead className="text-right">
                    Avg Cost per Unit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section104Pools.map((pool) => {
                  const fund = getFundById(pool.fundId);
                  const account = getAccountById(pool.accountId);
                  return (
                    <TableRow
                      key={`${pool.accountId}-${pool.fundId}`}
                    >
                      <TableCell className="font-medium">
                        {account?.name ?? pool.accountId}
                      </TableCell>
                      <TableCell>{fund?.name ?? pool.fundId}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(pool.totalUnits)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(pool.pooledCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(pool.averageCost)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              No Section 104 pools found.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Unrealised Gains */}
      <Card>
        <CardHeader>
          <CardTitle>Unrealised Gains</CardTitle>
          <CardDescription>
            Potential gains across all GIA holdings based on current prices vs
            pooled cost
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unrealisedGains.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                  <TableHead className="text-right">Current Price</TableHead>
                  <TableHead className="text-right">Unrealised Gain</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unrealisedGains.map((ug) => {
                  const fund = getFundById(ug.fundId);
                  const account = getAccountById(ug.accountId);
                  const withinAllowance = ug.unrealisedGain <= allowanceRemaining;
                  return (
                    <TableRow key={`${ug.accountId}-${ug.fundId}`}>
                      <TableCell className="font-medium">
                        {account?.name ?? ug.accountId}
                      </TableCell>
                      <TableCell>{fund?.name ?? ug.fundId}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(ug.units)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(ug.averageCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(ug.currentPrice)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          ug.unrealisedGain >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {ug.unrealisedGain >= 0 ? "+" : ""}
                        {formatCurrency(ug.unrealisedGain)}
                      </TableCell>
                      <TableCell>
                        {ug.unrealisedGain > 0 && withinAllowance ? (
                          <Badge className="bg-green-600">
                            Within allowance
                          </Badge>
                        ) : ug.unrealisedGain > 0 ? (
                          <Badge variant="outline">
                            Exceeds allowance
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Loss</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              No unrealised gains to display.
            </p>
          )}
        </CardContent>
      </Card>

      {/* CGT Allowance Harvesting - Per Person */}
      <Card>
        <CardHeader>
          <CardTitle>CGT Allowance Harvesting</CardTitle>
          <CardDescription>
            Optimise your annual CGT allowance by strategically crystallising
            gains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {personGains.map(
              ({
                person,
                personTaxYearGains,
                personUnrealisedGains,
                totalUnrealised,
                usedAllowance,
                remainingAllowance,
                optimalCrystallise,
              }) => (
                <Card key={person.id} className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-lg">{person.name}</CardTitle>
                    <CardDescription>
                      You have {formatCurrency(annualAllowance)} CGT allowance
                      &mdash; {formatCurrency(usedAllowance)} used,{" "}
                      {formatCurrency(remainingAllowance)} remaining
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Summary stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground text-sm">
                            Realised this year
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(personTaxYearGains.netGain)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            Total unrealised
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(totalUnrealised)}
                          </p>
                        </div>
                      </div>

                      {/* Unrealised holdings */}
                      {personUnrealisedGains.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            GIA Holdings with unrealised gains:
                          </p>
                          {personUnrealisedGains.map((ug) => {
                            const fund = getFundById(ug.fundId);
                            return (
                              <div
                                key={`${ug.accountId}-${ug.fundId}`}
                                className="flex items-center justify-between rounded-lg border p-3"
                              >
                                <span className="text-sm">
                                  {fund?.name ?? ug.fundId}
                                </span>
                                <span
                                  className={`text-sm font-medium ${
                                    ug.unrealisedGain >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {ug.unrealisedGain >= 0 ? "+" : ""}
                                  {formatCurrency(ug.unrealisedGain)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Suggestion */}
                      {remainingAllowance > 0 && totalUnrealised > 0 ? (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            Suggested action
                          </p>
                          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                            Crystallise up to{" "}
                            <span className="font-bold">
                              {formatCurrency(optimalCrystallise)}
                            </span>{" "}
                            in gains tax-free using your remaining CGT
                            allowance. Consider a Bed &amp; ISA to shelter
                            future growth.
                          </p>
                        </div>
                      ) : remainingAllowance === 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            Allowance fully used
                          </p>
                          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                            Your CGT allowance for {currentTaxYear} has been
                            fully utilised. Further disposals will be subject to
                            CGT.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            No unrealised gains available to harvest.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
