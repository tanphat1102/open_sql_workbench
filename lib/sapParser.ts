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
          // Nếu lỗi (thường do đứt nối chuỗi), thử tìm và cắt đuôi bị hỏng để parse đoạn hợp lệ
          const lastValidBraceObject = fixedJson.lastIndexOf("}");
          if (lastValidBraceObject > 0) {
            fixedJson = fixedJson.substring(0, lastValidBraceObject + 1) + "]";
            try {
              const parsed = JSON.parse(fixedJson);
              // Cập nhật lại vào data để return
              data.RowsJson = JSON.stringify(parsed);
            } catch (err2) {
              console.error("SapParser: RowsJson bị hỏng hoàn toàn", err2);
            }
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
