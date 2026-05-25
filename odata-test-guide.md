# Hướng dẫn test OData SQL Workbench

Tài liệu này dùng để test service OData đã publish của đồ án SQL Workbench.

Service hiện tại:

```text
ZSQLWB_ODATA_SRV
```

Base path trong SAP Gateway:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/
```

Trong `/IWFND/GW_CLIENT`, chỉ cần nhập phần path sau host. Nếu gọi từ frontend/browser thì ghép thêm host SAP, ví dụ:

```text
https://<sap-host>:<port>/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/
```

## 1. Endpoint đang có trong MVP

Hiện tại OData MVP đã expose:

```text
RunQuery
```

`RunQuery` gọi vào backend:

```abap
ZCL_SQLWB_SERVICE=>RUN_QUERY_RESULT
```

Các chức năng khác như preview table, search DDIC table, get fields, saved query, list log hiện đã có ở backend nhưng chưa expose OData trong MVP hiện tại.

## 2. Header khuyến nghị

Khi test trong Gateway Client:

```text
Accept: application/json
```

Nếu không set `Accept`, SAP Gateway có thể trả XML. Cả hai đều đúng, nhưng frontend nên dùng JSON.

Khi gọi `POST` từ frontend thật, cần xử lý CSRF token:

1. Gọi `GET` service root:

```text
GET /sap/opu/odata/sap/ZSQLWB_ODATA_SRV/
```

Header:

```text
X-CSRF-Token: Fetch
Accept: application/json
```

2. Lấy token từ response header:

```text
x-csrf-token
```

3. Gọi `POST RunQuery` kèm:

```text
X-CSRF-Token: <token>
Accept: application/json
```

Nếu frontend gọi khác domain với SAP Gateway, còn cần xử lý cookie/session và CORS/proxy theo cấu hình hệ thống.

## 3. GET metadata

Mục đích:

- Kiểm tra service đã publish đúng.
- Kiểm tra entity `SqlwbResult`.
- Kiểm tra function import/action `RunQuery`.

Method:

```text
GET
```

URL:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/$metadata
```

Payload:

```text
Không có body.
```

Kỳ vọng:

```text
HTTP 200 OK
Content-Type: application/xml
```

Response là XML metadata. Trong response nên có các phần tương tự:

```xml
<EntityType Name="SqlwbResult">
...
</EntityType>

<FunctionImport Name="RunQuery" ... m:HttpMethod="POST" ...>
...
</FunctionImport>
```

Nếu `$metadata` không chạy được thì chưa test các endpoint khác. Khi đó kiểm tra lại `/IWFND/MAINT_SERVICE`.

## 4. GET service document

Mục đích:

- Kiểm tra service root trả danh sách entity set.
- Lấy CSRF token khi gọi từ frontend thật.

Method:

```text
GET
```

URL:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/
```

Header để lấy CSRF token:

```text
X-CSRF-Token: Fetch
Accept: application/json
```

Payload:

```text
Không có body.
```

Kỳ vọng:

```text
HTTP 200 OK
```

Response header có thể có:

```text
x-csrf-token: <token>
set-cookie: <SAP session cookie>
```

Response body JSON thường có dạng service document của OData V2:

```json
{
  "d": {
    "EntitySets": [
      "SqlwbResultSet"
    ]
  }
}
```

## 5. POST RunQuery

Mục đích:

- Chạy một câu SQL `SELECT` thông qua backend service.
- Kiểm tra whitelist, role/profile, masking, phân trang và envelope trả về cho frontend.

Method:

```text
POST
```

URL mẫu:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/RunQuery?ProfileId='DEV'&SqlText='SELECT%20*%20FROM%20SPFLI'&Page=1
```

Payload/body:

```text
Không có body trong MVP hiện tại.
```

Các input đang truyền qua query parameter:

