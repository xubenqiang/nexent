// Copyright (c) 2025-2026 Huawei Technologies Co., Ltd. All rights reserved.

"use client";

import { useEffect } from "react";
import { Form, Select, Switch } from "antd";
import { parameterIsActive } from "@/lib/modelParameterLayers";
import { ModelParameterField } from "./ModelParameterField";
import { useTranslation } from "react-i18next";
import type {
  ModelParameterRule,
  ThinkingDegreeMode,
} from "@/types/modelProfile";

export const thinkingDegreeKeys = [
  "reasoning_effort",
  "reasoning_budget_tokens",
];
/** Degree-only profiles expose reasoning without inventing a toggle binding. */
export function thinkingEnabled(
  rules: ModelParameterRule[],
  values: Record<string, unknown>
) {
  if (typeof values.enable_thinking === "boolean")
    return values.enable_thinking;
  return (
    !rules.some((rule) => rule.key === "enable_thinking") &&
    rules.some(
      (rule) =>
        thinkingDegreeKeys.includes(rule.key) &&
        rule.visible &&
        (values[rule.key] !== undefined ||
          rule.default_value !== undefined ||
          rule.fixed_value !== undefined) &&
        parameterIsActive(rule.condition, values)
    )
  );
}
export function detectThinkingMode(
  rules: ModelParameterRule[],
  values: Record<string, unknown>
): ThinkingDegreeMode {
  if (values.reasoning_effort !== undefined) return "effort";
  if (values.reasoning_budget_tokens !== undefined) return "budget_tokens";
  if (rules.some((rule) => rule.key === "reasoning_effort")) return "effort";
  if (rules.some((rule) => rule.key === "reasoning_budget_tokens"))
    return "budget_tokens";
  return "default";
}

/** Shared prefill for all UI entry points; never invent a request binding. */
export function thinkingDegreePrefill(
  rule: ModelParameterRule | undefined,
  mode: ThinkingDegreeMode,
  outputLimit?: number | null
) {
  if (!rule) return undefined;
  if (rule.fixed_value !== undefined) return rule.fixed_value;
  if (rule.default_value !== undefined) return rule.default_value;
  if (mode === "effort") {
    const choices = Array.isArray(rule.schema.enum)
      ? rule.schema.enum
      : ["low", "medium", "high"];
    return ["low", "minimal", "medium", "high", "xhigh", "max"].find((value) =>
      choices.includes(value)
    );
  }
  const maximum = rule.schema.maximum ?? outputLimit;
  const minimum =
    typeof rule.schema.minimum === "number" ? rule.schema.minimum : 1;
  return mode === "budget_tokens" && typeof maximum === "number"
    ? Math.max(minimum, Math.floor(maximum / 2))
    : undefined;
}

