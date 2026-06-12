export type SqlValidationError = {
  message: string;
  startColumn: number;
  endColumn: number;
  lineNumber?: number;
};

export type OpenSqlValidationOptions = {
  availableEntityNames?: string[];
  validateEntityNames?: boolean;
};

const clausePatterns = [
  { name: "FROM", pattern: /\bFROM\b/i },
  { name: "WHERE", pattern: /\bWHERE\b/i },
  { name: "GROUP BY", pattern: /\bGROUP\s+BY\b/i },
  { name: "HAVING", pattern: /\bHAVING\b/i },
  { name: "ORDER BY", pattern: /\bORDER\s+BY\b/i },
  { name: "UP TO", pattern: /\bUP\s+TO\b/i },
  { name: "LIMIT", pattern: /\bLIMIT\b/i },
];

function findKeywordIndex(query: string, keyword: string) {
  const match = new RegExp(`\\b${keyword}\\b`, "i").exec(query);
  return match?.index ?? -1;
}

function findPatternIndex(query: string, pattern: RegExp) {
  return pattern.exec(query)?.index ?? -1;
}

function extractEntityAfterKeyword(query: string, keywordPattern: RegExp) {
  const match = keywordPattern.exec(query);

  if (!match) {
    return null;
  }

  const startIndex = match.index + match[0].length;
  const remaining = query.slice(startIndex).trimStart();
  const leadingWhitespace = query.slice(startIndex).length - remaining.length;
  const entityMatch = /^([A-Z0-9_./-]+)/i.exec(remaining);

  if (!entityMatch?.[1]) {
    return null;
  }

  return {
    name: entityMatch[1],
    startIndex: startIndex + leadingWhitespace,
  };
}

function isKnownEntity(entityName: string, availableEntityNames: string[]) {
  if (availableEntityNames.length === 0) {
    return true;
  }

  return availableEntityNames.some(
    (knownEntity) => knownEntity.toLowerCase() === entityName.toLowerCase(),
  );
}

function addUnknownEntityError(
  errors: SqlValidationError[],
  entityName: string,
  startIndex: number,
  availableEntityNames: string[],
) {
  if (isKnownEntity(entityName, availableEntityNames)) {
    return;
  }

  errors.push({
    message: `Unknown entity set "${entityName}". Choose an entity from Object Explorer.`,
    startColumn: startIndex + 1,
    endColumn: startIndex + entityName.length + 1,
  });
}

function getSelectProjection(query: string, fromIndex: number) {
  const rawProjection = query.slice("SELECT".length, fromIndex);
  const trimmedProjection = rawProjection.trim();
  const leadingWhitespace = rawProjection.length - rawProjection.trimStart().length;

  return {
    text: trimmedProjection,
    startIndex: "SELECT".length + leadingWhitespace,
  };
}

function splitProjectionFields(projection: string) {
  return projection.split(",").reduce<Array<{ text: string; startIndex: number }>>(
    (fields, part) => {
      const previousLength = fields.reduce(
        (total, field) => total + field.text.length + 1,
        0,
      );
      const leadingWhitespace = part.length - part.trimStart().length;
      const text = part.trim();

      if (text) {
        fields.push({
          text,
          startIndex: previousLength + leadingWhitespace,
        });
      }

      return fields;
    },
    [],
  );
}

function getJoinAliasNames(query: string) {
  const aliases = new Set<string>();
  const fromAliasMatch =
    /\bFROM\s+[A-Z0-9_./-]+\s+AS\s+([A-Z_][A-Z0-9_]*)/i.exec(query);

  if (fromAliasMatch?.[1]) {
    aliases.add(fromAliasMatch[1].toUpperCase());
  }

  for (const joinMatch of query.matchAll(
    /\bINNER\s+JOIN\s+[A-Z0-9_./-]+\s+AS\s+([A-Z_][A-Z0-9_]*)/gi,
  )) {
    if (joinMatch[1]) {
      aliases.add(joinMatch[1].toUpperCase());
    }
  }

  return aliases;
}

function isAggregateProjectionExpression(fieldExpression: string) {
  return /^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(?:\*|[A-Z_][A-Z0-9_]*(?:~[A-Z_][A-Z0-9_]*)?)\s*\)\s+AS\s+[A-Z_][A-Z0-9_]*$/i.test(
    fieldExpression,
  );
}