| Parameter | Kiểu OData | Bắt buộc | Ví dụ | Ý nghĩa |
|---|---:|---:|---|---|
| `ProfileId` | `Edm.String` | Có | `'DEV'` | Profile nghiệp vụ cần dùng. Backend vẫn check PFCG role thật của user. |
| `SqlText` | `Edm.String` | Có | `'SELECT%20*%20FROM%20SPFLI'` | SQL text đã URL encode. Chỉ cho phép `SELECT`. |
| `Page` | `Edm.Int32` | Không | `1` | Trang dữ liệu. Nếu rỗng, backend dùng `1`. |

Lưu ý:

- Vì `SqlText` nằm trên URL nên phải URL encode khoảng trắng và ký tự đặc biệt.
- Khoảng trắng encode thành `%20`.
- Dấu `*` thường có thể để nguyên, nhưng encode vẫn an toàn hơn nếu client hỗ trợ.

Ví dụ SQL:

```sql
SELECT * FROM SPFLI
```

Encode trên URL:

```text
SELECT%20*%20FROM%20SPFLI
```

## 6. Kiểu response của RunQuery

`RunQuery` trả về một object `SqlwbResult`.

Nếu dùng `Accept: application/json`, response có dạng tổng quát:

```json
{
  "d": {
    "ResultId": "RUNQUERY",
    "Status": "SUCCESS",
    "ObjectName": "SPFLI",
    "RowCount": 24,
    "ReturnedRows": 24,
    "TotalRows": 24,
    "MaxRows": 5000,
    "Page": 1,
    "PageSize": 1000,
    "TotalPages": 1,
    "Truncated": false,
    "RowsJson": "[{\"mandt\":\"324\",\"carrid\":\"AA\"}]",
    "Csv": "",
    "ErrorCode": "",
    "ErrorText": ""
  }
}
```

Tên property thực tế có thể khác chữ hoa/thường tùy bạn đặt trong SEGW. Khi làm frontend, lấy `$metadata` làm nguồn chính xác nhất. Các field nghiệp vụ cần hiểu như sau:

| Field | Kiểu gợi ý | Ý nghĩa |
|---|---:|---|
| `ResultId` | `Edm.String` | ID logic của response. Với endpoint này là `RUNQUERY`. |
| `Status` | `Edm.String` | Trạng thái nghiệp vụ: `SUCCESS`, `BLOCKED`, hoặc `ERROR`. |
| `ObjectName` | `Edm.String` | Tên bảng/object backend parse được từ SQL. |
| `RowCount` | `Edm.Int32` | Số dòng trả về trong lần chạy hiện tại. |
| `ReturnedRows` | `Edm.Int32` | Số dòng thực sự trả về cho page hiện tại. |
| `TotalRows` | `Edm.Int32` | Tổng số dòng phù hợp, nếu backend tính được. |
| `MaxRows` | `Edm.Int32` | Giới hạn dòng theo profile/object. |
| `Page` | `Edm.Int32` | Trang hiện tại. |
| `PageSize` | `Edm.Int32` | Kích thước trang backend áp dụng. |
| `TotalPages` | `Edm.Int32` | Tổng số trang tính từ `TotalRows` và `PageSize`. |
| `Truncated` | `Edm.Boolean` hoặc `Edm.String` | Cho biết kết quả có bị cắt theo giới hạn không. |
| `RowsJson` | `Edm.String` | JSON string chứa danh sách row. Frontend cần parse thêm một lần. |
| `Csv` | `Edm.String` | CSV string. Với `RunQuery` MVP có thể rỗng. |
| `ErrorCode` | `Edm.String` | Mã lỗi ổn định để frontend xử lý. |
| `ErrorText` | `Edm.String` | Text lỗi để hiển thị/debug. |

## 7. Test case RunQuery thành công

### 7.1. SELECT bảng nhỏ

Method:

```text
POST
```

URL:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/RunQuery?ProfileId='DEV'&SqlText='SELECT%20*%20FROM%20SPFLI'&Page=1
```

Kỳ vọng:

```text
HTTP 200
Status = SUCCESS
ObjectName = SPFLI
ErrorCode rỗng
RowsJson có dữ liệu
```

### 7.2. SELECT bảng lớn page 1

Chỉ dùng nếu `KNA1` nằm trong whitelist của profile đang test.

URL:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/RunQuery?ProfileId='DEV'&SqlText='SELECT%20*%20FROM%20KNA1'&Page=1
```