/** Product controls; provider request-field bindings stay behind the profile API. */
export function ModelThinkingSettings({
  rules,
  values,
  defaults = {},
  mode,
  pending = false,
  outputLimit,
  prefillReady = true,
  declaredControlsOnly = false,
  layout = "inline",
  onToggle,
  onModeChange,
  onValueChange,
}: {
  rules: ModelParameterRule[];
  values: Record<string, unknown>;
  defaults?: Record<string, unknown>;
  mode?: ThinkingDegreeMode;
  pending?: boolean;
  outputLimit?: number | null;
  prefillReady?: boolean;
  declaredControlsOnly?: boolean;
  layout?: "inline" | "panel";
  onToggle: (enabled: boolean) => void;
  onModeChange: (mode: ThinkingDegreeMode) => void;
  onValueChange: (key: string, value: unknown) => void;
}) {
  const { t } = useTranslation();
  const effective = { ...defaults, ...values };
  const toggle = rules.find((rule) => rule.key === "enable_thinking");
  const enabled = declaredControlsOnly
    ? thinkingEnabled(rules, effective)
    : effective.enable_thinking === true;
  const selectedMode =
    mode && mode !== "default" ? mode : detectThinkingMode(rules, effective);
  const key =
    selectedMode === "effort" ? "reasoning_effort" : "reasoning_budget_tokens";
  const rule = rules.find((item) => item.key === key) ?? {
    key,
    visible: true,
    editable: !declaredControlsOnly,
    required: false,
    allowed_scopes: [
      "outlet",
      "conversation",
    ] as ModelParameterRule["allowed_scopes"],
    ui_group: "reasoning",
    schema:
      selectedMode === "effort"
        ? { type: "string", enum: ["low", "medium", "high"] }
        : { type: "integer", minimum: 1 },
  };
  const fixed = rule.editable === false;
  const declaredDegrees = rules.filter(
    (item) =>
      thinkingDegreeKeys.includes(item.key) &&
      (declaredControlsOnly ||
        item.source?.ref !== "operator_thinking_degree_v1")
  );
  const modes = (["effort", "budget_tokens"] as const).filter(
    (value, index) =>
      declaredDegrees.some((item) => item.key === thinkingDegreeKeys[index]) ||
      (!declaredControlsOnly && !declaredDegrees.length)
  );
  const currentValue = effective[key];
  const prefill =
    currentValue !== undefined
      ? currentValue
      : prefillReady
        ? thinkingDegreePrefill(rule, selectedMode, outputLimit)
        : (rule?.fixed_value ?? rule?.default_value);

  useEffect(() => {
    if (!prefillReady) return;
    if (
      enabled &&
      !pending &&
      selectedMode === "default" &&
      !declaredControlsOnly
    ) {
      onModeChange("effort");
      return;
    }
    if (
      enabled &&
      !pending &&
      selectedMode !== "default" &&
      currentValue === undefined &&
      prefill !== undefined
    )
      onValueChange(key, prefill);
  }, [
    enabled,
    pending,
    selectedMode,
    key,
    currentValue,
    prefill,
    onValueChange,
    onModeChange,
    prefillReady,
    declaredControlsOnly,
  ]);
  return (
    <div
      className={
        layout === "panel"
          ? "grid grid-cols-1 items-start gap-x-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]"
          : "grid grid-cols-1 items-start gap-x-4 sm:grid-cols-3"
      }
    >
      <Form.Item label={t("modelProfile.thinkingToggle")}>
        <div className="flex h-7 items-center">
          <Switch
            aria-label={t("modelProfile.thinkingToggle")}
            checked={enabled}
            disabled={
              pending ||
              toggle?.editable === false ||
              (declaredControlsOnly && !toggle)
            }
            onChange={(enabled) => onToggle(enabled)}
          />
        </div>
      </Form.Item>
      {enabled && modes.length > 0 && (
        <>
          <Form.Item label={t("modelProfile.thinkingMode")}>
            <Select
              aria-label={t("modelProfile.thinkingMode")}
              value={selectedMode === "default" ? undefined : selectedMode}
              placeholder={t("modelProfile.chooseThinkingMode")}
              disabled={pending || fixed || !enabled}
              getPopupContainer={(trigger) => trigger.parentElement!}
              options={modes.map((value) => ({
                value,
                label: t(`modelProfile.thinkingModeOption.${value}`),
              }))}
              onChange={onModeChange}
            />
          </Form.Item>
          {selectedMode !== "default" && (
            <ModelParameterField
              label={t("modelProfile.thinkingDegree")}
              rule={rule}
              values={{ [key]: prefill }}
              pending={pending || fixed}
              scope={declaredControlsOnly ? "conversation" : "outlet"}
              hideReset
              onChange={onValueChange}
              onReset={(field) => onValueChange(field, undefined)}
            />
          )}
        </>
      )}
      {enabled && !declaredControlsOnly && !declaredDegrees.length && (
        <p className="col-span-full text-xs text-muted-foreground">
          {t("modelProfile.manualThinkingHint")}
        </p>
      )}
    </div>
  );
}