function validateJoinSql(
  query: string,
  fromIndex: number,
  projection: { text: string; startIndex: number },
  availableEntityNames: string[],
) {
  const errors: SqlValidationError[] = [];
  const hasJoin = /\bJOIN\b/i.test(query);

  if (!hasJoin) {
    return errors;
  }

  for (const joinMatch of query.matchAll(/\b(?:[A-Z]+\s+)?JOIN\b/gi)) {
    const joinText = joinMatch[0];

    if (/^INNER\s+JOIN$/i.test(joinText)) {
      continue;
    }

    const joinIndex = joinMatch.index ?? findKeywordIndex(query, "JOIN");
    errors.push({
      message: "JOIN supports INNER JOIN only.",
      startColumn: Math.max(1, joinIndex + 1),
      endColumn: Math.max(2, joinIndex + joinText.length + 1),
    });
  }

  const fromAliasMatch =
    /\bFROM\s+([A-Z0-9_./-]+)(?:\s+AS\s+([A-Z_][A-Z0-9_]*))?/i.exec(query);
  if (fromAliasMatch?.[1] && !fromAliasMatch[2]) {
    const tableIndex = fromAliasMatch.index + fromAliasMatch[0].length;
    errors.push({
      message: "JOIN requires an alias for the FROM table, for example FROM spfli AS a.",
      startColumn: tableIndex + 1,
      endColumn: tableIndex + 1,
    });
  }

  for (const innerJoinTableMatch of query.matchAll(
    /\bINNER\s+JOIN\s+([A-Z0-9_./-]+)(?:\s+AS\s+([A-Z_][A-Z0-9_]*))?/gi,
  )) {
    if (!innerJoinTableMatch[1]) {
      continue;
    }

    const joinedTableIndex =
      innerJoinTableMatch.index +
      innerJoinTableMatch[0].toUpperCase().indexOf(
        innerJoinTableMatch[1].toUpperCase(),
      );
    addUnknownEntityError(
      errors,
      innerJoinTableMatch[1],
      joinedTableIndex,
      availableEntityNames,
    );

    if (!innerJoinTableMatch[2]) {
      const tableIndex = innerJoinTableMatch.index + innerJoinTableMatch[0].length;
      errors.push({
        message: "JOIN requires an alias for the joined table, for example INNER JOIN scarr AS b.",
        startColumn: tableIndex + 1,
        endColumn: tableIndex + 1,
      });
    }
  }

  if (!/\bON\b/i.test(query)) {
    const joinIndex = findKeywordIndex(query, "JOIN");
    errors.push({
      message: "INNER JOIN requires an ON condition.",
      startColumn: Math.max(1, joinIndex + 1),
      endColumn: Math.max(2, query.length + 1),
    });
  }

  if (projection.text === "*") {
    errors.push({
      message: "JOIN does not support SELECT *. Choose fields as alias~field.",
      startColumn: projection.startIndex + 1,
      endColumn: projection.startIndex + projection.text.length + 1,
    });
  }

  const aliasNames = getJoinAliasNames(query);
  splitProjectionFields(projection.text).forEach((field) => {
    const rawFieldExpression = field.text;
    const fieldExpression = rawFieldExpression.replace(
      /\s+AS\s+[A-Z_][A-Z0-9_]*$/i,
      "",
    );

    if (fieldExpression === "*") {
      return;
    }

    const aliasFieldMatch = /^([A-Z_][A-Z0-9_]*)~([A-Z_][A-Z0-9_]*)$/i.exec(
      fieldExpression,
    );

    if (!aliasFieldMatch && isAggregateProjectionExpression(rawFieldExpression)) {
      return;
    }

    if (!aliasFieldMatch) {
      errors.push({
        message: "Selected fields in JOIN must use alias~field, for example a~carrid.",
        startColumn: projection.startIndex + field.startIndex + 1,
        endColumn: projection.startIndex + field.startIndex + field.text.length + 1,
      });
      return;
    }

    if (
      aliasNames.size > 0 &&
      aliasFieldMatch[1] &&
      !aliasNames.has(aliasFieldMatch[1].toUpperCase())
    ) {
      errors.push({
        message: `Unknown JOIN alias "${aliasFieldMatch[1]}".`,
        startColumn: projection.startIndex + field.startIndex + 1,
        endColumn:
          projection.startIndex + field.startIndex + aliasFieldMatch[1].length + 1,
      });
    }
  });

  const joinFieldPattern =
    /(?<!~)\b([A-Z_][A-Z0-9_]*)(?:~([A-Z_][A-Z0-9_]*))?(?=\s*(?:=|<>|!=|>=|<=|>|<)|\s+(?:LIKE|IN|BETWEEN|IS)\b)/gi;
  for (const match of query.matchAll(joinFieldPattern)) {
    if (match.index === undefined || !match[1]) {
      continue;
    }

    if (!match[2]) {
      errors.push({
        message: "JOIN conditions must use alias~field.",
        startColumn: match.index + 1,
        endColumn: match.index + match[1].length + 1,
      });
      continue;
    }

    if (aliasNames.size > 0 && !aliasNames.has(match[1].toUpperCase())) {
      errors.push({
        message: `Unknown JOIN alias "${match[1]}".`,
        startColumn: match.index + 1,
        endColumn: match.index + match[1].length + 1,
      });
    }
  }

  return errors;
}

