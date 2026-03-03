"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HouseholdData, InsurancePolicy, InsurancePolicyType, RiskProfileAnswer } from "@/types";
import { INSURANCE_TYPE_LABELS } from "@/types";
import { clone, renderField } from "./field-helpers";
import { formatCurrency } from "@/lib/format";
import {
  RISK_PROFILE_QUESTIONS,
  calculateRiskScore,
  buildRiskProfile,
  RISK_TOLERANCE_LABELS,
} from "@/lib/risk-profile";

interface ProtectionTabProps {
  household: HouseholdData;
  updateHousehold: (data: HouseholdData) => void;
}

// ============================================================
// Risk Profile Questionnaire
// ============================================================

function RiskProfileSection({ household, updateHousehold }: ProtectionTabProps) {
  const riskProfile = household.riskProfile;
  const hasCompleted = riskProfile && riskProfile.answers.length > 0;

  // Local state for in-progress questionnaire
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    if (riskProfile?.answers) {
      const map: Record<string, number> = {};
      for (const a of riskProfile.answers) {
        map[a.questionId] = a.answer;
      }
      return map;
    }
    return {};
  });

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = RISK_PROFILE_QUESTIONS.length;
  const allAnswered = answeredCount === totalQuestions;

  function handleAnswer(questionId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleSave() {
    const profileAnswers: RiskProfileAnswer[] = RISK_PROFILE_QUESTIONS.map((q) => ({
      questionId: q.id,
      answer: answers[q.id] ?? 3,
    }));
    const profile = buildRiskProfile(profileAnswers);
    const updated = clone(household);
    updated.riskProfile = profile;
    updateHousehold(updated);
  }

  function handleReset() {
    setAnswers({});
    const updated = clone(household);
    updated.riskProfile = undefined;
    updateHousehold(updated);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Risk Profile Questionnaire</CardTitle>
            <CardDescription>
              Answer 6 questions to determine your risk tolerance. This feeds into the diagnostic scorecard.
            </CardDescription>
          </div>
          {hasCompleted && (
            <Badge variant="secondary" className="gap-1.5">
              {RISK_TOLERANCE_LABELS[riskProfile.tolerance]} ({riskProfile.overallScore}/100)
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {RISK_PROFILE_QUESTIONS.map((q, qIdx) => {
          const selected = answers[q.id];
          return (
            <div key={q.id} className="space-y-2">
              <p className="text-sm font-medium">
                {qIdx + 1}. {q.text}
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleAnswer(q.id, opt.value)}
                    className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                      selected === opt.value
                        ? "border-primary bg-primary/10 text-foreground font-medium"
                        : "border-border hover:bg-accent text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Preview score */}
        {allAnswered && (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="py-3">
              {(() => {
                const profileAnswers: RiskProfileAnswer[] = RISK_PROFILE_QUESTIONS.map((q) => ({
                  questionId: q.id,
                  answer: answers[q.id] ?? 3,
                }));
                const { overallScore, tolerance, maxDrawdownTolerance } = calculateRiskScore(profileAnswers);
                return (
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div>
                      <span className="font-medium">Score:</span> {overallScore}/100
                    </div>
                    <div>
                      <span className="font-medium">Tolerance:</span> {RISK_TOLERANCE_LABELS[tolerance]}
                    </div>
                    <div>
                      <span className="font-medium">Max Drawdown:</span> {(maxDrawdownTolerance * 100).toFixed(0)}%
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={!allAnswered}>
            {hasCompleted ? "Update Profile" : "Save Profile"}
          </Button>
          {hasCompleted && (
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          )}
          {!allAnswered && (
            <p className="text-xs text-muted-foreground self-center">
              {answeredCount}/{totalQuestions} answered
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Insurance Policies CRUD
// ============================================================

function InsuranceSection({ household, updateHousehold }: ProtectionTabProps) {
  const policies = household.insurancePolicies;

  function addPolicy() {
    const updated = clone(household);
    const personId = household.persons[0]?.id ?? "";
    updated.insurancePolicies.push({
      id: `ins-${Date.now()}`,
      personId,
      type: "life" as InsurancePolicyType,
      provider: "",
      coverageAmount: 0,
      annualPremium: 0,
      inflationLinked: false,
    });
    updateHousehold(updated);
  }

  function updatePolicy(index: number, field: keyof InsurancePolicy, value: string | number | boolean) {
    const updated = clone(household);
    const policy = updated.insurancePolicies[index];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (policy as any)[field] = value;
    updateHousehold(updated);
  }

  function removePolicy(index: number) {
    const updated = clone(household);
    updated.insurancePolicies.splice(index, 1);
    updateHousehold(updated);
  }

  // Summary
  const lifeCover = policies.filter((p) => p.type === "life").reduce((s, p) => s + p.coverageAmount, 0);
  const ciCover = policies.filter((p) => p.type === "critical_illness").reduce((s, p) => s + p.coverageAmount, 0);
  const ipCover = policies.filter((p) => p.type === "income_protection").reduce((s, p) => s + p.coverageAmount, 0);
  const totalPremium = policies.reduce((s, p) => s + p.annualPremium, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Insurance & Protection Policies</CardTitle>
            <CardDescription>
              Record your life insurance, critical illness, and income protection policies.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addPolicy}>
            + Add Policy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {policies.length > 0 && (
          <div className="flex flex-wrap gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Life:</span>{" "}
              <span className="font-medium">{formatCurrency(lifeCover)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Critical Illness:</span>{" "}
              <span className="font-medium">{formatCurrency(ciCover)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Income Protection:</span>{" "}
              <span className="font-medium">{formatCurrency(ipCover)}/yr</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Premium:</span>{" "}
              <span className="font-medium">{formatCurrency(totalPremium)}/yr</span>
            </div>
          </div>
        )}

        {policies.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No insurance policies recorded. Add your protection policies to get a coverage assessment in the diagnostic.
          </p>
        )}

        {policies.map((policy, idx) => (
          <Card key={policy.id} className="border-dashed">
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderField(
                  "Person",
                  <Select
                    value={policy.personId}
                    onValueChange={(v) => updatePolicy(idx, "personId", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {household.persons.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {renderField(
                  "Type",
                  <Select
                    value={policy.type}
                    onValueChange={(v) => updatePolicy(idx, "type", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(INSURANCE_TYPE_LABELS) as [InsurancePolicyType, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {renderField(
                  "Provider",
                  <Input
                    value={policy.provider}
                    onChange={(e) => updatePolicy(idx, "provider", e.target.value)}
                    placeholder="e.g. Aviva"
                  />
                )}
                {renderField(
                  "Coverage Amount",
                  <Input
                    type="number"
                    step="1000"
                    value={policy.coverageAmount}
                    onChange={(e) => updatePolicy(idx, "coverageAmount", Number(e.target.value))}
                    placeholder="0"
                  />,
                  policy.type === "income_protection" ? "Annual income if unable to work" : "Lump sum payout"
                )}
                {renderField(
                  "Annual Premium",
                  <Input
                    type="number"
                    step="10"
                    value={policy.annualPremium}
                    onChange={(e) => updatePolicy(idx, "annualPremium", Number(e.target.value))}
                    placeholder="0"
                  />
                )}
                {renderField(
                  "End Date",
                  <Input
                    type="date"
                    value={policy.endDate ?? ""}
                    onChange={(e) => updatePolicy(idx, "endDate", e.target.value)}
                  />,
                  "When the policy expires (leave blank for whole-of-life)"
                )}
                {renderField(
                  "Inflation Linked",
                  <div className="flex items-center gap-2 h-9">
                    <input
                      type="checkbox"
                      id={`inflation-${policy.id}`}
                      checked={policy.inflationLinked}
                      onChange={(e) => updatePolicy(idx, "inflationLinked", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor={`inflation-${policy.id}`} className="text-sm font-normal">
                      {policy.inflationLinked ? "Yes" : "No"}
                    </Label>
                  </div>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removePolicy(idx)}
                >
                  Remove Policy
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Protection Tab (composite)
// ============================================================

export function ProtectionTab({ household, updateHousehold }: ProtectionTabProps) {
  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Assess your risk tolerance and record your insurance policies. Both feed into the diagnostic scorecard.
      </p>
      <RiskProfileSection household={household} updateHousehold={updateHousehold} />
      <InsuranceSection household={household} updateHousehold={updateHousehold} />
    </div>
  );
}