Kỳ vọng:

```text
HTTP 200
Status = SUCCESS
ObjectName = KNA1
Page = 1
ReturnedRows > 0
TotalRows >= ReturnedRows
```

### 7.3. SELECT bảng lớn page 2 có ORDER BY

Chỉ dùng nếu `KNA1` có hơn một page dữ liệu và field `KUNNR` hợp lệ.

URL:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/RunQuery?ProfileId='DEV'&SqlText='SELECT%20*%20FROM%20KNA1%20ORDER%20BY%20KUNNR'&Page=2
```

Kỳ vọng:

```text
HTTP 200
Status = SUCCESS
ObjectName = KNA1
Page = 2
RowsJson có dữ liệu nếu còn dòng ở page 2
```

## 8. Test case RunQuery bị chặn hoặc lỗi nghiệp vụ

Điểm quan trọng: lỗi nghiệp vụ vẫn nên trả `HTTP 200`, nhưng `Status`, `ErrorCode`, `ErrorText` thể hiện kết quả nghiệp vụ. Frontend không nên chỉ dựa vào HTTP status.

### 8.1. SQL rỗng

URL:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/RunQuery?ProfileId='DEV'&SqlText=''&Page=1
```

Kỳ vọng:

```text
HTTP 200
Status = ERROR hoặc BLOCKED
ErrorCode = EMPTY_SQL
RowsJson rỗng
```

### 8.2. Không phải SELECT

URL:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/RunQuery?ProfileId='DEV'&SqlText='DELETE%20FROM%20SPFLI'&Page=1
```

Kỳ vọng:

```text
HTTP 200
Status = ERROR hoặc BLOCKED
ErrorCode = ONLY_SELECT_ALLOWED
```

### 8.3. Object không thuộc whitelist

Ví dụ `VBAK` không nằm trong whitelist của profile `DEV`.

URL:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/RunQuery?ProfileId='DEV'&SqlText='SELECT%20*%20FROM%20VBAK'&Page=1
```

Kỳ vọng:

```text
HTTP 200
Status = BLOCKED
ObjectName = VBAK
ErrorCode = OBJECT_NOT_ALLOWED
ErrorText có tên VBAK
```

### 8.4. Page > 1 nhưng không có ORDER BY

URL:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/RunQuery?ProfileId='DEV'&SqlText='SELECT%20*%20FROM%20KNA1'&Page=2
```

Kỳ vọng:

```text
HTTP 200
Status = ERROR hoặc BLOCKED
ErrorCode = INVALID_ORDER_BY
```

Lý do: với SQL tự do, backend yêu cầu `ORDER BY` khi lấy trang từ page 2 trở đi để tránh phân trang không ổn định.

### 8.5. Profile user không có quyền PFCG tương ứng

Ví dụ user hiện tại không được assign `ZSQLWB_ADMIN`, nhưng gọi:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/RunQuery?ProfileId='ADMIN'&SqlText='SELECT%20*%20FROM%20SPFLI'&Page=1
```

Kỳ vọng:

```text
HTTP 200
Status = BLOCKED
ErrorCode = OBJECT_NOT_ALLOWED hoặc VALIDATION_ERROR
ErrorText báo không được phép dùng profile/object
```

Rule thật ở backend:

```text
ProfileId -> ZSQLWB_ROLE-PFCG_ROLE -> AGR_USERS của SY-UNAME
```

User không thể tự đổi `ProfileId` trên URL để lấy quyền cao hơn nếu không có PFCG role tương ứng.

## 9. Các rule nghiệp vụ đang áp dụng

### 9.1. OData không chứa logic nghiệp vụ

OData handler chỉ nhận request, map parameter, gọi:

```abap
ZCL_SQLWB_SERVICE=>RUN_QUERY_RESULT
```

Không đưa logic validate SQL, whitelist, masking, log vào DPC_EXT.

### 9.2. Chỉ cho phép SELECT

Các câu lệnh như:

```sql
INSERT
UPDATE
DELETE
MODIFY
DROP
ALTER
CREATE
```

