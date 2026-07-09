"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Bookmark, LoaderCircle, Wand2 } from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { VisualQueryBuilder } from "@/components/workbench/visual-query-builder";
import { formatOpenSql } from "@/lib/openSqlFormatter";
import { toast } from "@/lib/toast";
import type { WorkbenchEntity, WorkbenchTemplate } from "@/types/workbench";

const SqlEditor = dynamic(
  () => import("./sql-editor").then((m) => m.SqlEditor),
  {
    ssr: false,
  },
);

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
  onOpenSavedQueries?: () => void;
  editorHeight?: string;
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
  onOpenSavedQueries,
  editorHeight = "340px",
}: QueryWorkbenchProps) {
  const [templateSelectValue, setTemplateSelectValue] = useState<
    string | undefined
  >();

  function handleRunQuery() {
    onRunQuery();
  }

  function handleFormatQuery() {
    const formattedQuery = formatOpenSql(queryText);

    if (!formattedQuery) {
      toast({
        title: "Nothing to format",
        description: "Enter a SQL statement before formatting.",
      });
      return;
    }

    onQueryTextChange(formattedQuery);
    toast({
      title: "Query formatted",
      description: "OpenSQL statement was formatted.",
      variant: "success",
    });
  }

  return (
    <TooltipProvider>
      <Card className="fiori-surface h-full min-h-0 gap-0 py-0">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
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
            {onOpenSavedQueries ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onOpenSavedQueries}
                    className="border-[#b8d6ef] bg-white text-primary hover:bg-accent"
                  >
                    <Bookmark className="size-4" />
                    Saved
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Browse and manage saved queries</TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFormatQuery}
                  disabled={isRunning}
                  className="border-[#b8d6ef] bg-white text-primary hover:bg-accent"
                >
                  <Wand2 />
                  Format
                </Button>
              </TooltipTrigger>
              <TooltipContent>Format the current Open SQL statement</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleRunQuery}
                  disabled={isRunning}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isRunning ? (
                    <LoaderCircle className="animate-spin" />
                  ) : null}
                  {isRunning ? "Executing..." : "Execute"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Run the query through SAP Gateway</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Tabs defaultValue="sql" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex h-9 items-center border-b border-border bg-white px-3">
            <TabsList variant="line">
              <TabsTrigger value="sql">SQL</TabsTrigger>
              <TabsTrigger value="builder">Builder</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent
            value="sql"
            forceMount
            className="min-h-0 flex-1 p-0 data-[state=inactive]:hidden"
          >
            <div className="h-full min-h-0 p-0">
              {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
              {/* @ts-ignore */}
              <SqlEditor
                value={queryText}
                onChange={(v: string) => onQueryTextChange(v)}
                entities={entities}
                selectedEntityName={selectedEntityName}
                height={editorHeight}
              />
            </div>
          </TabsContent>
          <TabsContent
            value="builder"
            forceMount
            className="min-h-0 flex-1 p-0 data-[state=inactive]:hidden"
          >
            <VisualQueryBuilder
              entities={entities}
              onApplySql={onQueryTextChange}
            />
          </TabsContent>
        </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
