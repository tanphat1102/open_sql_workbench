"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Textarea removed in favor of the Monaco-based SqlEditor
import dynamic from "next/dynamic";

const SqlEditor = dynamic(
  () => import("./sql-editor").then((m) => m.SqlEditor),
  {
    ssr: false,
  },
);
import { Separator } from "@/components/ui/separator";
import type { WorkbenchTemplate } from "@/types/workbench";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { authService } from "@/services/authService";

type QueryWorkbenchProps = {
  selectedEntityName: string;
  queryText: string;
  templates: WorkbenchTemplate[];
  isRunning: boolean;
  onQueryTextChange: (value: string) => void;
  onApplyTemplate: (template: WorkbenchTemplate) => void;
  onRunQuery: () => void;
  needLogin?: boolean;
  setNeedLogin?: (v: boolean) => void;
};

export function QueryWorkbench({
  selectedEntityName,
  queryText,
  templates,
  isRunning,
  onQueryTextChange,
  onApplyTemplate,
  onRunQuery,
  needLogin,
  setNeedLogin,
}: QueryWorkbenchProps) {
  const primaryTemplate = templates[0];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setIsLoggingIn(true);
    try {
      await authService.login({ username, password });

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
    <Card className="border-sky-100 bg-white shadow-[0_18px_50px_rgba(15,90,170,0.08)] backdrop-blur">
      <CardHeader className="space-y-4">
        {needLogin ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <form onSubmit={handleLogin} className="flex items-center gap-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-tl-xl rounded-bl-xl border-r border-sky-100 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
              Truy vấn 1
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="text-slate-600">
                Định dạng SQL
              </Button>
              <Button variant="ghost" className="text-slate-600">
                Lưu Truy vấn
              </Button>
              <Button variant="ghost" className="text-slate-600">
                Quản lý
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onRunQuery}
              className="bg-sky-600 text-white hover:bg-sky-500"
            >
              Thực thi Truy vấn
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-xl text-slate-900">
              Query workspace
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <Tabs defaultValue="builder" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-sky-100 bg-sky-50 p-1">
            <TabsTrigger value="builder" className="rounded-xl">
              Builder
            </TabsTrigger>
            <TabsTrigger value="templates" className="rounded-xl">
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="mt-5 space-y-5 outline-none">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Query draft</span>
                <span>{queryText.length} characters</span>
              </div>
              <div>
                {/* Monaco-based SQL editor */}
                {/* SqlEditor is client-only via dynamic import */}
                {/* height set for comfortable workbench surface */}
                {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                {/* @ts-ignore */}
                <SqlEditor
                  value={queryText}
                  onChange={(v: string) => onQueryTextChange(v)}
                  height="320px"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={onRunQuery}
                  disabled={isRunning}
                  className="bg-sky-600 text-white hover:bg-sky-500"
                >
                  {isRunning ? "Executing..." : "Run query"}
                </Button>
                {primaryTemplate ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onApplyTemplate(primaryTemplate)}
                    className="border-sky-200 bg-white text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                  >
                    Load preview template
                  </Button>
                ) : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-5 outline-none">
            <ScrollArea className="h-72.5 pr-4">
              <div className="space-y-3">
                {templates.map((template, index) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onApplyTemplate(template)}
                    className="w-full rounded-2xl border border-sky-100 bg-white p-4 text-left transition hover:border-sky-200 hover:bg-sky-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-slate-900">
                          {template.name}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-600">
                          {template.description}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-sky-700"
                      >
                        #{index + 1}
                      </Badge>
                    </div>
                    <Separator className="my-3 bg-sky-100" />
                    <code className="block whitespace-pre-wrap wrap-break-word text-sm text-sky-700">
                      {template.query}
                    </code>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