phải bị chặn.

### 9.3. Bắt buộc đi qua profile

Mọi request đều cần `ProfileId`.

Backend kiểm tra:

```text
ZSQLWB_ROLE-IS_ACTIVE = X
ZSQLWB_ROLE-PFCG_ROLE có trong AGR_USERS của SY-UNAME
AGR_USERS-FROM_DAT <= SY-DATUM
AGR_USERS-TO_DAT >= SY-DATUM
```

### 9.4. Object phải nằm trong whitelist

Object trong SQL phải có trong:

```text
ZSQLWB_WLIST
```

theo `WLIST_PROFILE_ID` của profile đang dùng.

Nếu không có, backend trả:

```text
ErrorCode = OBJECT_NOT_ALLOWED
```

### 9.5. Field phải hợp lệ

Các field trong SELECT/WHERE/ORDER BY phải tồn tại trong DDIC của object.

Nếu field không hợp lệ, backend trả:

```text
ErrorCode = INVALID_FIELD
```

### 9.6. Page > 1 cần ORDER BY

Với `RunQuery`, nếu:

```text
Page > 1
```

thì SQL phải có `ORDER BY`.

Nếu không có, backend trả:

```text
ErrorCode = INVALID_ORDER_BY
```

Lý do: phân trang bằng offset/fetch cần thứ tự ổn định. Nếu không có `ORDER BY`, database không đảm bảo thứ tự dòng giữa các lần gọi.

### 9.7. ORDER BY MVP đang hỗ trợ dạng đơn giản

Nên test dạng:

```sql
ORDER BY KUNNR
```

Không nên dùng nhiều field trong MVP nếu validator chưa mở rộng:

```sql
ORDER BY CARRID CONNID
```

Nếu cần multi-field ORDER BY, mở rộng validator sau.

### 9.8. Masking luôn do backend xử lý

Frontend không tự mask dữ liệu nhạy cảm.

Backend áp dụng mask dựa trên:

```text
ZSQLWB_ROLE-MASK_PROFILE_ID
ZSQLWB_MASK
```

Ví dụ field điện thoại/email có thể trả dạng đã che.

### 9.9. Audit log

Luồng `RunQuery` phải ghi log ở backend.

Log dùng để kiểm tra:

- user chạy;
- profile;
- SQL;
- object;
- số dòng;
- trạng thái;
- lỗi nếu có.

### 9.10. Frontend phải đọc Status và ErrorCode

Frontend không được coi `HTTP 200` là chắc chắn thành công nghiệp vụ.

Luồng đúng:

```text
HTTP status OK
  -> đọc body
    -> nếu Status = SUCCESS thì render RowsJson
    -> nếu Status = BLOCKED/ERROR thì hiển thị ErrorCode/ErrorText
```

## 10. Endpoint chưa expose trong OData hiện tại

Các chức năng dưới đây đã có ở backend nhưng chưa có endpoint OData trong MVP hiện tại:

| Chức năng | Backend method | Endpoint dự kiến |
|---|---|---|
| Preview table | `ZCL_SQLWB_SERVICE=>PREVIEW_TABLE_RESULT` | `PreviewTable` |
| Search DDIC table | `ZCL_SQLWB_SERVICE=>SEARCH_DDIC_TABLES` | `SearchTables` |
| Get DDIC fields | `ZCL_SQLWB_SERVICE=>GET_DDIC_FIELDS` | `GetFields` |
| Save query | `ZCL_SQLWB_SERVICE=>SAVE_QUERY` | `SaveQuery` |
| Run saved query | `ZCL_SQLWB_SERVICE=>RUN_SAVED_QUERY_RESULT` | `RunSavedQuery` |
| List saved query | `ZCL_SQLWB_SERVICE=>LIST_QUERIES` | `ListQueries` |
| List log | `ZCL_SQLWB_SERVICE=>LIST_LOGS` | `ListLogs` |

Khi thêm các endpoint này, vẫn giữ rule: OData chỉ gọi `ZCL_SQLWB_SERVICE`, không gọi trực tiếp các class core thấp hơn.
