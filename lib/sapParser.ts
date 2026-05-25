import { jsonrepair } from "jsonrepair";

type ODataCollection<T> = {
  d?: {
    results?: T[];
    [key: string]: unknown;
  };
};

export function formatODataResults<T>(
  payload: ODataCollection<T> | { d?: T } | T,
) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if ("d" in payload) {
    const data = payload.d;

    if (data && typeof data === "object") {
      if ("results" in data && Array.isArray(data.results)) {
        return data.results as T[];
      }

      // Tự động nhận diện và sửa lỗi nếu chuỗi RowsJson bị cụt
      if ("RowsJson" in data && typeof data.RowsJson === "string") {
        let fixedJson = data.RowsJson;

        try {
          // Thử parse chuẩn trước
          JSON.parse(fixedJson);
        } catch (e) {
          try {
            // Dùng jsonrepair để tự động khôi phục cấu trúc đối tượng JSON bị dở dang
            const repaired = jsonrepair(fixedJson);
            const parsed = JSON.parse(repaired);
            data.RowsJson = JSON.stringify(parsed);
            console.warn("Recovered partial RowsJson using jsonrepair");
          } catch (err2) {
            console.error("SapParser: RowsJson bị hỏng hoàn toàn", err2);
          }
        }
      }
    }

    return data as T;
  }

  return payload as T;
}

export function parseSapDate(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = /\/Date\((-?\d+)([+-]\d{4})?\)\//.exec(value);

  if (!match?.[1]) {
    return null;
  }

  const timestamp = Number(match[1]);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}