export function validateOpenSql(
  queryText: string,
  options: OpenSqlValidationOptions = {},
): SqlValidationError[] {
  const query = queryText.trim();
  const errors: SqlValidationError[] = [];
  const availableEntityNames = options.validateEntityNames === false
    ? []
    : (options.availableEntityNames ?? []);

  if (!query) {
    errors.push({
      message: "Enter a SQL statement before executing.",
      startColumn: 1,
      endColumn: 1,
    });
    return errors;
  }

  if (query.includes(";") && query.replace(/;+\s*$/, "").includes(";")) {
    errors.push({
      message: "Only one SQL statement can be executed at a time.",
      startColumn: query.indexOf(";") + 1,
      endColumn: query.indexOf(";") + 2,
    });
  }

  const unescapedSingleQuotes = query.match(/(^|[^'])'(?!')/g)?.length ?? 0;
  if (unescapedSingleQuotes % 2 !== 0) {
    errors.push({
      message: "String literal is missing a closing single quote.",
      startColumn: query.lastIndexOf("'") + 1,
      endColumn: query.length + 1,
    });
  }

  let balance = 0;
  for (let index = 0; index < query.length; index += 1) {
    const char = query[index];
    if (char === "(") {
      balance += 1;
    }
    if (char === ")") {
      balance -= 1;
    }
    if (balance < 0) {
      errors.push({
        message: "Closing parenthesis does not have a matching opening parenthesis.",
        startColumn: index + 1,
        endColumn: index + 2,
      });
      balance = 0;
    }
  }

  if (balance > 0) {
    errors.push({
      message: "Opening parenthesis is missing a closing parenthesis.",
      startColumn: query.lastIndexOf("(") + 1,
      endColumn: query.length + 1,
    });
  }

  const firstKeyword = query.split(/\s+/)[0]?.toUpperCase();
  if (!["SELECT", "DESCRIBE", "SHOW"].includes(firstKeyword ?? "")) {
    errors.push({
      message: "Open SQL Workbench supports SELECT, DESCRIBE, and SHOW statements.",
      startColumn: 1,
      endColumn: Math.max(2, (firstKeyword?.length ?? 1) + 1),
    });
    return errors;
  }

  if (firstKeyword === "SELECT") {
    const topMatch = /\bTOP\s+([^\s,]+)/i.exec(query);
    if (topMatch?.[1] && !/^\d+$/.test(topMatch[1])) {
      errors.push({
        message: "TOP requires a positive whole number.",
        startColumn: topMatch.index + "TOP ".length + 1,
        endColumn: topMatch.index + "TOP ".length + topMatch[1].length + 1,
      });
    }

    const duplicateTop = query.match(/\bTOP\b/gi);
    if ((duplicateTop?.length ?? 0) > 1) {
      const secondTopIndex = query.toUpperCase().indexOf(
        "TOP",
        query.toUpperCase().indexOf("TOP") + 1,
      );
      errors.push({
        message: "SELECT can only contain one TOP clause.",
        startColumn: secondTopIndex + 1,
        endColumn: secondTopIndex + 4,
      });
    }

    const formIndex = findKeywordIndex(query, "FORM");
    if (formIndex >= 0 && findKeywordIndex(query, "FROM") === -1) {
      errors.push({
        message: "Use FROM instead of FORM.",
        startColumn: formIndex + 1,
        endColumn: formIndex + 5,
      });
    }

    const fromIndex = findKeywordIndex(query, "FROM");
    if (fromIndex === -1) {
      errors.push({
        message: "SELECT statement is missing a FROM clause.",
        startColumn: query.length + 1,
        endColumn: query.length + 1,
      });
    } else {
      const projectionInfo = getSelectProjection(query, fromIndex);
      const projection = projectionInfo.text;
      if (!projection) {
        errors.push({
          message: "SELECT statement needs at least one field or * before FROM.",
          startColumn: "SELECT".length + 1,
          endColumn: fromIndex + 1,
        });
      }

      if (/,$/.test(projection)) {
        errors.push({
          message: "SELECT field list cannot end with a comma.",
          startColumn: fromIndex,
          endColumn: fromIndex + 1,
        });
      }

      errors.push(
        ...validateJoinSql(
          query,
          fromIndex,
          projectionInfo,
          availableEntityNames,
        ),
      );

      const fromClause = query.slice(fromIndex + "FROM".length).trim();
      if (!fromClause || /^(WHERE|ORDER\s+BY|GROUP\s+BY)\b/i.test(fromClause)) {
        errors.push({
          message: "FROM clause is missing an entity set name.",
          startColumn: fromIndex + "FROM".length + 1,
          endColumn: fromIndex + "FROM".length + 1,
        });
      } else {
        const entity = extractEntityAfterKeyword(query, /\bFROM\b/i);
        if (entity) {
          addUnknownEntityError(
            errors,
            entity.name,
            entity.startIndex,
            availableEntityNames,
          );
        }
      }
    }

    const foundClauses = clausePatterns
      .map((clause) => ({
        ...clause,
        index: findPatternIndex(query, clause.pattern),
      }))
      .filter((clause) => clause.index >= 0);

    foundClauses.forEach((clause, index) => {
      const previousClause = foundClauses[index - 1];
      if (previousClause && clause.index < previousClause.index) {
        errors.push({
          message: `${clause.name} appears before ${previousClause.name}. Use SELECT ... FROM ... WHERE ... GROUP BY ... HAVING ... ORDER BY ... UP TO n ROWS.`,
          startColumn: clause.index + 1,
          endColumn: clause.index + clause.name.length + 1,
        });
      }
    });

    const whereIndex = findKeywordIndex(query, "WHERE");
    if (whereIndex >= 0) {
      const whereClause = query
        .slice(whereIndex + "WHERE".length)
        .replace(/\b(GROUP\s+BY|HAVING|ORDER\s+BY|UP\s+TO|LIMIT)\b[\s\S]*$/i, "")
        .trim();

      if (!whereClause) {
        errors.push({
          message: "WHERE clause needs a condition.",
          startColumn: whereIndex + "WHERE".length + 1,
          endColumn: query.length + 1,
        });
      }

      if (/\b(AND|OR)\s*$/i.test(whereClause)) {
        errors.push({
          message: "Condition cannot end with AND or OR.",
          startColumn: whereIndex + "WHERE".length + whereClause.length,
          endColumn: query.length + 1,
        });
      }

      if (/^\b(AND|OR)\b/i.test(whereClause)) {
        errors.push({
          message: "WHERE condition cannot start with AND or OR.",
          startColumn: whereIndex + "WHERE".length + 1,
          endColumn: whereIndex + "WHERE".length + 4,
        });
      }
    }

    const groupByIndex = findPatternIndex(query, /\bGROUP\s+BY\b/i);
    if (groupByIndex >= 0) {
      const groupByClause = query
        .slice(groupByIndex)
        .replace(/^GROUP\s+BY/i, "")
        .replace(/\b(HAVING|ORDER\s+BY|UP\s+TO|LIMIT)\b[\s\S]*$/i, "")
        .trim();

      if (!groupByClause) {
        errors.push({
          message: "GROUP BY needs at least one field.",
          startColumn: groupByIndex + "GROUP BY".length + 1,
          endColumn: groupByIndex + "GROUP BY".length + 1,
        });
      }
    }

    const havingIndex = findKeywordIndex(query, "HAVING");
    if (havingIndex >= 0 && groupByIndex === -1) {
      errors.push({
        message: "HAVING requires a GROUP BY clause.",
        startColumn: havingIndex + 1,
        endColumn: havingIndex + "HAVING".length + 1,
      });
    }

    const orderByIndex = findPatternIndex(query, /\bORDER\s+BY\b/i);
    if (orderByIndex >= 0) {
      const orderByClause = query
        .slice(orderByIndex)
        .replace(/^ORDER\s+BY/i, "")
        .replace(/\b(UP\s+TO|LIMIT)\b[\s\S]*$/i, "")
        .trim();

      if (!orderByClause) {
        errors.push({
          message: "ORDER BY needs at least one field.",
          startColumn: orderByIndex + "ORDER BY".length + 1,
          endColumn: orderByIndex + "ORDER BY".length + 1,
        });
      }
    }

    const limitMatch = /\bLIMIT\s+([^\s,]+)/i.exec(query);
    if (limitMatch?.[1] && !/^\d+$/.test(limitMatch[1])) {
      errors.push({
        message: "LIMIT requires a positive whole number.",
        startColumn: limitMatch.index + "LIMIT ".length + 1,
        endColumn: limitMatch.index + "LIMIT ".length + limitMatch[1].length + 1,
      });
    }

    const upToRowsMatch = /\bUP\s+TO\s+([^\s,]+)\s+ROWS\b/i.exec(query);
    const incompleteUpToIndex = findPatternIndex(query, /\bUP\s+TO\b/i);
    if (incompleteUpToIndex >= 0 && !upToRowsMatch) {
      errors.push({
        message: "Use UP TO <number> ROWS.",
        startColumn: incompleteUpToIndex + 1,
        endColumn: query.length + 1,
      });
    }

    if (upToRowsMatch?.[1] && !/^\d+$/.test(upToRowsMatch[1])) {
      errors.push({
        message: "UP TO requires a positive whole number before ROWS.",
        startColumn: upToRowsMatch.index + "UP TO ".length + 1,
        endColumn:
          upToRowsMatch.index + "UP TO ".length + upToRowsMatch[1].length + 1,
      });
    }

    const hasTop = /\bTOP\b/i.test(query);
    const hasLimit = /\bLIMIT\b/i.test(query);
    const hasUpToRows = /\bUP\s+TO\b/i.test(query);
    const rowLimitCount = [hasTop, hasLimit, hasUpToRows].filter(Boolean).length;
    if (rowLimitCount > 1) {
      const firstRowLimitIndex = Math.min(
        ...[
          hasTop ? findKeywordIndex(query, "TOP") : Number.POSITIVE_INFINITY,
          hasLimit ? findKeywordIndex(query, "LIMIT") : Number.POSITIVE_INFINITY,
          hasUpToRows
            ? findPatternIndex(query, /\bUP\s+TO\b/i)
            : Number.POSITIVE_INFINITY,
        ],
      );
      errors.push({
        message: "Use only one row limiting clause: TOP, LIMIT, or UP TO n ROWS.",
        startColumn: firstRowLimitIndex + 1,
        endColumn: firstRowLimitIndex + 6,
      });
    }
  }

  if (firstKeyword === "DESCRIBE") {
    const describeMatch = /^DESCRIBE\s+KEYS\s+FOR\s+([A-Z0-9_./-]+)\s*$/i.exec(
      query,
    );

    if (!describeMatch?.[1]) {
      errors.push({
        message: "Use DESCRIBE KEYS FOR <EntitySet>.",
        startColumn: 1,
        endColumn: query.length + 1,
      });
    } else {
      addUnknownEntityError(
        errors,
        describeMatch[1],
        query.toUpperCase().lastIndexOf(describeMatch[1].toUpperCase()),
        availableEntityNames,
      );
    }
  }

  if (firstKeyword === "SHOW") {
    const showMatch = /^SHOW\s+LAST\s+SYNC\s+FOR\s+([A-Z0-9_./-]+)\s*$/i.exec(
      query,
    );

    if (!showMatch?.[1]) {
      errors.push({
        message: "Use SHOW LAST SYNC FOR <EntitySet>.",
        startColumn: 1,
        endColumn: query.length + 1,
      });
    } else {
      addUnknownEntityError(
        errors,
        showMatch[1],
        query.toUpperCase().lastIndexOf(showMatch[1].toUpperCase()),
        availableEntityNames,
      );
    }
  }

  return errors;
}
