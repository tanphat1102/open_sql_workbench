export type SapCredentials = {
  username: string;
  password: string;
  client: string;
};

export type SapLoginResponse = {
  success: boolean;
  message?: string;
  status?: number;
  error?:
    | string
    | {
        raw?: string;
        message: string;
      };
};

export type SapSessionInfo = {
  success: boolean;
  user?: string;
  client?: string;
};

export type SapQueryParam = string | number | boolean | null | undefined;

export type SapODataEnvelope<T> = {
  d?: {
    results?: T[];
  };
};

export type SapRunQueryResult = {
  ResultId?: string;
  Status?: string;
  ObjectName?: string;
  RowCount?: number;
  ReturnedRows?: number;
  TotalRows?: number;
  MaxRows?: number;
  Page?: number;
  PageSize?: number;
  TotalPages?: number;
  Truncated?: boolean | string;
  RowsJson?: string | null;
  Csv?: string | null;
  ErrorCode?: string | null;
  ErrorText?: string | null;
};
