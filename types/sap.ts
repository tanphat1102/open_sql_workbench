export type SapCredentials = {
  username: string;
  password: string;
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

export type SapQueryParam = string | number | boolean | null | undefined;

export type SapODataEnvelope<T> = {
  d?: {
    results?: T[];
  };
};
