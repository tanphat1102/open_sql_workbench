"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Textarea removed in favor of the Monaco-based SqlEditor
import dynamic from "next/dynamic";

const SqlEditor = dynamic(
  () => import("./sql-editor").then((m) => m.SqlEditor),
  {
    ssr: false,
  },
);
import type { WorkbenchEntity, WorkbenchTemplate } from "@/types/workbench";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { authService } from "@/services/authService";

type QueryWorkbenchProps = {
  selectedEntityName: string;
  entities: WorkbenchEntity[];
  queryText: string;
  templates: WorkbenchTemplate[];
  isRunning: boolean;
  onQueryTextChange: (value: string) => void;
  onSelectEntity: (entityName: string) => void;
  onApplyTemplate: (template: WorkbenchTemplate) => void;
  onRunQuery: () => void;
  needLogin?: boolean;
  setNeedLogin?: (v: boolean) => void;
};

export function QueryWorkbench({
  selectedEntityName,
  entities = [],
  queryText,
  templates = [],
  isRunning,
  onQueryTextChange,
  onSelectEntity,
  onApplyTemplate,
  onRunQuery,
  needLogin,
  setNeedLogin,
}: QueryWorkbenchProps) {
  const [client, setClient] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [templateSelectValue, setTemplateSelectValue] = useState<
    string | undefined
  >();

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setIsLoggingIn(true);
    try {
      await authService.login({ username, password, client });

      if (needLogin) {
        // Close modal and retry query
        setNeedLogin?.(false);
        onRunQuery();
      }
    } catch (err) {
      console.error("Login failed", err);
      // keep modal open for retry
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <Card className="fiori-surface gap-0 py-0">
      <CardContent className="space-y-0 p-0">
        {needLogin ? (
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            <form
              onSubmit={handleLogin}
              className="flex flex-col gap-2 lg:flex-row lg:items-center"
            >
              <div className="text-sm font-medium">SAP session required</div>
              <div className="flex flex-1 flex-wrap gap-2">
                <Input
                  placeholder="Client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  inputMode="numeric"
                  maxLength={3}
                  required
                />
                <Input
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <Input
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button type="submit" className="bg-amber-600 text-white">
                  {isLoggingIn ? "Signing..." : "Sign in"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNeedLogin?.(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 border-b border-border bg-[#f7fbff] px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
              Query 1
            </Badge>
            <label className="text-sm text-muted-foreground" htmlFor="entity-set">
              Entity
            </label>
            <Select
              value={selectedEntityName || undefined}
              onValueChange={onSelectEntity}
              disabled={entities.length === 0}
            >
              <SelectTrigger id="entity-set" className="min-w-56">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.name} value={entity.name}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length > 0 ? (
              <Select
                value={templateSelectValue}
                onValueChange={(value) => {
                  setTemplateSelectValue(value);
                  const template = templates.find(
                    (item) => item.id === value,
                  );

                  if (template) {
                    onApplyTemplate(template);
                  }
                }}
              >
                <SelectTrigger className="min-w-48">
                  <SelectValue placeholder="Load template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          <div className="flex items-center gap-2 lg:justify-end">
            <div className="text-xs text-muted-foreground">
              {queryText.length} chars
            </div>
            <Button
              onClick={onRunQuery}
              disabled={isRunning}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isRunning ? "Executing..." : "Execute"}
            </Button>
          </div>
        </div>

        <div className="p-0">
          {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
          {/* @ts-ignore */}
          <SqlEditor
            value={queryText}
            onChange={(v: string) => onQueryTextChange(v)}
            height="340px"
          />
        </div>
      </CardContent>
    </Card>
  );
}
