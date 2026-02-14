"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssetClass, Region, Fund, HouseholdData } from "@/types";
import { ASSET_CLASS_LABELS, REGION_LABELS } from "@/types";
import { clone, setField, renderField } from "./field-helpers";

interface FundsTabProps {
  household: HouseholdData;
  updateHousehold: (data: HouseholdData) => void;
}

export function FundsTab({ household, updateHousehold }: FundsTabProps) {
  function updateFund(index: number, field: keyof Fund, value: string | number) {
    const updated = clone(household);
    setField(updated.funds[index], field, value);
    updateHousehold(updated);
  }

  function addFund() {
    const updated = clone(household);
    updated.funds.push({
      id: `fund-${Date.now()}`,
      name: "",
      ticker: "",
      isin: "",
      ocf: 0,
      assetClass: "equity" as AssetClass,
      region: "global" as Region,
    });
    updateHousehold(updated);
  }

  function removeFund(index: number) {
    const updated = clone(household);
    updated.funds.splice(index, 1);
    updateHousehold(updated);
  }

  // Count how many holdings reference each fund
  function holdingCount(fundId: string): number {
    let count = 0;
    for (const account of household.accounts) {
      for (const holding of account.holdings) {
        if (holding.fundId === fundId) count++;
      }
    }
    return count;
  }

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Your fund catalogue. Holdings in accounts reference these for asset class,
        region, and fee breakdowns.
      </p>
      {household.funds.map((fund, fIdx) => {
        const refCount = holdingCount(fund.id);
        return (
          <Card key={fund.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {fund.name || "New Fund"}
                  {fund.ticker && <Badge variant="outline">{fund.ticker}</Badge>}
                  {refCount > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">
                      used in {refCount} holding{refCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </CardTitle>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeFund(fIdx)}
                >
                  Remove
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderField(
                  "Name",
                  <Input
                    value={fund.name}
                    onChange={(e) => updateFund(fIdx, "name", e.target.value)}
                    placeholder="e.g. Vanguard FTSE Global All Cap"
                  />
                )}
                {renderField(
                  "Ticker",
                  <Input
                    value={fund.ticker}
                    onChange={(e) => updateFund(fIdx, "ticker", e.target.value)}
                    placeholder="e.g. VWRL"
                  />
                )}
                {renderField(
                  "ISIN",
                  <Input
                    value={fund.isin}
                    onChange={(e) => updateFund(fIdx, "isin", e.target.value)}
                    placeholder="e.g. IE00B3RBWM25"
                  />,
                  "International Securities Identification Number"
                )}
                {renderField(
                  "OCF (%)",
                  <Input
                    type="number"
                    step="0.01"
                    value={Math.round(fund.ocf * 100 * 100) / 100}
                    onChange={(e) =>
                      updateFund(fIdx, "ocf", Number(e.target.value) / 100)
                    }
                    placeholder="0.22"
                  />,
                  "Ongoing Charges Figure — the annual fee as a percentage"
                )}
                {renderField(
                  "Asset Class",
                  <Select
                    value={fund.assetClass}
                    onValueChange={(val) => updateFund(fIdx, "assetClass", val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ASSET_CLASS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {renderField(
                  "Region",
                  <Select
                    value={fund.region}
                    onValueChange={(val) => updateFund(fIdx, "region", val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REGION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Button onClick={addFund} variant="outline">
        + Add Fund
      </Button>
    </div>
  );
}
