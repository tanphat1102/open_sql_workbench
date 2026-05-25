@AGENTS.md

Markdown

# 🤖 AI Agent Guidelines - Open SQL Workbench

Chào người bạn AI! Đây là tài liệu hướng dẫn về kiến trúc, quy tắc viết code và các ràng buộc kỹ thuật của dự án **Open SQL Workbench** kết nối với hệ thống **SAP NetWeaver (S40, Client 324) qua OData v2**. Vui lòng đọc kỹ tuân thủ nghiêm ngặt các quy tắc dưới đây trước khi sinh code hoặc refactor.

---

## 🏗️ 1. Kiến Trúc Dự Án (Project Architecture)

Dự án sử dụng Next.js App Router và **KHÔNG sử dụng thư mục `src`**. Cấu trúc thư mục được chia lớp rõ ràng (Layered Clean Architecture):

```text
├── app/                           # Layer 1: Routing & API Controllers
│   ├── api/
│   │   ├── auth/login/route.ts    # Đổi credentials lấy SAP Session Cookie
│   │   └── sap/[...path]/route.ts # Proxy tổng forward request sang SAP kèm Cookie
│   ├── login/                     # UI Page: Đăng nhập
│   └── workbench/                 # UI Page: Giao diện làm việc chính
├── components/                    # Layer 2: Presentation (UI Components)
│   ├── shared/                    # Components dùng chung (DataTable, Button...)
│   └── workbench/                 # Components đặc thù (SqlEditor, SchemaBrowser...)
├── hooks/                         # Layer 3: Client Business Logic (Custom Hooks)
├── services/                      # Layer 4: Data Access Layer (API Callers)
├── lib/                           # Layer 5: Utilities & Parsers (sapParser.ts)
└── types/                         # Layer 6: Strict TypeScript Definitions
🔒 2. Cơ Chế Xác Thực & Bảo Mật (Authentication & Proxy)
Tuyệt đối không lưu Credentials của SAP (Username/Password) vào file .env.local hoặc lưu cứng trong code.

Stateless Cookie Mechanism: Hệ thống quản lý phiên bằng Cookie được cấp từ SAP. Khi Dev đăng nhập qua /api/auth/login, Next.js sẽ nhận các Session Cookie từ SAP (ví dụ: SAP_SESSIONID_S40_324) và ghi đè thẳng vào trình duyệt của Client với path=/.

Catch-All Proxy ([...path]): Tất cả các truy vấn dữ liệu SAP bắt buộc phải đi qua endpoint /api/sap/[...path].

Proxy này có nhiệm vụ tự động đọc Cookie từ trình duyệt của Dev gửi lên để chuyển tiếp sang SAP.

Nếu là request POST / PUT / DELETE, Proxy sẽ tự động kích hoạt cơ chế gửi request ngầm để xin X-CSRF-Token từ SAP trước khi thực thi lệnh ghi.

⚠️ 3. Các Quy Tắc Sống Còn Cho AI (Critical Constraints)
Không gọi trực tiếp URL SAP từ Client: Tuyệt đối không được sinh code cho Client Component gọi trực tiếp đến https://s40lp1.ucc.cit.tum.de... vì sẽ bị chặn bởi CORS và lỗi bảo mật. Mọi request phải qua /api/sap/....

Cấu trúc OData v2 JSON: Dữ liệu trả về từ SAP OData v2 luôn được bọc trong một object có key là d.

Lấy danh sách (Array): response.data.d.results

Lấy chi tiết (Object): response.data.d

Hãy luôn sử dụng hàm formatODataResults() trong lib/sapParser.ts để bóc tách dữ liệu một cách an toàn.

Xử lý Edm.DateTime: Định dạng ngày tháng từ SAP trả về có dạng chuỗi "/Date(1716200000000)/". Bắt buộc phải dùng hàm parseSapDate() từ lib/sapParser.ts để parse sang ngày giờ hiển thị, không để nguyên chuỗi raw.

Kiểu dữ liệu Số (Decimal/Float): SAP trả về các trường số (Price, Quantity) dưới dạng String để tránh mất độ chính xác. Hãy nhớ convert sang Number hoặc parseFloat khi tính toán toán học.

📝 4. Mẫu Viết Code Chuẩn (Coding Patterns)
Khi tạo một Service mới (services/exampleService.ts):
TypeScript

import { formatODataResults } from '@/lib/sapParser';

export const exampleService = {
  fetchData: async (entitySetName: string) => {
    const res = await fetch(`/api/sap/${entitySetName}?$format=json`);
    if (!res.ok) throw new Error('Lỗi fetch dữ liệu');
    const data = await res.json();
    return formatODataResults(data); // Luôn parse data qua helper
  }
};
Khi viết Custom Hook kết nối UI (hooks/useExample.ts):
TypeScript

import { useState } from 'react';
import { exampleService } from '@/services/exampleService';

export function useExample() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async (entity: string) => {
    setLoading(true);
    try {
      const data = await exampleService.fetchData(entity);
      setList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return { list, loading, loadData };
}
Vui lòng tuân thủ bản thiết kế này để giữ cho hệ thống SQL Workbench luôn ổn định và sạch sẽ!
```
